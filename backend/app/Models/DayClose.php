<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DayClose extends Model
{
    protected $fillable = [
        'close_date', 'closed_by', 'notes',
        'bill_count', 'gross_sales', 'net_sales', 'collected', 'summary_json',
    ];

    protected $casts = [
        'close_date'   => 'date',
        'summary_json' => 'array',
        'gross_sales'  => 'decimal:2',
        'net_sales'    => 'decimal:2',
        'collected'    => 'decimal:2',
    ];

    public function closedBy()
    {
        return $this->belongsTo(User::class, 'closed_by');
    }
}
