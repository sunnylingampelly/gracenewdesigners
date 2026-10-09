<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'navigation_menu_id', 'parent_id', 'label', 'link_type', 'link_id', 'url', 'group_heading', 'image_media_id',
    'highlight_text', 'open_in_new_tab', 'is_active', 'sort_order',
])]
class NavigationItem extends Model
{
    public const LINK_TYPES = ['url', 'department', 'category', 'collection', 'occasion', 'page', 'lookbook', 'route'];

    /** Named storefront routes an item may point to without a free-form URL. */
    public const ROUTES = [
        'home' => '/',
        'shop' => '/shop',
        'new-arrivals' => '/new-arrivals',
        'collections' => '/collections',
        'occasions' => '/occasions',
        'lookbook' => '/lookbook',
        'wishlist' => '/wishlist',
        'bag' => '/bag',
        'contact' => '/contact',
        'consultation' => '/book-consultation',
        'search' => '/search',
    ];

    protected function casts(): array
    {
        return ['open_in_new_tab' => 'boolean', 'is_active' => 'boolean', 'sort_order' => 'integer'];
    }

    public function menu(): BelongsTo
    {
        return $this->belongsTo(NavigationMenu::class, 'navigation_menu_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(NavigationItem::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(NavigationItem::class, 'parent_id')->orderBy('sort_order')->orderBy('id');
    }

    public function image(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'image_media_id');
    }
}
