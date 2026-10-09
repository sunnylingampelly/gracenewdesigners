<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Collection;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CollectionController extends Controller
{
    public function __construct(private readonly ActivityLogger $logger) {}

    public function index(Request $request): JsonResponse
    {
        $q = $request->query('q');
        $collections = Collection::query()->with(['cover', 'banner'])->withCount('products')
            ->when($q, fn ($query) => $query->where('name', 'like', '%'.$q.'%'))
            ->orderBy('sort_order')->orderBy('name')->get();

        return response()->json(['data' => $collections->map(fn (Collection $c) => $this->present($c))]);
    }

    public function show(Collection $collection): JsonResponse
    {
        $collection->load(['cover', 'banner', 'products' => fn ($q) => $q->with(['media' => fn ($m) => $m->with('asset')])->orderBy('collection_product.sort_order')])->loadCount('products');

        return response()->json(['data' => [
            ...$this->present($collection),
            'products' => $collection->products->map(fn ($p) => [
                'id' => $p->id, 'name' => $p->name, 'sku' => $p->sku, 'status' => $p->status->value,
                'thumb_url' => $p->media->first()?->asset?->url('thumb'),
            ]),
        ]]);
    }

    public function store(Request $request): JsonResponse
    {
        $collection = new Collection;
        $collection->fill($this->validated($request, $collection))->save();
        $this->logger->log('collection.created', "Created collection {$collection->name}", $collection);

        return response()->json(['data' => $this->present($collection->loadCount('products'))], 201);
    }

    public function update(Request $request, Collection $collection): JsonResponse
    {
        $collection->fill($this->validated($request, $collection))->save();
        $this->logger->log('collection.updated', "Updated collection {$collection->name}", $collection);

        return response()->json(['data' => $this->present($collection->load(['cover', 'banner'])->loadCount('products'))]);
    }

    public function destroy(Collection $collection): JsonResponse
    {
        // Detaches products (pivot rows cascade); products themselves are untouched.
        $collection->delete();
        $this->logger->log('collection.deleted', "Deleted collection {$collection->name}", $collection);

        return response()->json(null, 204);
    }

    /** Assign products and their display order within the collection. */
    public function syncProducts(Request $request, Collection $collection): JsonResponse
    {
        $data = $request->validate([
            'product_ids' => ['present', 'array', 'max:500'],
            'product_ids.*' => ['integer', 'distinct', 'exists:products,id'],
        ]);
        DB::transaction(fn () => $collection->products()->sync(
            collect($data['product_ids'])->values()->mapWithKeys(fn ($id, $i) => [$id => ['sort_order' => $i]])->all()
        ));
        $this->logger->log('collection.products_synced', "Curated {$collection->name} (".count($data['product_ids']).' products)', $collection);

        return response()->json(['data' => ['count' => count($data['product_ids'])]]);
    }

    private function validated(Request $request, Collection $collection): array
    {
        $required = $collection->exists ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:150'],
            'slug' => ['nullable', 'string', 'max:150', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('collections')->ignore($collection->id)],
            'tagline' => ['nullable', 'string', 'max:255'],
            'story' => ['nullable', 'string', 'max:5000'],
            'cover_media_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'banner_media_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
            'is_published' => ['sometimes', 'boolean'],
            'is_featured' => ['sometimes', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:500'],
        ]);
    }

    private function present(Collection $c): array
    {
        return [
            ...$c->only(['id', 'name', 'slug', 'tagline', 'story', 'cover_media_id', 'banner_media_id', 'is_published', 'is_featured', 'sort_order', 'seo_title', 'seo_description']),
            'starts_at' => $c->starts_at?->toIso8601String(),
            'ends_at' => $c->ends_at?->toIso8601String(),
            'products_count' => $c->products_count ?? 0,
            'cover_url' => $c->relationLoaded('cover') ? $c->cover?->url('thumb') : null,
            'banner_url' => $c->relationLoaded('banner') ? $c->banner?->url('thumb') : null,
        ];
    }
}
