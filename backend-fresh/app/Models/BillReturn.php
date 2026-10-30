<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BillReturn extends Model
{
    protected $table = 'returns';

    protected $fillable = [
        'sales_bill_id', 'product_variant_id',
        'qty', 'reason', 'condition', 'processed_by',
    ];

    public function bill()
    {
        return $this->belongsTo(SalesBill::class, 'sales_bill_id');
    }

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function processedBy()
    {
        return $this->belongsTo(User::class, 'processed_by');
    }
}
