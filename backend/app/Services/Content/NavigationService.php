<?php

namespace App\Services\Content;

use App\Models\Category;
use App\Models\Collection;
use App\Models\Department;
use App\Models\Lookbook;
use App\Models\NavigationItem;
use App\Models\NavigationMenu;
use App\Models\Occasion;
use App\Models\Page;
use Illuminate\Support\Collection as SupportCollection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Resolves admin-managed menus into storefront links. Items pointing at unpublished or deleted
 * targets are dropped so the storefront never renders dead links.
 */
class NavigationService
{
    public const CACHE_KEY = 'storefront.navigation.v1';

    /** @return array<string, list<array<string, mixed>>> */
    public function publicMenus(): array
    {
        return Cache::remember(self::CACHE_KEY, now()->addMinutes(10), function () {
            $menus = NavigationMenu::query()->with(['items' => fn ($q) => $q->where('is_active', true)->with('image')])->get();
            $targets = $this->resolveTargets($menus->flatMap->items);

            return $menus->mapWithKeys(fn (NavigationMenu $menu) => [
                $menu->location => $this->tree($menu->items, null, $targets),
            ])->all();
        });
    }

    public function flush(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    private function tree(SupportCollection $items, ?int $parentId, array $targets): array
    {
        return $items->where('parent_id', $parentId)->sortBy('sort_order')->values()
            ->map(function (NavigationItem $item) use ($items, $targets) {
                $url = $this->url($item, $targets);
                $children = $this->tree($items, $item->id, $targets);
                if ($url === null && $children === []) {
                    return null;
                }

                return [
                    'id' => $item->id,
                    'label' => $item->label,
                    'url' => $url,
                    'group' => $item->group_heading,
                    'highlight' => $item->highlight_text,
                    'external' => $item->open_in_new_tab,
                    'image' => $item->image?->toPublicArray($item->label),
                    'children' => $children,
                ];
            })->filter()->values()->all();
    }

    /** Batch-load every referenced target to avoid one query per menu item. */
    private function resolveTargets(SupportCollection $items): array
    {
        $ids = fn (string $type) => $items->where('link_type', $type)->pluck('link_id')->filter()->unique()->all();

        return [
            'department' => Department::query()->where('is_active', true)->whereIn('id', $ids('department'))->pluck('slug', 'id')->map(fn ($s) => '/shop/'.$s)->all(),
            'category' => Category::query()->published()->whereIn('id', $ids('category'))->pluck('path', 'id')->map(fn ($p) => '/shop/'.$p)->all(),
            'collection' => Collection::query()->visible()->whereIn('id', $ids('collection'))->pluck('slug', 'id')->map(fn ($s) => '/collections/'.$s)->all(),
            'occasion' => Occasion::query()->where('is_published', true)->whereIn('id', $ids('occasion'))->pluck('slug', 'id')->map(fn ($s) => '/occasions/'.$s)->all(),
            'page' => Page::query()->publiclyVisible()->whereIn('id', $ids('page'))->pluck('slug', 'id')->map(fn ($s) => '/pages/'.$s)->all(),
            'lookbook' => Lookbook::query()->publiclyVisible()->whereIn('id', $ids('lookbook'))->pluck('slug', 'id')->map(fn ($s) => '/lookbook/'.$s)->all(),
        ];
    }

    private function url(NavigationItem $item, array $targets): ?string
    {
        return match ($item->link_type) {
            'url' => $item->url ?: null,
            'route' => NavigationItem::ROUTES[$item->url] ?? null,
            default => $targets[$item->link_type][$item->link_id] ?? null,
        };
    }

    /**
     * Replace a menu's items with a nested tree from the admin editor.
     *
     * @param  list<array<string, mixed>>  $items
     */
    public function saveTree(NavigationMenu $menu, array $items): void
    {
        DB::transaction(function () use ($menu, $items) {
            $keep = [];
            $persist = function (array $nodes, ?int $parentId) use (&$persist, &$keep, $menu) {
                foreach (array_values($nodes) as $position => $node) {
                    $attributes = [
                        'navigation_menu_id' => $menu->id,
                        'parent_id' => $parentId,
                        'label' => $node['label'],
                        'link_type' => $node['link_type'],
                        'link_id' => $node['link_id'] ?? null,
                        'url' => $node['url'] ?? null,
                        'group_heading' => $node['group_heading'] ?? null,
                        'image_media_id' => $node['image_media_id'] ?? null,
                        'highlight_text' => $node['highlight_text'] ?? null,
                        'open_in_new_tab' => (bool) ($node['open_in_new_tab'] ?? false),
                        'is_active' => (bool) ($node['is_active'] ?? true),
                        'sort_order' => $position,
                    ];
                    $item = isset($node['id']) ? $menu->items()->whereKey($node['id'])->first() : null;
                    $item ? $item->update($attributes) : $item = $menu->items()->create($attributes);
                    $keep[] = $item->id;
                    $persist($node['children'] ?? [], $item->id);
                }
            };
            $persist($items, null);
            $menu->items()->whereNotIn('id', $keep)->delete();
        });
        $this->flush();
    }
}
