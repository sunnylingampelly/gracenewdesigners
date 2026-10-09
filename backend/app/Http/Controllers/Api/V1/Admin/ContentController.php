<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Lookbook;
use App\Models\NavigationItem;
use App\Models\NavigationMenu;
use App\Models\Page;
use App\Models\Redirect;
use App\Models\Testimonial;
use App\Services\ActivityLogger;
use App\Services\Content\HomepageService;
use App\Services\Content\NavigationService;
use App\Support\HtmlSanitizer;
use App\Support\PreviewToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * CMS pages, lookbooks, testimonials, navigation menus and redirects.
 */
class ContentController extends Controller
{
    public function __construct(
        private readonly ActivityLogger $logger,
        private readonly HtmlSanitizer $sanitizer,
    ) {}

    // ---- Pages ---------------------------------------------------------------------------------

    public function pages(): JsonResponse
    {
        return response()->json(['data' => Page::query()->with('hero')->orderBy('title')->get()->map(fn (Page $p) => [
            ...$p->only(['id', 'title', 'slug', 'template', 'excerpt', 'status', 'show_in_footer', 'is_indexable']),
            'published_at' => $p->published_at?->toIso8601String(),
            'updated_at' => $p->updated_at?->toIso8601String(),
        ])]);
    }

    public function page(Page $page): JsonResponse
    {
        return response()->json(['data' => [...$page->toArray(), 'hero_url' => $page->hero?->url('sm')]]);
    }

