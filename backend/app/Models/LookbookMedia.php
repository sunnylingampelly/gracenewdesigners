<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['lookbook_id', 'media_asset_id', 'caption', 'product_id', 'collection_id', 'layout', 'sort_order'])]
class LookbookMedia extends Model
{
    protected $table = 'lookbook_media';

    public function lookbook(): BelongsTo
    {
        return $this->belongsTo(Lookbook::class);
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'media_asset_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function collection(): BelongsTo
    {
        return $this->belongsTo(Collection::class);
    }
}
