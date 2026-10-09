<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Genuine client testimonials. Only approved entries with confirmed consent are ever published.
 */
#[Fillable(['author_name', 'location', 'occasion', 'quote', 'media_asset_id', 'consent_confirmed', 'sort_order'])]
class Testimonial extends Model
{
    protected function casts(): array
    {
        return ['consent_confirmed' => 'boolean', 'is_approved' => 'boolean', 'approved_at' => 'datetime'];
    }

    public function scopePublishable(Builder $query): void
    {
        $query->where('is_approved', true)->where('consent_confirmed', true)->orderBy('sort_order');
    }

    public function image(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'media_asset_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
