<?php

namespace App\Http\Controllers\Api\V1\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Lookbook;
use App\Models\LookbookMedia;
use App\Models\Page;
use App\Models\Product;
use App\Models\Redirect;
use App\Services\Content\HomepageService;
use App\Services\Content\NavigationService;
use App\Services\Settings\SettingsService;
use App\Support\PreviewToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContentController extends Controller
{
    public function __construct(private readonly SettingsService $settings) {}

    public function settings(): JsonResponse
    {
        return response()->json(['data' => $this->settings->publicSettings()]);
    }

    public function navigation(NavigationService $navigation): JsonResponse
    {
        return response()->json(['data' => $navigation->publicMenus()]);
    }

    public function homepage(Request $request, HomepageService $homepage): JsonResponse
    {
        $preview = PreviewToken::verify($request->query('preview_token'), 'homepage');

        return response()->json([
            'data' => $preview ? $homepage->preview() : $homepage->live(),
            'meta' => ['preview' => $preview],
        ]);
    }

    public function page(Request $request, string $slug): JsonResponse
    {
        $preview = PreviewToken::verify($request->query('preview_token'), 'page:'.$slug);
        $page = Page::query()->where('slug', $slug)->when(! $preview, fn ($q) => $q->publiclyVisible())->with('hero')->firstOrFail();

        return response()->json(['data' => [
            'title' => $page->title,
            'slug' => $page->slug,
            'template' => $page->template,
            'excerpt' => $page->excerpt,
            'body' => $page->body,
            'hero' => $page->hero?->toPublicArray($page->title),
            'updated_at' => $page->updated_at?->toIso8601String(),
            'seo' => [
                'title' => $page->seo_title ?: $page->title,
                'description' => $page->seo_description ?: $page->excerpt,
                'canonical_url' => $this->settings->siteUrl().'/pages/'.$page->slug,
                'indexable' => $page->is_indexable,
            ],
        ], 'meta' => ['preview' => $preview]]);
    }

    public function footerPages(): JsonResponse
    {
        return response()->json(['data' => Page::query()->publiclyVisible()->where('show_in_footer', true)
            ->orderBy('title')->get(['title', 'slug'])
            ->map(fn ($p) => ['label' => $p->title, 'url' => '/pages/'.$p->slug])]);
    }

    public function lookbooks(): JsonResponse
    {
        $lookbooks = Lookbook::query()->publiclyVisible()->with('cover')->orderBy('sort_order')->orderByDesc('published_at')->get();

        return response()->json(['data' => $lookbooks->map(fn (Lookbook $l) => [
            'title' => $l->title,
            'slug' => $l->slug,
            'url' => '/lookbook/'.$l->slug,
            'season' => $l->season,
            'description' => $l->description,
            'cover' => $l->cover?->toPublicArray($l->title),
        ])]);
    }

    public function lookbook(string $slug): JsonResponse
    {
        $lookbook = Lookbook::query()->publiclyVisible()->where('slug', $slug)
            ->with(['cover', 'collection', 'items.asset', 'items.product', 'items.collection'])->firstOrFail();

        return response()->json(['data' => [
            'title' => $lookbook->title,
            'slug' => $lookbook->slug,
            'season' => $lookbook->season,
            'description' => $lookbook->description,
            'cover' => $lookbook->cover?->toPublicArray($lookbook->title),
            'collection' => $lookbook->collection && $lookbook->collection->is_published
                ? ['name' => $lookbook->collection->name, 'url' => '/collections/'.$lookbook->collection->slug] : null,
            'items' => $lookbook->items->filter(fn (LookbookMedia $i) => $i->asset)->map(fn (LookbookMedia $i) => [
                'media' => $i->asset->toPublicArray($i->caption ?: $lookbook->title),
                'caption' => $i->caption,
                'layout' => $i->layout,
                'product' => $i->product && $i->product->isPubliclyVisible() ? ['name' => $i->product->name, 'url' => '/products/'.$i->product->slug] : null,
                'collection' => $i->collection && $i->collection->is_published ? ['name' => $i->collection->name, 'url' => '/collections/'.$i->collection->slug] : null,
            ])->values(),
            'seo' => [
                'title' => $lookbook->seo_title ?: $lookbook->title.' Lookbook',
                'description' => $lookbook->seo_description ?: $lookbook->description,
                'canonical_url' => $this->settings->siteUrl().'/lookbook/'.$lookbook->slug,
            ],
        ]]);
    }

    /**
     * Lightweight path status for the storefront proxy: redirect (301), gone (410), live or missing.
     * Only product paths are checked for liveness; other paths return redirect or "unknown".
     */
    public function pathStatus(Request $request): JsonResponse
    {
        $path = Redirect::normalize((string) $request->query('path', '/'));
        if ($redirect = Redirect::query()->where('from_path', $path)->first()) {
            $redirect->increment('hits');

            return response()->json(['data' => $redirect->status_code === 410 || ! $redirect->to_path
                ? ['status' => 'gone']
                : ['status' => 'redirect', 'to' => $redirect->to_path, 'code' => $redirect->status_code]]);
        }

        if (preg_match('#^/products/([a-z0-9-]+)$#', $path, $m)) {
            $product = Product::withTrashed()->where('slug', $m[1])->first(['id', 'status', 'published_at', 'deleted_at']);
            $status = match (true) {
                ! $product => 'missing',
                $product->trashed() || $product->status->value === 'archived' => 'gone',
                default => 'live', // drafts/scheduled resolve to 404 in the page itself (or preview)
            };

            return response()->json(['data' => ['status' => $status]]);
        }

        return response()->json(['data' => ['status' => 'unknown']]);
    }

    /** Used by the storefront's not-found handling to honour slug changes (301) and removals (410). */
    public function resolveRedirect(Request $request): JsonResponse
    {
        $path = Redirect::normalize((string) $request->query('path', '/'));
        $redirect = Redirect::query()->where('from_path', $path)->first();
        if (! $redirect) {
            return response()->json(['data' => null]);
        }
        $redirect->increment('hits');

        return response()->json(['data' => ['to' => $redirect->to_path, 'status' => $redirect->status_code]]);
    }
}
