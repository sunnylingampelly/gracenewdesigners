<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BillLineItem extends Model
{
    protected $fillable = [
        'sales_bill_id', 'product_variant_id',
        'description', 'qty', 'unit_price',
        'discount_pct', 'discount_amount',
        'tax_pct', 'tax_amount', 'line_total',
    ];

    protected $casts = [
        'qty'             => 'integer',
        'unit_price'      => 'decimal:2',
        'discount_pct'    => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_pct'         => 'decimal:2',
        'tax_amount'      => 'decimal:2',
        'line_total'      => 'decimal:2',
    ];

    public function bill()
    {
        return $this->belongsTo(SalesBill::class, 'sales_bill_id');
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
