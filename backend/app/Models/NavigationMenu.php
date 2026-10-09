<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'location'])]
class NavigationMenu extends Model
{
    public const LOCATIONS = ['header', 'footer_shop', 'footer_house', 'footer_help', 'mobile_secondary'];

    public function items(): HasMany
    {
        return $this->hasMany(NavigationItem::class)->orderBy('sort_order')->orderBy('id');
    }

    public function rootItems(): HasMany
    {
        return $this->items()->whereNull('parent_id');
    }
}
