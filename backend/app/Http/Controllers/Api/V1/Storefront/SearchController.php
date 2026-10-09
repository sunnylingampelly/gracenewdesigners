<?php

namespace App\Http\Controllers\Api\V1\Storefront;

use App\Http\Controllers\Controller;
use App\Http\Resources\Storefront\ProductCardResource;
use App\Models\Category;
use App\Models\Collection;
use App\Models\Product;
use App\Services\Catalog\ProductListingService;
use App\Services\Search\SearchEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function __construct(
        private readonly ProductListingService $listing,
        private readonly SearchEngine $search,
    ) {}

    /** Full results page: paginated products plus spelling correction when nothing matched. */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'sort' => ['nullable', 'in:'.implode(',', ProductListingService::SORTS)],
        ]);

        $term = $validated['q'];
        $results = $this->listing->paginate(['q' => $term, 'sort' => $validated['sort'] ?? 'recommended', 'per_page' => 24]);
        $correctedTo = null;

        if ($results->total() === 0 && ($correction = $this->search->suggestCorrection($term))) {
            $corrected = $this->listing->paginate(['q' => $correction, 'sort' => $validated['sort'] ?? 'recommended', 'per_page' => 24]);
            if ($corrected->total() > 0) {
                [$results, $correctedTo] = [$corrected, $correction];
            }
        }

        $payload = ProductCardResource::collection($results)->response()->getData(true);
        $payload['meta']['query'] = $term;
        $payload['meta']['corrected_query'] = $correctedTo;

        if ($results->total() === 0) {
            $payload['meta']['recommendations'] = ProductCardResource::collection(
                Product::query()->publiclyVisible()->with(ProductListingService::cardRelations())
                    ->orderByDesc('is_bestseller')->orderByDesc('is_featured')->orderByDesc('published_at')->limit(8)->get()
            )->resolve();
        }

        return response()->json($payload);
    }

    /** Lightweight, debounced type-ahead suggestions. */
    public function suggest(Request $request): JsonResponse
    {
        $term = (string) $request->validate(['q' => ['required', 'string', 'min:2', 'max:100']])['q'];
        $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $term).'%';

        $query = Product::query()->publiclyVisible()->with(ProductListingService::cardRelations());
        $products = $this->search->constrain($query, $term)->limit(6)->get();
        if ($products->isEmpty() && ($correction = $this->search->suggestCorrection($term))) {
            $products = $this->search->constrain(Product::query()->publiclyVisible()->with(ProductListingService::cardRelations()), $correction)->limit(6)->get();
        }

        return response()->json(['data' => [
            'products' => ProductCardResource::collection($products)->resolve(),
            'categories' => Category::query()->published()->where('name', 'like', $like)->orderBy('depth')->limit(5)->get(['name', 'path'])
                ->map(fn ($c) => ['label' => $c->name, 'url' => '/shop/'.$c->path, 'context' => ucwords(str_replace(['/', '-'], [' › ', ' '], dirname($c->path)))]),
            'collections' => Collection::query()->visible()->where('name', 'like', $like)->limit(4)->get(['name', 'slug'])
                ->map(fn ($c) => ['label' => $c->name, 'url' => '/collections/'.$c->slug]),
            'corrected_query' => $correction ?? null,
        ]]);
    }
}
