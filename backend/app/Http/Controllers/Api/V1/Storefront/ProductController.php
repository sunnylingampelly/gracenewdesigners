<?php

namespace App\Http\Controllers\Api\V1\Storefront;

use App\Http\Controllers\Controller;
use App\Http\Requests\Storefront\ProductListingRequest;
use App\Http\Resources\Storefront\ProductCardResource;
use App\Http\Resources\Storefront\ProductDetailResource;
use App\Models\Product;
use App\Services\Catalog\ProductListingService;
use App\Support\PreviewToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductController extends Controller
{
    public function __construct(private readonly ProductListingService $listing) {}

    public function index(ProductListingRequest $request): AnonymousResourceCollection
    {
        return ProductCardResource::collection($this->listing->paginate($request->validated()));
    }

    public function facets(ProductListingRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->listing->facets($request->validated())]);
    }

    public function show(Request $request, string $slug): ProductDetailResource|JsonResponse
    {
        $preview = PreviewToken::verify($request->query('preview_token'), 'product:'.$slug);

        $product = Product::query()
            ->where('slug', $slug)
            ->when(! $preview, fn ($q) => $q->publiclyVisible())
            ->with([
                'department', 'sizeChart.guide', 'ogImage',
                'categories' => fn ($q) => $q->with(['sizeChart.guide', 'parent.parent.parent']),
                'collections' => fn ($q) => $q->visible(),
                'occasions' => fn ($q) => $q->where('is_published', true),
                'tags',
                'media' => fn ($q) => $q->with(['asset', 'color']),
                'variants' => fn ($q) => $q->with(['size', 'color', 'image']),
                'attributeValues' => fn ($q) => $q->with(['attribute', 'option']),
                'relatedProducts' => fn ($q) => $q->publiclyVisible()->with(ProductListingService::cardRelations()),
                'completeTheLook' => fn ($q) => $q->publiclyVisible()->with(ProductListingService::cardRelations()),
            ])
            ->first();

        if (! $product) {
            // An archived or deleted product is "gone" (410) rather than "never existed" (404).
            $gone = Product::withTrashed()->where('slug', $slug)
                ->where(fn ($q) => $q->whereNotNull('deleted_at')->orWhere('status', 'archived'))
                ->exists();

            return response()->json(['message' => $gone ? 'This design is no longer available.' : 'Not found.'], $gone ? 410 : 404);
        }

        // Fall back to automatic recommendations from the same primary category.
        if ($product->relatedProducts->isEmpty() && ($category = $product->primaryCategory())) {
            $product->setRelation('relatedProducts', Product::query()->publiclyVisible()
                ->whereKeyNot($product->id)
                ->whereHas('categories', fn ($q) => $q->whereKey($category->id))
                ->with(ProductListingService::cardRelations())
                ->orderByDesc('recommendation_priority')->orderByDesc('published_at')
                ->limit(8)->get());
        }

        return (new ProductDetailResource($product))->additional(['meta' => ['preview' => $preview]]);
    }
}
