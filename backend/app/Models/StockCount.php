<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockCount extends Model
{
    protected $fillable = [
        'started_by', 'posted_by', 'status', 'notes', 'posted_at',
    ];

    protected $casts = ['posted_at' => 'datetime'];

    public function items()
    {
        return $this->hasMany(StockCountItem::class);
    }

    public function startedBy()
    {
        return $this->belongsTo(User::class, 'started_by');
    }
}
