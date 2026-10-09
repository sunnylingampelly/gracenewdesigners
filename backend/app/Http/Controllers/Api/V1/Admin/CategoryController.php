<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CategoryRequest;
use App\Models\Category;
use App\Models\Department;
use App\Services\ActivityLogger;
use App\Services\Catalog\CategoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CategoryController extends Controller
{
    public function __construct(
        private readonly CategoryService $categories,
        private readonly ActivityLogger $logger,
    ) {}

    /** Flat list (with depth/path) that the admin renders as a tree. */
    public function index(): JsonResponse
    {
        $categories = Category::query()->with(['image', 'banner', 'attributes:id'])->withCount('products')
            ->orderBy('department_id')->orderBy('depth')->orderBy('sort_order')->orderBy('name')->get();

        return response()->json(['data' => $categories->map(fn (Category $c) => $this->present($c))]);
    }

    public function show(Category $category): JsonResponse
    {
        return response()->json(['data' => $this->present($category->load(['image', 'banner', 'attributes:id'])->loadCount('products'))]);
    }

    public function store(CategoryRequest $request): JsonResponse
    {
        $category = $this->categories->save(new Category, $request->validated());

        return response()->json(['data' => $this->present($category->load(['image', 'banner', 'attributes:id'])->loadCount('products'))], 201);
    }

    public function update(CategoryRequest $request, Category $category): JsonResponse
    {
        $category = $this->categories->save($category, $request->validated());

        return response()->json(['data' => $this->present($category->load(['image', 'banner', 'attributes:id'])->loadCount('products'))]);
    }

    public function destroy(Category $category): JsonResponse
    {
        $this->categories->delete($category);

        return response()->json(null, 204);
    }

    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'items' => ['required', 'array'],
            'items.*.id' => ['required', 'integer', 'exists:categories,id'],
            'items.*.sort_order' => ['required', 'integer', 'min:0'],
        ]);
        $this->categories->reorder($data['items']);

        return response()->json(null, 204);
    }

    private function present(Category $c): array
    {
        return [
            ...Arr::only($c->toArray(), [
                'id', 'department_id', 'parent_id', 'name', 'slug', 'path', 'depth', 'intro', 'banner_media_id',
                'image_media_id', 'size_chart_id', 'sort_order', 'is_published', 'show_in_menu', 'hide_when_empty',
                'seo_title', 'seo_description',
            ]),
            'products_count' => $c->products_count ?? 0,
            'image_url' => $c->image?->url('thumb'),
            'banner_url' => $c->banner?->url('sm'),
            'attribute_ids' => $c->relationLoaded('attributes') ? $c->attributes->pluck('id') : [],
        ];
    }

    // ---- Departments -----------------------------------------------------------------------

    public function departments(): JsonResponse
    {
        return response()->json(['data' => Department::query()->withCount(['products', 'categories'])->with('banner')->orderBy('sort_order')->get()
            ->map(fn (Department $d) => [...$d->only(['id', 'name', 'slug', 'description', 'banner_media_id', 'sort_order', 'is_active', 'seo_title', 'seo_description']),
                'products_count' => $d->products_count, 'categories_count' => $d->categories_count, 'banner_url' => $d->banner?->url('sm')])]);
    }

    public function saveDepartment(Request $request, ?Department $department = null): JsonResponse
    {
        $department ??= new Department;
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('departments')->ignore($department->id)],
            'description' => ['nullable', 'string', 'max:2000'],
            'banner_media_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:500'],
        ]);
        $slugChanged = $department->exists && isset($data['slug']) && $data['slug'] !== $department->slug;
        $department->fill($data)->save();

        if ($slugChanged) {
            // Department slug prefixes every category path.
            foreach ($department->categories()->whereNull('parent_id')->get() as $root) {
                $this->categories->save($root, []);
            }
        }
        $this->logger->log('department.saved', "Saved department {$department->name}", $department);

        return response()->json(['data' => $department], $department->wasRecentlyCreated ? 201 : 200);
    }

    public function destroyDepartment(Department $department): JsonResponse
    {
        if ($department->categories()->exists() || $department->products()->exists()) {
            throw ValidationException::withMessages(['department' => 'This department still has categories or products. Deactivate it instead, or move them first.']);
        }
        $department->delete();
        $this->logger->log('department.deleted', "Deleted department {$department->name}");

        return response()->json(null, 204);
    }
}
