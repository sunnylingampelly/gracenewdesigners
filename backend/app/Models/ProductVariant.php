<?php

namespace App\Models;

use App\Enums\Availability;
use App\Enums\StockPolicy;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'product_id', 'sku', 'size_value_id', 'color_value_id', 'price', 'compare_at_price', 'stock_quantity',
    'stock_policy', 'low_stock_threshold', 'media_asset_id', 'is_active', 'sort_order',
])]
class ProductVariant extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'stock_policy' => StockPolicy::class,
            'price' => 'decimal:2',
            'compare_at_price' => 'decimal:2',
            'stock_quantity' => 'integer',
            'low_stock_threshold' => 'integer',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (ProductVariant $variant) {
            $variant->combination_key = self::combinationKey($variant->size_value_id, $variant->color_value_id);
        });
    }

    public static function combinationKey(?int $sizeId, ?int $colorId): string
    {
        return 's:'.($sizeId ?? '-').'|c:'.($colorId ?? '-');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function size(): BelongsTo
    {
        return $this->belongsTo(ProductOptionValue::class, 'size_value_id');
    }

    public function color(): BelongsTo
    {
        return $this->belongsTo(ProductOptionValue::class, 'color_value_id');
    }

    public function image(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'media_asset_id');
    }

    public function availability(): Availability
    {
        if (! $this->is_active) {
            return Availability::OutOfStock;
        }

        return match ($this->stock_policy) {
            StockPolicy::MadeToOrder => Availability::MadeToOrder,
            StockPolicy::Untracked => Availability::InStock,
            StockPolicy::Track => match (true) {
                $this->stock_quantity <= 0 => Availability::OutOfStock,
                $this->stock_quantity <= $this->low_stock_threshold => Availability::LowStock,
                default => Availability::InStock,
            },
        };
    }

    /** The price for this combination: variant override, else product price. */
    public function effectivePrice(Product $product): ?string
    {
        return $this->price ?? $product->price;
    }
}
