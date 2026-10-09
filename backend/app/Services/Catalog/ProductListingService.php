<?php

namespace App\Services\Catalog;

use App\Enums\StockPolicy;
use App\Models\Attribute;
use App\Models\Category;
use App\Models\Collection;
use App\Models\Department;
use App\Models\Occasion;
use App\Models\Product;
use App\Models\ProductOption;
use App\Services\Search\SearchEngine;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Server-side filtering, sorting, pagination and facet counts for storefront product listings.
 * Filters arrive as URL query parameters so listings are shareable and crawlable.
 */
class ProductListingService
{
    public const SORTS = ['recommended', 'newest', 'price_asc', 'price_desc', 'popular', 'alphabetical'];

    public const MAX_PER_PAGE = 48;

    public function __construct(private readonly SearchEngine $search) {}

    /**
     * @param  array<string, mixed>  $filters  validated filter input
     */
    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = $this->contextQuery($filters);
        $this->applyRefinements($query, $filters);
        $this->applySort($query, $filters['sort'] ?? 'recommended', filled($filters['q'] ?? null));

        $perPage = min((int) ($filters['per_page'] ?? 24), self::MAX_PER_PAGE);

        return $query->with(self::cardRelations())->paginate($perPage)->withQueryString();
    }

    /** Eager loads required to render a product card without N+1 queries. */
    public static function cardRelations(): array
    {
        return [
            'media' => fn ($q) => $q->whereIn('role', ['gallery', 'alternate'])->with('asset'),
            'variants' => fn ($q) => $q->where('is_active', true)->with(['color', 'size']),
            'categories:id,name,path',
        ];
    }

    /**
     * The "context" is the page the listing sits on (department, category, collection, occasion, search).
     * Facet counts are computed against the context so shoppers can see every available refinement.
     */
    public function contextQuery(array $filters): Builder
    {
        $query = Product::query()->publiclyVisible()->select('products.*');

        if ($slug = $filters['department'] ?? null) {
            // A product belongs to a department directly or through any of its categories.
            $departmentId = Department::query()->where('slug', $slug)->where('is_active', true)->value('id') ?? 0;
            $query->where(fn ($q) => $q->where('products.department_id', $departmentId)
                ->orWhereIn('products.id', DB::table('category_product')
                    ->join('categories', 'categories.id', '=', 'category_product.category_id')
                    ->where('categories.department_id', $departmentId)
                    ->select('category_product.product_id')));
        }
        if ($path = $filters['category'] ?? null) {
            $category = Category::query()->published()->where('path', $path)->first();
            $ids = $category ? $category->descendantAndSelfIds() : [0];
            $query->whereIn('products.id', DB::table('category_product')->select('product_id')->whereIn('category_id', $ids));
        }
        if ($slug = $filters['collection'] ?? null) {
            $query->whereHas('collections', fn ($q) => $q->where('slug', $slug));
        }
        if ($slug = $filters['occasion'] ?? null) {
            $query->whereHas('occasions', fn ($q) => $q->where('slug', $slug));
        }
        if ($slug = $filters['tag'] ?? null) {
            $query->whereHas('tags', fn ($q) => $q->where('slug', $slug));
        }
        foreach (['new' => 'is_new_arrival', 'featured' => 'is_featured', 'bestseller' => 'is_bestseller'] as $flag => $column) {
            if (! empty($filters[$flag])) {
                $query->where("products.$column", true);
            }
        }
        if (filled($term = $filters['q'] ?? null)) {
            $this->search->constrain($query, $term, ($filters['sort'] ?? 'recommended') === 'recommended');
        }

        return $query;
    }

    private function applyRefinements(Builder $query, array $filters): void
    {
        if ($sizes = $this->list($filters['size'] ?? null)) {
            $query->whereHas('variants', fn ($q) => $q->where('is_active', true)
                ->whereHas('size', fn ($s) => $s->whereIn('code', $sizes)));
        }
        if ($colors = $this->list($filters['color'] ?? null)) {
            $query->whereHas('variants', fn ($q) => $q->where('is_active', true)
                ->whereHas('color', fn ($c) => $c->whereIn('code', $colors)));
        }
        // Subcategory refinement within a department or category page.
        if ($paths = $this->list($filters['subcategory'] ?? null)) {
            $ids = Category::query()->published()->whereIn('path', $paths)->get()->flatMap->descendantAndSelfIds()->all();
            $query->whereIn('products.id', DB::table('category_product')->select('product_id')->whereIn('category_id', $ids ?: [0]));
        }
        if ($collections = $this->list($filters['collections'] ?? null)) {
            $query->whereHas('collections', fn ($q) => $q->whereIn('slug', $collections));
        }
        if ($occasions = $this->list($filters['occasions'] ?? null)) {
            $query->whereHas('occasions', fn ($q) => $q->whereIn('slug', $occasions));
        }
        // Filterable attributes (fabric, work type, …) arrive as attr[fabric]=silk,organza
        foreach ((array) ($filters['attr'] ?? []) as $code => $values) {
            if ($slugs = $this->list($values)) {
                $query->whereHas('attributeValues', fn ($q) => $q
                    ->whereHas('attribute', fn ($a) => $a->where('code', $code)->where('is_filterable', true))
                    ->whereHas('option', fn ($o) => $o->whereIn('slug', $slugs)));
            }
        }
        if (isset($filters['price_min'])) {
            $query->where('products.min_price', '>=', $filters['price_min']);
        }
        if (isset($filters['price_max'])) {
            $query->where('products.min_price', '<=', $filters['price_max']);
        }
        if (($filters['availability'] ?? null) === 'available') {
            $query->where('products.has_stock', true);
        }
        if (($filters['fulfilment'] ?? null) === 'made_to_order') {
            $query->where(fn ($q) => $q->where('products.is_made_to_order', true)
                ->orWhereHas('variants', fn ($v) => $v->where('is_active', true)->where('stock_policy', StockPolicy::MadeToOrder->value)));
        }
        if (($filters['fulfilment'] ?? null) === 'ready_to_ship') {
            $query->where('products.is_made_to_order', false)
                ->whereHas('variants', fn ($v) => $v->where('is_active', true)->where(fn ($s) => $s
                    ->where(fn ($t) => $t->where('stock_policy', StockPolicy::Track->value)->where('stock_quantity', '>', 0))
                    ->orWhere('stock_policy', StockPolicy::Untracked->value)));
        }
        if (! empty($filters['custom_size'])) {
            $query->where('products.allows_custom_size', true);
        }
    }

    private function applySort(Builder $query, string $sort, bool $searching): void
    {
        match ($sort) {
            'newest' => $query->orderByDesc('products.published_at'),
            // Price-on-request items (NULL min_price) sort last in both directions.
            'price_asc' => $query->orderByRaw('CASE WHEN products.min_price IS NULL THEN 1 ELSE 0 END')->orderBy('products.min_price'),
            'price_desc' => $query->orderByRaw('CASE WHEN products.min_price IS NULL THEN 1 ELSE 0 END')->orderByDesc('products.min_price'),
            'popular' => $query->orderByRaw('(products.view_count + products.enquiry_count * 10) DESC'),
            'alphabetical' => $query->orderBy('products.name'),
            default => $searching ? null : $query
                ->orderByDesc('products.recommendation_priority')
                ->orderByDesc('products.is_featured')
                ->orderByDesc('products.published_at'),
        };
        $query->orderBy('products.id');
    }

    /**
     * Facet values with counts, computed against the listing context.
     *
     * @return array<string, mixed>
     */
    public function facets(array $filters): array
    {
        $ids = $this->contextQuery($filters)->reorder()->select('products.id');

        $optionFacet = function (string $code) use ($ids) {
            return DB::table('product_variants as v')
                ->join('product_option_values as ov', 'ov.id', '=', $code === ProductOption::SIZE ? 'v.size_value_id' : 'v.color_value_id')
                ->whereIn('v.product_id', $ids)
                ->where('v.is_active', true)
                ->groupBy('ov.id', 'ov.code', 'ov.label', 'ov.hex', 'ov.sort_order')
                ->orderBy('ov.sort_order')
                ->selectRaw('ov.code as value, ov.label, ov.hex, COUNT(DISTINCT v.product_id) as count')
                ->get()
                ->map(fn ($row) => array_filter([
                    'value' => $row->value, 'label' => $row->label, 'hex' => $row->hex, 'count' => (int) $row->count,
                ], fn ($v) => $v !== null))
                ->values();
        };

        $attributes = Attribute::query()->where('is_filterable', true)->orderBy('sort_order')->get()
            ->map(function (Attribute $attribute) use ($ids) {
                $values = DB::table('product_attribute_values as pav')
                    ->join('attribute_values as av', 'av.id', '=', 'pav.attribute_value_id')
                    ->where('pav.attribute_id', $attribute->id)
                    ->whereIn('pav.product_id', $ids)
                    ->groupBy('av.id', 'av.slug', 'av.value', 'av.sort_order')
                    ->orderBy('av.sort_order')->orderBy('av.value')
                    ->selectRaw('av.slug as value, av.value as label, COUNT(DISTINCT pav.product_id) as count')
                    ->get()->map(fn ($r) => ['value' => $r->value, 'label' => $r->label, 'count' => (int) $r->count]);

                return ['code' => $attribute->code, 'name' => $attribute->name, 'values' => $values];
            })
            ->filter(fn ($facet) => $facet['values']->isNotEmpty())->values();

        $priceRange = Product::query()->whereIn('id', $ids)->whereNotNull('min_price')
            ->selectRaw('MIN(min_price) as min, MAX(min_price) as max')->first();

        $occasions = Occasion::query()->where('is_published', true)
            ->whereHas('products', fn ($q) => $q->whereIn('products.id', $ids))
            ->withCount(['products' => fn ($q) => $q->whereIn('products.id', $ids)])
            ->orderBy('sort_order')->get()
            ->map(fn ($o) => ['value' => $o->slug, 'label' => $o->name, 'count' => $o->products_count]);

        $collections = Collection::query()->visible()
            ->whereHas('products', fn ($q) => $q->whereIn('products.id', $ids))
            ->withCount(['products' => fn ($q) => $q->whereIn('products.id', $ids)])
            ->orderBy('sort_order')->get()
            ->map(fn ($c) => ['value' => $c->slug, 'label' => $c->name, 'count' => $c->products_count]);

        return [
            'subcategories' => $this->subcategoryFacet($filters, $ids),
            'sizes' => $optionFacet(ProductOption::SIZE),
            'colors' => $optionFacet(ProductOption::COLOR),
            'attributes' => $attributes,
            'occasions' => $occasions,
            'collections' => $collections,
            'price' => [
                'min' => $priceRange?->min !== null ? (float) $priceRange->min : null,
                'max' => $priceRange?->max !== null ? (float) $priceRange->max : null,
            ],
        ];
    }

    private function subcategoryFacet(array $filters, Builder $ids): array
    {
        $parent = null;
        $departmentId = null;
        if ($path = $filters['category'] ?? null) {
            $parent = Category::query()->published()->where('path', $path)->first();
            if (! $parent) {
                return [];
            }
        } elseif ($slug = $filters['department'] ?? null) {
            $departmentId = Department::query()->where('slug', $slug)->value('id');
        } else {
            return [];
        }

        return Category::query()->published()
            ->when($parent, fn ($q) => $q->where('parent_id', $parent->id))
            ->when($departmentId, fn ($q) => $q->where('department_id', $departmentId)->whereNull('parent_id'))
            ->orderBy('sort_order')->get()
            ->map(function (Category $category) use ($ids) {
                $count = DB::table('category_product')
                    ->whereIn('category_id', $category->descendantAndSelfIds())
                    ->whereIn('product_id', $ids)
                    ->distinct()->count('product_id');

                return ['value' => $category->path, 'label' => $category->name, 'count' => $count];
            })
            ->filter(fn ($row) => $row['count'] > 0)->values()->all();
    }

    /** @return list<string> */
    private function list(mixed $value): array
    {
        if (is_array($value)) {
            return array_values(array_filter(array_map('strval', $value)));
        }

        return $value === null || $value === '' ? [] : array_values(array_filter(explode(',', (string) $value)));
    }
}
