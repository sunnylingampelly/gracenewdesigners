<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

#[Fillable([
    'department_id', 'parent_id', 'name', 'slug', 'intro', 'banner_media_id', 'image_media_id', 'size_chart_id',
    'sort_order', 'is_published', 'show_in_menu', 'hide_when_empty', 'seo_title', 'seo_description',
])]
class Category extends Model
{
    use HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
            'show_in_menu' => 'boolean',
            'hide_when_empty' => 'boolean',
            'sort_order' => 'integer',
            'depth' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        // The path ("women/lehengas") scopes the slug to its parent and is the public URL key.
        static::saving(function (Category $category) {
            $category->slug = Str::slug($category->slug ?: $category->name);
            $parent = $category->parent_id ? Category::withTrashed()->find($category->parent_id) : null;
            if ($parent) {
                $category->department_id = $parent->department_id;
                $category->depth = $parent->depth + 1;
                $prefix = $parent->path;
            } else {
                $category->depth = 0;
                $prefix = Department::query()->whereKey($category->department_id)->value('slug');
            }
            $category->path = trim($prefix.'/'.$category->slug, '/');
        });
    }

    public function scopePublished(Builder $query): void
    {
        $query->where('is_published', true);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(Category::class, 'parent_id')->orderBy('sort_order')->orderBy('name');
    }

    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class)->withPivot(['is_primary', 'sort_order']);
    }

    public function banner(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'banner_media_id');
    }

    public function image(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'image_media_id');
    }

    public function sizeChart(): BelongsTo
    {
        return $this->belongsTo(SizeChart::class);
    }

    public function attributes(): BelongsToMany
    {
        return $this->belongsToMany(Attribute::class)->withPivot('is_required');
    }

    /** IDs of this category and all of its descendants (used for listing filters). */
    public function descendantAndSelfIds(): array
    {
        return Category::query()
            ->where('path', $this->path)
            ->orWhere('path', 'like', $this->path.'/%')
            ->pluck('id')->all();
    }

    /** @return list<array{name: string, path: string}> */
    public function breadcrumbTrail(): array
    {
        $trail = [];
        $node = $this;
        while ($node) {
            array_unshift($trail, ['name' => $node->name, 'path' => $node->path]);
            $node = $node->parent;
        }

        return $trail;
    }
}
