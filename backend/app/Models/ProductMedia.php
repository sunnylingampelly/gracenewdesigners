<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['product_id', 'media_asset_id', 'role', 'color_value_id', 'alt_text', 'sort_order'])]
class ProductMedia extends Model
{
    protected $table = 'product_media';

    public const ROLES = ['gallery', 'alternate', 'detail', 'video'];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'media_asset_id');
    }

    public function color(): BelongsTo
    {
        return $this->belongsTo(ProductOptionValue::class, 'color_value_id');
    }
}
