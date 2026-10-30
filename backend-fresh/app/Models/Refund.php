<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Refund extends Model
{
    protected $fillable = [
        'bill_id', 'payment_id', 'created_by', 'approved_by',
        'amount', 'mode', 'reference', 'reason', 'status',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
    ];

    public function bill()    { return $this->belongsTo(SalesBill::class, 'bill_id'); }
    public function payment() { return $this->belongsTo(Payment::class); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
    public function approver(){ return $this->belongsTo(User::class, 'approved_by'); }
}
