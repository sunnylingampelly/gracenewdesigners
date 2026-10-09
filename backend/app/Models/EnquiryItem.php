<?php

namespace App\Models;

use App\Enums\PriceMode;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'enquiry_id', 'product_id', 'product_variant_id', 'product_name', 'product_sku', 'variant_sku', 'size_label',
    'color_label', 'is_custom_size', 'quantity', 'price_mode', 'unit_price', 'currency', 'product_url',
])]
class EnquiryItem extends Model
{
    protected function casts(): array
    {
        return [
            'price_mode' => PriceMode::class,
            'unit_price' => 'decimal:2',
            'is_custom_size' => 'boolean',
            'quantity' => 'integer',
        ];
    }

    public function enquiry(): BelongsTo
    {
        return $this->belongsTo(Enquiry::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
