<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $fillable = [
        'bill_id', 'received_by', 'approved_by', 'mode', 'amount',
        'reference', 'payment_date', 'payment_time', 'status', 'notes',
    ];

    protected $casts = [
        'payment_date' => 'date',
        'amount'       => 'decimal:2',
    ];

    public function bill()       { return $this->belongsTo(SalesBill::class, 'bill_id'); }
    public function receiver()   { return $this->belongsTo(User::class, 'received_by'); }
    public function approver()   { return $this->belongsTo(User::class, 'approved_by'); }
}
