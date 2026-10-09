<?php

namespace App\Http\Controllers\Api\V1\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Collection;
use App\Models\Department;
use App\Models\Occasion;
use App\Models\Product;
use App\Services\Settings\SettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Departments, categories, collections and occasions for storefront landing pages.
 */
class CatalogController extends Controller
{
    public function __construct(private readonly SettingsService $settings) {}

    public function departments(): JsonResponse
    {
        $departments = Department::query()->where('is_active', true)->orderBy('sort_order')->with('banner')->get();

        return response()->json(['data' => $departments->map(fn (Department $d) => [
            'name' => $d->name,
            'slug' => $d->slug,
            'url' => '/shop/'.$d->slug,
            'description' => $d->description,
            'banner' => $d->banner?->toPublicArray($d->name),
        ])]);
    }

    public function department(string $slug): JsonResponse
    {
        $department = Department::query()->where('slug', $slug)->where('is_active', true)->with('banner')->firstOrFail();
        $children = $this->visibleCategories()->where('department_id', $department->id)->whereNull('parent_id')->get();

        return response()->json(['data' => [
            'type' => 'department',
            'name' => $department->name,
            'slug' => $department->slug,
            'path' => $department->slug,
            'intro' => $department->description,
            'banner' => $department->banner?->toPublicArray($department->name),
            'breadcrumbs' => [['name' => $department->name, 'path' => $department->slug]],
            'children' => $children->map(fn (Category $c) => $this->categorySummary($c))->values(),
            'seo' => $this->seo($department->seo_title ?: $department->name, $department->seo_description ?: $department->description, '/shop/'.$department->slug),
        ]]);
    }

    /** Full category tree grouped by department (used for menus and filters). */
    public function categories(): JsonResponse
    {
        $categories = $this->visibleCategories()->get();
        $byParent = $categories->groupBy(fn ($c) => $c->parent_id ?? 0);
        $build = function (int $parentId) use (&$build, $byParent) {
            return ($byParent->get($parentId) ?? collect())->map(fn (Category $c) => [
                ...$this->categorySummary($c),
                'children' => $build($c->id),
            ])->values();
        };

        $departments = Department::query()->where('is_active', true)->orderBy('sort_order')->get();

        return response()->json(['data' => $departments->map(fn (Department $d) => [
            'name' => $d->name,
            'slug' => $d->slug,
            'url' => '/shop/'.$d->slug,
            'categories' => $build(0)->filter(fn ($c) => $c['department_id'] === $d->id)->values(),
        ])]);
    }

    public function category(string $path): JsonResponse
    {
        $category = Category::query()->published()->where('path', $path)
            ->with(['banner', 'image', 'department', 'parent.parent.parent'])
            ->firstOrFail();
        abort_unless($category->department?->is_active, 404);

        return response()->json(['data' => [
            'type' => 'category',
            'name' => $category->name,
            'slug' => $category->slug,
            'path' => $category->path,
            'intro' => $category->intro,
            'banner' => ($category->banner ?? $category->image)?->toPublicArray($category->name),
            'department' => ['name' => $category->department->name, 'slug' => $category->department->slug],
            'breadcrumbs' => [
                ['name' => $category->department->name, 'path' => $category->department->slug],
                ...$category->breadcrumbTrail(),
            ],
            'children' => $this->visibleCategories()->where('parent_id', $category->id)->get()
                ->map(fn (Category $c) => $this->categorySummary($c))->values(),
            'seo' => $this->seo(
                $category->seo_title ?: $category->name.' — '.$category->department->name,
                $category->seo_description ?: $category->intro,
                '/shop/'.$category->path,
            ),
        ]]);
    }

