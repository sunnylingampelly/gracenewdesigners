<?php

namespace App\Services\Catalog;

use App\Models\Category;
use App\Models\Department;
use App\Models\Redirect;
use App\Services\ActivityLogger;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CategoryService
{
    public function __construct(private readonly ActivityLogger $logger) {}

    public function save(Category $category, array $data): Category
    {
        return DB::transaction(function () use ($category, $data) {
            if (isset($data['parent_id']) && $category->exists) {
                $this->guardAgainstCycle($category, (int) $data['parent_id']);
            }

            $oldPath = $category->path;
            $category->fill(Arr::except($data, ['attribute_ids']));
            if (blank($category->slug)) {
                $category->slug = $category->name;
            }
            $this->guardUniquePath($category);
            $isNew = ! $category->exists;
            $category->save();

            if (array_key_exists('attribute_ids', $data)) {
                $category->attributes()->sync($data['attribute_ids'] ?? []);
            }

            if ($oldPath && $oldPath !== $category->path) {
                $this->rebuildDescendantPaths($category);
                Redirect::record("/shop/{$oldPath}", "/shop/{$category->path}");
            }

            $this->logger->log($isNew ? 'category.created' : 'category.updated', ($isNew ? 'Created' : 'Updated')." category {$category->path}", $category);

            return $category;
        });
    }

    /** Re-save children so their materialized path follows the parent. */
    private function rebuildDescendantPaths(Category $category): void
    {
        foreach ($category->children()->withTrashed()->get() as $child) {
            $old = $child->path;
            $child->save();
            if ($old !== $child->path) {
                Redirect::record("/shop/{$old}", "/shop/{$child->path}");
            }
            $this->rebuildDescendantPaths($child);
        }
    }

    private function guardAgainstCycle(Category $category, int $parentId): void
    {
        $node = Category::withTrashed()->find($parentId);
        while ($node) {
            if ($node->id === $category->id) {
                throw ValidationException::withMessages(['parent_id' => 'A category cannot be placed inside itself or one of its subcategories.']);
            }
            $node = $node->parent_id ? Category::withTrashed()->find($node->parent_id) : null;
        }
    }

    private function guardUniquePath(Category $category): void
    {
        $probe = $category->replicate();
        $probe->slug = Str::slug($category->slug ?: $category->name);
        $parentPath = $category->parent_id
            ? Category::withTrashed()->whereKey($category->parent_id)->value('path')
            : Department::query()->whereKey($category->department_id)->value('slug');
        $path = trim($parentPath.'/'.$probe->slug, '/');

        $exists = Category::withTrashed()->where('path', $path)->when($category->exists, fn ($q) => $q->whereKeyNot($category->id))->exists();
        if ($exists) {
            throw ValidationException::withMessages(['slug' => "Another category already uses the URL /shop/{$path}."]);
        }
    }

    /**
     * Deleting a category never deletes products: it is refused while children exist,
     * and product links are detached (products themselves are untouched).
     */
    public function delete(Category $category): void
    {
        if ($category->children()->exists()) {
            throw ValidationException::withMessages(['category' => 'Move or delete the subcategories first.']);
        }

        DB::transaction(function () use ($category) {
            $count = $category->products()->count();
            $category->products()->detach();
            $category->delete();
            $this->logger->log('category.deleted', "Deleted category {$category->path} (detached {$count} products)", $category);
        });
    }

    /** Apply a new ordering/nesting from the admin tree editor. */
    public function reorder(array $items): void
    {
        DB::transaction(function () use ($items) {
            foreach ($items as $item) {
                Category::query()->whereKey($item['id'])->update(['sort_order' => $item['sort_order']]);
            }
        });
    }
}
