<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesBill extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'customer_id', 'created_by', 'approved_by', 'bill_number', 'bill_date',
        'subtotal', 'discount_amount', 'discount_reason', 'tax_amount', 'total_amount',
        'amount_paid', 'status', 'notes', 'is_walk_in', 'walk_in_name', 'posted_at',
    ];

    protected $casts = [
        'bill_date'       => 'date',
        'posted_at'       => 'datetime',
        'subtotal'        => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_amount'      => 'decimal:2',
        'total_amount'    => 'decimal:2',
        'amount_paid'     => 'decimal:2',
        'is_walk_in'      => 'boolean',
    ];

    public function customer()  { return $this->belongsTo(Customer::class); }
    public function creator()   { return $this->belongsTo(User::class, 'created_by'); }
    public function approver()  { return $this->belongsTo(User::class, 'approved_by'); }
    public function lineItems() { return $this->hasMany(BillLineItem::class, 'bill_id'); }
    public function payments()  { return $this->hasMany(Payment::class, 'bill_id'); }
    public function refunds()   { return $this->hasMany(Refund::class, 'bill_id'); }
    public function returns()   { return $this->hasMany(BillReturn::class, 'bill_id'); }

    public function getAmountDueAttribute(): float
    {
        return max(0, $this->total_amount - $this->amount_paid);
    }

    public function recalculateTotals(): void
    {
        $subtotal = $this->lineItems->sum('line_total');
        $this->update([
            'subtotal'     => $subtotal,
            'total_amount' => $subtotal - $this->discount_amount + $this->tax_amount,
        ]);
    }
}
