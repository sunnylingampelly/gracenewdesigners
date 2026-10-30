<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Lead extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'customer_id', 'assigned_to', 'created_by', 'converted_bill_id',
        'name', 'phone', 'email', 'status', 'source', 'occasion',
        'product_interest', 'preferences', 'budget', 'follow_up_date',
        'lost_reason', 'notes',
    ];

    protected $casts = ['follow_up_date' => 'date', 'budget' => 'decimal:2'];

    public function customer()      { return $this->belongsTo(Customer::class); }
    public function assignee()      { return $this->belongsTo(User::class, 'assigned_to'); }
    public function creator()       { return $this->belongsTo(User::class, 'created_by'); }
    public function convertedBill() { return $this->belongsTo(SalesBill::class, 'converted_bill_id'); }
}
