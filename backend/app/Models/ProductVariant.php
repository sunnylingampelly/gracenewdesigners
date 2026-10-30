<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductVariant extends Model
{
    protected $fillable = [
        'product_id', 'sku', 'size', 'color', 'fit', 'location',
        'cost_price', 'selling_price', 'tax_category',
        'opening_qty', 'qty_on_hand', 'qty_reserved', 'qty_damaged',
        'reorder_threshold', 'is_active',
    ];

    protected $casts = [
        'cost_price'    => 'decimal:2',
        'selling_price' => 'decimal:2',
        'is_active'     => 'boolean',
    ];

    public function product()        { return $this->belongsTo(Product::class); }
    public function stockMovements() { return $this->hasMany(StockMovement::class, 'variant_id'); }

    public function getAvailableQtyAttribute(): int
    {
        return max(0, $this->qty_on_hand - $this->qty_reserved);
    }

    public function isLowStock(): bool
    {
        return $this->qty_on_hand <= $this->reorder_threshold;
    }
}