    public function savePage(Request $request, ?Page $page = null): JsonResponse
    {
        $page ??= new Page;
        $data = $request->validate([
            'title' => [$page->exists ? 'sometimes' : 'required', 'string', 'max:200'],
            'slug' => ['nullable', 'string', 'max:200', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('pages')->ignore($page->id)],
            'template' => ['sometimes', Rule::in(Page::TEMPLATES)],
            'excerpt' => ['nullable', 'string', 'max:500'],
            'body' => ['nullable', 'string', 'max:100000'],
            'hero_media_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'status' => ['sometimes', Rule::in(['draft', 'published'])],
            'published_at' => ['nullable', 'date'],
            'show_in_footer' => ['sometimes', 'boolean'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:500'],
            'is_indexable' => ['sometimes', 'boolean'],
        ]);
        if (array_key_exists('body', $data)) {
            $data['body'] = $this->sanitizer->clean($data['body']);
        }
        $oldSlug = $page->slug;
        $page->fill($data);
        $page->updated_by = $request->user()->id;
        if ($page->status === 'published' && ! $page->published_at) {
            $page->published_at = now();
        }
        $page->save();
        if ($oldSlug && $oldSlug !== $page->slug && $page->status === 'published') {
            Redirect::record("/pages/{$oldSlug}", "/pages/{$page->slug}");
        }
        $this->logger->log('page.saved', "Saved page {$page->title}", $page);

        return response()->json(['data' => $page], $page->wasRecentlyCreated ? 201 : 200);
    }

    public function destroyPage(Page $page): JsonResponse
    {
        $page->delete();
        $this->logger->log('page.deleted', "Deleted page {$page->title}", $page);

        return response()->json(null, 204);
    }

    public function pagePreviewToken(Request $request, Page $page): JsonResponse
    {
        return response()->json(['data' => ['token' => PreviewToken::issue('page:'.$page->slug, $request->user()->id), 'path' => '/pages/'.$page->slug]]);
    }

    // ---- Lookbooks -----------------------------------------------------------------------------

    public function lookbooks(): JsonResponse
    {
        return response()->json(['data' => Lookbook::query()->with('cover')->withCount('items')->orderBy('sort_order')->get()
            ->map(fn (Lookbook $l) => [...$l->only(['id', 'title', 'slug', 'season', 'status', 'sort_order', 'collection_id']),
                'items_count' => $l->items_count, 'cover_url' => $l->cover?->url('thumb'), 'published_at' => $l->published_at?->toIso8601String()])]);
    }

    public function lookbook(Lookbook $lookbook): JsonResponse
    {
        $lookbook->load(['items.asset', 'cover']);

        return response()->json(['data' => [
            ...$lookbook->only(['id', 'title', 'slug', 'season', 'description', 'cover_media_id', 'collection_id', 'status', 'sort_order', 'seo_title', 'seo_description']),
            'published_at' => $lookbook->published_at?->toIso8601String(),
            'cover_url' => $lookbook->cover?->url('sm'),
            'items' => $lookbook->items->map(fn ($i) => [
                ...$i->only(['id', 'media_asset_id', 'caption', 'product_id', 'collection_id', 'layout']),
                'thumb_url' => $i->asset?->url('thumb'),
            ]),
        ]]);
    }

    public function saveLookbook(Request $request, ?Lookbook $lookbook = null): JsonResponse
    {
        $lookbook ??= new Lookbook;
        $data = $request->validate([
            'title' => [$lookbook->exists ? 'sometimes' : 'required', 'string', 'max:200'],
            'slug' => ['nullable', 'string', 'max:200', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('lookbooks')->ignore($lookbook->id)],
            'season' => ['nullable', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:3000'],
            'cover_media_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'collection_id' => ['nullable', 'integer', 'exists:collections,id'],
            'status' => ['sometimes', Rule::in(['draft', 'published'])],
            'published_at' => ['nullable', 'date'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:500'],
            'items' => ['sometimes', 'array', 'max:60'],
            'items.*.media_asset_id' => ['required', 'integer', 'exists:media_assets,id'],
            'items.*.caption' => ['nullable', 'string', 'max:255'],
            'items.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'items.*.collection_id' => ['nullable', 'integer', 'exists:collections,id'],
            'items.*.layout' => ['nullable', Rule::in(['portrait', 'landscape', 'full'])],
        ]);

        DB::transaction(function () use ($lookbook, $data) {
            $lookbook->fill(collect($data)->except('items')->all());
            if ($lookbook->status === 'published' && ! $lookbook->published_at) {
                $lookbook->published_at = now();
            }
            $lookbook->save();
            if (array_key_exists('items', $data)) {
                $lookbook->items()->delete();
                foreach (array_values($data['items']) as $i => $item) {
                    $lookbook->items()->create([...$item, 'layout' => $item['layout'] ?? 'portrait', 'sort_order' => $i]);
                }
            }
        });
        $this->logger->log('lookbook.saved', "Saved lookbook {$lookbook->title}", $lookbook);

        return $this->lookbook($lookbook)->setStatusCode($lookbook->wasRecentlyCreated ? 201 : 200);
    }

    public function destroyLookbook(Lookbook $lookbook): JsonResponse
    {
        $lookbook->delete();

        return response()->json(null, 204);
    }

    // ---- Testimonials --------------------------------------------------------------------------

    public function testimonials(): JsonResponse
    {
        return response()->json(['data' => Testimonial::query()->with(['image', 'approver:id,name'])->orderBy('sort_order')->latest('id')->get()
            ->map(fn (Testimonial $t) => [...$t->only(['id', 'author_name', 'location', 'occasion', 'quote', 'media_asset_id', 'consent_confirmed', 'is_approved', 'sort_order']),
                'approved_by' => $t->approver?->name, 'approved_at' => $t->approved_at?->toIso8601String(), 'image_url' => $t->image?->url('thumb')])]);
    }

    public function saveTestimonial(Request $request, ?Testimonial $testimonial = null): JsonResponse
    {
        $testimonial ??= new Testimonial;
        $data = $request->validate([
            'author_name' => ['required', 'string', 'max:120'],
            'location' => ['nullable', 'string', 'max:120'],
            'occasion' => ['nullable', 'string', 'max:120'],
            'quote' => ['required', 'string', 'max:1500'],
            'media_asset_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'consent_confirmed' => ['required', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);
        $testimonial->fill($data);
        // Any edit to an approved testimonial sends it back for approval.
        if ($testimonial->exists && $testimonial->isDirty(['quote', 'author_name'])) {
            $testimonial->forceFill(['is_approved' => false, 'approved_by' => null, 'approved_at' => null]);
        }
        $testimonial->save();

        return response()->json(['data' => $testimonial], $testimonial->wasRecentlyCreated ? 201 : 200);
    }

    public function approveTestimonial(Request $request, Testimonial $testimonial): JsonResponse
    {
        $approve = $request->validate(['approved' => ['required', 'boolean']])['approved'];
        if ($approve && ! $testimonial->consent_confirmed) {
            return response()->json(['message' => 'Confirm the client’s consent before approving this testimonial.', 'errors' => ['consent_confirmed' => ['Consent is required.']]], 422);
        }
        $testimonial->forceFill([
            'is_approved' => $approve,
            'approved_by' => $approve ? $request->user()->id : null,
            'approved_at' => $approve ? now() : null,
        ])->save();
        $this->logger->log($approve ? 'testimonial.approved' : 'testimonial.unapproved', "Testimonial from {$testimonial->author_name}", $testimonial);
        app(HomepageService::class)->flush();

        return response()->json(['data' => $testimonial]);
    }

    public function destroyTestimonial(Testimonial $testimonial): JsonResponse
    {
        $testimonial->delete();
        app(HomepageService::class)->flush();

        return response()->json(null, 204);
    }

    // ---- Navigation ----------------------------------------------------------------------------

    public function menus(): JsonResponse
    {
        $menus = NavigationMenu::query()->with('items')->orderBy('id')->get();
        $tree = function ($items, $parentId) use (&$tree) {
            return $items->where('parent_id', $parentId)->sortBy('sort_order')->values()->map(fn (NavigationItem $i) => [
                ...$i->only(['id', 'label', 'link_type', 'link_id', 'url', 'group_heading', 'image_media_id', 'highlight_text', 'open_in_new_tab', 'is_active']),
                'children' => $tree($items, $i->id),
            ])->all();
        };

        return response()->json([
            'data' => $menus->map(fn (NavigationMenu $m) => ['id' => $m->id, 'name' => $m->name, 'location' => $m->location, 'items' => $tree($m->items, null)]),
            'meta' => ['link_types' => NavigationItem::LINK_TYPES, 'routes' => array_keys(NavigationItem::ROUTES)],
        ]);
    }

    public function saveMenu(Request $request, NavigationMenu $menu, NavigationService $navigation): JsonResponse
    {
        $itemRules = [
            'id' => ['nullable', 'integer'],
            'label' => ['required', 'string', 'max:120'],
            'link_type' => ['required', Rule::in(NavigationItem::LINK_TYPES)],
            'link_id' => ['nullable', 'integer'],
            'url' => ['nullable', 'string', 'max:500'],
            'group_heading' => ['nullable', 'string', 'max:120'],
            'image_media_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'highlight_text' => ['nullable', 'string', 'max:120'],
            'open_in_new_tab' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'children' => ['sometimes', 'array', 'max:40'],
        ];
        $rules = ['items' => ['present', 'array', 'max:40']];
        foreach (['items.*', 'items.*.children.*', 'items.*.children.*.children.*'] as $prefix) {
            foreach ($itemRules as $key => $rule) {
                $rules["{$prefix}.{$key}"] = $rule;
            }
        }
        $rules['items.*.children.*.children.*.children'] = ['prohibited'];
        $data = $request->validate($rules);

        $this->validateLinks($data['items']);
        $navigation->saveTree($menu, $data['items']);
        $this->logger->log('navigation.saved', "Updated menu {$menu->name}", $menu);

        return $this->menus();
    }

    /** Free-form URLs must be relative paths or https links; typed links need a target. */
    private function validateLinks(array $items, string $path = 'items'): void
    {
        foreach ($items as $i => $item) {
            $key = "{$path}.{$i}";
            if ($item['link_type'] === 'url' && filled($item['url'] ?? null) && ! preg_match('#^(/[^\s]*|https://[^\s]+|mailto:[^\s]+|tel:[^\s]+)$#', $item['url'])) {
                throw ValidationException::withMessages(["{$key}.url" => 'Use a path starting with “/” or a full https:// link.']);
            }
            if ($item['link_type'] === 'route' && ! array_key_exists($item['url'] ?? '', NavigationItem::ROUTES)) {
                throw ValidationException::withMessages(["{$key}.url" => 'Choose a storefront page.']);
            }
            if (! in_array($item['link_type'], ['url', 'route'], true) && empty($item['link_id'])) {
                throw ValidationException::withMessages(["{$key}.link_id" => 'Choose what this item links to.']);
            }
            $this->validateLinks($item['children'] ?? [], "{$key}.children");
        }
    }

    // ---- Redirects -----------------------------------------------------------------------------

    public function redirects(): JsonResponse
    {
        return response()->json(['data' => Redirect::query()->latest('id')->limit(500)->get()]);
    }

    public function saveRedirect(Request $request, ?Redirect $redirect = null): JsonResponse
    {
        $redirect ??= new Redirect;
        $data = $request->validate([
            'from_path' => ['required', 'string', 'max:500', 'regex:#^/#', Rule::unique('redirects')->ignore($redirect->id)],
            'to_path' => ['nullable', 'string', 'max:500', 'regex:#^(/|https://)#', 'different:from_path', Rule::requiredIf($request->input('status_code') != 410)],
            'status_code' => ['required', Rule::in([301, 302, 410])],
        ]);
        $data['from_path'] = Redirect::normalize($data['from_path']);
        $redirect->fill($data)->save();

        return response()->json(['data' => $redirect], $redirect->wasRecentlyCreated ? 201 : 200);
    }

    public function destroyRedirect(Redirect $redirect): JsonResponse
    {
        $redirect->delete();

        return response()->json(null, 204);
    }
}
