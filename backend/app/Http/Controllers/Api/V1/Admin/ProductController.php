<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\ProductStatus;
use App\Enums\StockPolicy;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ProductRequest;
use App\Http\Resources\Admin\ProductResource;
use App\Models\Product;
use App\Services\ActivityLogger;
use App\Services\Catalog\ProductService;
use App\Services\Search\SearchEngine;
use App\Support\Money;
use App\Support\PreviewToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductController extends Controller
{
    public function __construct(
        private readonly ProductService $products,
        private readonly ActivityLogger $logger,
    ) {}

    public function index(Request $request, SearchEngine $search): JsonResponse
    {
        $this->authorize('viewAny', Product::class);
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['draft', 'scheduled', 'published', 'archived', 'trashed', 'live'])],
            'department_id' => ['nullable', 'integer'],
            'category_id' => ['nullable', 'integer'],
            'collection_id' => ['nullable', 'integer'],
            'stock' => ['nullable', Rule::in(['out_of_stock', 'low_stock'])],
            'flag' => ['nullable', Rule::in(['featured', 'new_arrival', 'bestseller'])],
            'price_mode' => ['nullable', Rule::in(['fixed', 'starting_from', 'on_request'])],
            'sort' => ['nullable', Rule::in(['updated_desc', 'name', 'created_desc', 'price_asc', 'price_desc', 'enquiries'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'ids' => ['nullable', 'string', 'max:1000', 'regex:/^[0-9,]+$/'],
        ]);

        $query = Product::query()
            ->with([
                'media' => fn ($q) => $q->with('asset')->orderBy('sort_order'),
                'categories:id,name,path',
                'variants:id,product_id,stock_quantity,stock_policy,low_stock_threshold,is_active',
            ])
            ->when($filters['ids'] ?? null, fn ($q, $ids) => $q->whereIn('id', array_filter(explode(',', $ids))))
            ->when(($filters['status'] ?? null) === 'trashed', fn ($q) => $q->onlyTrashed())
            ->when(($filters['status'] ?? null) === 'live', fn ($q) => $q->publiclyVisible())
            ->when(in_array($filters['status'] ?? null, ['draft', 'scheduled', 'published', 'archived'], true), fn ($q) => $q->where('status', $filters['status']))
            ->when($filters['department_id'] ?? null, fn ($q, $id) => $q->where('department_id', $id))
            ->when($filters['category_id'] ?? null, fn ($q, $id) => $q->whereHas('categories', fn ($c) => $c->whereKey($id)))
            ->when($filters['collection_id'] ?? null, fn ($q, $id) => $q->whereHas('collections', fn ($c) => $c->whereKey($id)))
            ->when($filters['price_mode'] ?? null, fn ($q, $mode) => $q->where('price_mode', $mode))
            ->when($filters['flag'] ?? null, fn ($q, $flag) => $q->where('is_'.$flag, true))
            ->when(($filters['stock'] ?? null) === 'out_of_stock', fn ($q) => $q->whereHas('variants', fn ($v) => $v
                ->where('is_active', true)->where('stock_policy', StockPolicy::Track->value)->where('stock_quantity', '<=', 0)))
            ->when(($filters['stock'] ?? null) === 'low_stock', fn ($q) => $q->whereHas('variants', fn ($v) => $v
                ->where('is_active', true)->where('stock_policy', StockPolicy::Track->value)
                ->where('stock_quantity', '>', 0)->whereColumn('stock_quantity', '<=', 'low_stock_threshold')));

        if (filled($filters['q'] ?? null)) {
            $term = $filters['q'];
            $query->where(fn ($q) => $q->where('sku', 'like', strtoupper($term).'%')
                ->orWhereHas('variants', fn ($v) => $v->where('sku', 'like', strtoupper($term).'%'))
                ->orWhere(fn ($inner) => $search->constrain($inner, $term, false)));
        }

        match ($filters['sort'] ?? 'updated_desc') {
            'name' => $query->orderBy('name'),
            'created_desc' => $query->orderByDesc('created_at'),
            'price_asc' => $query->orderBy('min_price'),
            'price_desc' => $query->orderByDesc('min_price'),
            'enquiries' => $query->orderByDesc('enquiry_count'),
            default => $query->orderByDesc('updated_at'),
        };

        $page = $query->paginate($filters['per_page'] ?? 25)->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn (Product $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'slug' => $p->slug,
                'sku' => $p->sku,
                'status' => $p->status->value,
                'is_live' => $p->isPubliclyVisible(),
                'published_at' => $p->published_at?->toIso8601String(),
                'price_mode' => $p->price_mode->value,
                'price_label' => $p->price_mode->value === 'on_request' ? 'On request' : Money::format($p->min_price ?? $p->price, $p->currency),
                'thumb_url' => $p->media->first()?->asset?->url('thumb'),
                'categories' => $p->categories->pluck('name'),
                'variant_count' => $p->variants->count(),
                'out_of_stock_variants' => $p->variants->filter(fn ($v) => $v->is_active && $v->stock_policy === StockPolicy::Track && $v->stock_quantity <= 0)->count(),
                'is_featured' => $p->is_featured,
                'enquiry_count' => $p->enquiry_count,
                'updated_at' => $p->updated_at?->toIso8601String(),
                'deleted_at' => $p->deleted_at?->toIso8601String(),
            ]),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'counts' => $this->statusCounts(),
            ],
        ]);
    }

    private function statusCounts(): array
    {
        $counts = Product::query()->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');

        return [
            'all' => (int) $counts->sum(),
            'draft' => (int) ($counts['draft'] ?? 0),
            'scheduled' => (int) ($counts['scheduled'] ?? 0),
            'published' => (int) ($counts['published'] ?? 0),
            'archived' => (int) ($counts['archived'] ?? 0),
            'trashed' => Product::onlyTrashed()->count(),
        ];
    }

    public function store(ProductRequest $request): JsonResponse
    {
        $data = $request->validated();
        $wantsLive = in_array($data['status'] ?? 'draft', ['published', 'scheduled'], true);
        if ($wantsLive) {
            $this->authorize('publish', new Product);
        }

        $product = DB::transaction(function () use ($data, $wantsLive) {
            $product = $this->products->create([...$data, 'status' => $wantsLive ? 'draft' : ($data['status'] ?? 'draft')]);
            if ($wantsLive) {
                $this->products->changeStatus($product, ProductStatus::from($data['status']), $data['published_at'] ?? null);
            }

            return $product;
        });

        return (new ProductResource($this->loadFull($product)))->response()->setStatusCode(201);
    }

    public function show(int $id): ProductResource
    {
        $product = Product::withTrashed()->findOrFail($id);
        $this->authorize('view', $product);

        return new ProductResource($this->loadFull($product));
    }

    public function update(ProductRequest $request, Product $product): ProductResource
    {
        $data = $request->validated();
        $newStatus = isset($data['status']) ? ProductStatus::from($data['status']) : null;

        if ($newStatus && $newStatus !== $product->status) {
            $this->authorize('publish', $product);
        }

        DB::transaction(function () use ($product, $data, $newStatus) {
            unset($data['status']);
            $this->products->update($product, $data);
            if ($newStatus && $newStatus !== $product->status) {
                $this->products->changeStatus($product->fresh(), $newStatus, $data['published_at'] ?? null);
            }
        });

        return new ProductResource($this->loadFull($product->fresh()));
    }

    public function changeStatus(Request $request, Product $product): ProductResource
    {
        $this->authorize('publish', $product);
        $data = $request->validate([
            'status' => ['required', Rule::enum(ProductStatus::class)],
            'published_at' => ['nullable', 'date', Rule::requiredIf($request->input('status') === 'scheduled'), Rule::when($request->input('status') === 'scheduled', ['after:now'])],
        ]);
        $this->products->changeStatus($product, ProductStatus::from($data['status']), $data['published_at'] ?? null);

        return new ProductResource($this->loadFull($product->fresh()));
    }

    public function duplicate(Product $product): JsonResponse
    {
        $this->authorize('duplicate', $product);
        $copy = $this->products->duplicate($product);

        return (new ProductResource($this->loadFull($copy)))->response()->setStatusCode(201);
    }

    /** Soft delete: the product disappears from the storefront (410) but can be restored. */
    public function destroy(Product $product): JsonResponse
    {
        $this->authorize('delete', $product);
        $product->delete();
        $this->logger->log('product.deleted', "Moved {$product->name} to trash", $product);

        return response()->json(null, 204);
    }

    public function restore(int $id): ProductResource
    {
        $product = Product::onlyTrashed()->findOrFail($id);
        $this->authorize('restore', $product);
        $product->restore();
        $product->update(['status' => ProductStatus::Draft]);
        $this->logger->log('product.restored', "Restored {$product->name} as draft", $product);

        return new ProductResource($this->loadFull($product));
    }

    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:200'],
            'ids.*' => ['integer'],
            'action' => ['required', Rule::in(['publish', 'draft', 'archive', 'delete', 'restore', 'feature', 'unfeature'])],
        ]);
        $permission = in_array($data['action'], ['feature', 'unfeature'], true) ? 'products.manage' : 'products.publish';
        abort_unless($request->user()->hasPermission($permission), 403);

        $products = Product::withTrashed()->whereIn('id', $data['ids'])->get();
        $done = 0;
        $errors = [];

        foreach ($products as $product) {
            try {
                DB::transaction(function () use ($product, $data) {
                    match ($data['action']) {
                        'publish' => $this->products->changeStatus($product, ProductStatus::Published),
                        'draft' => $this->products->changeStatus($product, ProductStatus::Draft),
                        'archive' => $this->products->changeStatus($product, ProductStatus::Archived),
                        'delete' => $product->delete(),
                        'restore' => $product->restore() && $product->update(['status' => ProductStatus::Draft]),
                        'feature' => $product->update(['is_featured' => true]),
                        'unfeature' => $product->update(['is_featured' => false]),
                    };
                });
                $done++;
            } catch (ValidationException $e) {
                $errors[] = ['id' => $product->id, 'name' => $product->name, 'message' => collect($e->errors())->flatten()->first()];
            }
        }
        $this->logger->log('product.bulk_'.$data['action'], "Bulk {$data['action']} applied to {$done} products");

        return response()->json(['data' => ['updated' => $done, 'failed' => $errors]]);
    }

    public function previewToken(Product $product): JsonResponse
    {
        $this->authorize('view', $product);

        return response()->json(['data' => [
            'token' => PreviewToken::issue('product:'.$product->slug, auth()->id()),
            'path' => '/products/'.$product->slug,
        ]]);
    }

    private function loadFull(Product $product): Product
    {
        return $product->load([
            'categories', 'collections', 'occasions', 'tags', 'variants', 'media.asset',
            'attributeValues', 'relatedProducts', 'completeTheLook', 'creator', 'updater',
        ]);
    }
}
