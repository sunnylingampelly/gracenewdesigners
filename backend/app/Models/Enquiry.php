<?php

namespace App\Models;

use App\Enums\EnquiryStatus;
use App\Enums\EnquiryType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'reference', 'type', 'channel', 'status', 'customer_id', 'customer_message', 'measurements',
    'fitting_consultation_requested', 'preferred_date', 'display_total', 'currency', 'source_path', 'referrer_host',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'attribution_consent', 'whatsapp_number',
    'whatsapp_message', 'summary_token', 'redirect_initiated_at', 'assigned_to', 'follow_up_at', 'status_changed_at',
    'ip_hash',
])]
class Enquiry extends Model
{
    use HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return [
            'type' => EnquiryType::class,
            'status' => EnquiryStatus::class,
            'measurements' => 'encrypted:array',
            'fitting_consultation_requested' => 'boolean',
            'attribution_consent' => 'boolean',
            'preferred_date' => 'date',
            'display_total' => 'decimal:2',
            'redirect_initiated_at' => 'datetime',
            'follow_up_at' => 'datetime',
            'status_changed_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(EnquiryItem::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(EnquiryStatusHistory::class)->latest('id');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(EnquiryNote::class)->latest('id');
    }

    public function order(): HasOne
    {
        return $this->hasOne(Order::class);
    }
}