    public function collections(): JsonResponse
    {
        $collections = Collection::query()->visible()->with('cover')->withCount(['products' => fn ($q) => $q->publiclyVisible()])
            ->orderByDesc('is_featured')->orderBy('sort_order')->get()
            ->filter(fn ($c) => $c->products_count > 0)->values();

        return response()->json(['data' => $collections->map(fn (Collection $c) => [
            'name' => $c->name,
            'slug' => $c->slug,
            'url' => '/collections/'.$c->slug,
            'tagline' => $c->tagline,
            'is_featured' => $c->is_featured,
            'cover' => $c->cover?->toPublicArray($c->name),
            'product_count' => $c->products_count,
        ])]);
    }

    public function collection(string $slug): JsonResponse
    {
        $collection = Collection::query()->visible()->where('slug', $slug)->with(['cover', 'banner'])->firstOrFail();

        return response()->json(['data' => [
            'type' => 'collection',
            'name' => $collection->name,
            'slug' => $collection->slug,
            'tagline' => $collection->tagline,
            'story' => $collection->story,
            'cover' => $collection->cover?->toPublicArray($collection->name),
            'banner' => ($collection->banner ?? $collection->cover)?->toPublicArray($collection->name),
            'ends_at' => $collection->ends_at?->toIso8601String(),
            'seo' => $this->seo($collection->seo_title ?: $collection->name, $collection->seo_description ?: $collection->tagline, '/collections/'.$collection->slug),
        ]]);
    }

    public function occasions(): JsonResponse
    {
        $occasions = Occasion::query()->where('is_published', true)->with('image')->orderBy('sort_order')->get();

        return response()->json(['data' => $occasions->map(fn (Occasion $o) => [
            'name' => $o->name,
            'slug' => $o->slug,
            'url' => '/occasions/'.$o->slug,
            'description' => $o->description,
            'image' => $o->image?->toPublicArray($o->name),
        ])]);
    }

    public function occasion(string $slug): JsonResponse
    {
        $occasion = Occasion::query()->where('is_published', true)->where('slug', $slug)->with('image')->firstOrFail();

        return response()->json(['data' => [
            'type' => 'occasion',
            'name' => $occasion->name,
            'slug' => $occasion->slug,
            'description' => $occasion->description,
            'banner' => $occasion->image?->toPublicArray($occasion->name),
            'seo' => $this->seo($occasion->seo_title ?: $occasion->name.' Edit', $occasion->seo_description ?: $occasion->description, '/occasions/'.$occasion->slug),
        ]]);
    }

    /**
     * Published categories, excluding those set to hide when they have no visible products.
     */
    private function visibleCategories()
    {
        $withProducts = DB::table('category_product')
            ->join('products', 'products.id', '=', 'category_product.product_id')
            ->whereIn('products.id', Product::query()->publiclyVisible()->select('id'))
            ->distinct()->pluck('category_product.category_id');

        // A parent with populated descendants is not empty.
        $paths = Category::query()->whereIn('id', $withProducts)->pluck('path');
        $nonEmpty = $paths->flatMap(function ($path) {
            $parts = explode('/', $path);
            $prefixes = [];
            for ($i = 2; $i <= count($parts); $i++) {
                $prefixes[] = implode('/', array_slice($parts, 0, $i));
            }

            return $prefixes;
        })->unique()->values();

        return Category::query()->published()
            ->with('image')
            ->where(fn ($q) => $q->where('hide_when_empty', false)->orWhereIn('path', $nonEmpty->all() ?: ['']))
            ->whereHas('department', fn ($q) => $q->where('is_active', true))
            ->orderBy('sort_order')->orderBy('name');
    }

    private function categorySummary(Category $c): array
    {
        return [
            'id' => $c->id,
            'department_id' => $c->department_id,
            'name' => $c->name,
            'slug' => $c->slug,
            'path' => $c->path,
            'url' => '/shop/'.$c->path,
            'show_in_menu' => $c->show_in_menu,
            'image' => $c->image?->toPublicArray($c->name),
        ];
    }

    private function seo(string $title, ?string $description, string $path): array
    {
        return [
            'title' => $title,
            'description' => $description ? mb_substr(strip_tags($description), 0, 300) : $this->settings->get('seo_default_description'),
            'canonical_url' => $this->settings->siteUrl().$path,
        ];
    }
}
