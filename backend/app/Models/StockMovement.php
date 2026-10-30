<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockMovement extends Model
{
    protected $fillable = [
        'variant_id', 'created_by', 'approved_by', 'location',
        'movement_type', 'quantity', 'qty_before', 'qty_after',
        'reference_type', 'reference_id', 'reason', 'status', 'posted_at',
    ];

    protected $casts = ['posted_at' => 'datetime'];

    public function variant()  { return $this->belongsTo(ProductVariant::class, 'variant_id'); }
    public function creator()  { return $this->belongsTo(User::class, 'created_by'); }
    public function approver() { return $this->belongsTo(User::class, 'approved_by'); }

    public function reference()
    {
        return $this->morphTo('reference');
    }
}
