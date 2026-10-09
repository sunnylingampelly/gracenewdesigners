<?php

namespace App\Models;

use App\Enums\SectionType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'page_key', 'type', 'name', 'draft_config', 'draft_sort_order', 'draft_is_enabled', 'config', 'sort_order',
    'is_enabled', 'is_published', 'pending_removal', 'starts_at', 'ends_at', 'published_at', 'updated_by',
])]
class HomepageSection extends Model
{
    protected function casts(): array
    {
        return [
            'type' => SectionType::class,
            'draft_config' => 'array',
            'config' => 'array',
            'draft_is_enabled' => 'boolean',
            'is_enabled' => 'boolean',
            'is_published' => 'boolean',
            'pending_removal' => 'boolean',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'published_at' => 'datetime',
            'sort_order' => 'integer',
            'draft_sort_order' => 'integer',
        ];
    }

    /** Sections currently live on the storefront. */
    public function scopeLive(Builder $query): void
    {
        $now = now();
        $query->where('is_published', true)
            ->where('is_enabled', true)
            ->where(fn ($q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now))
            ->orderBy('sort_order');
    }

    public function hasUnpublishedChanges(): bool
    {
        return ! $this->is_published
            || $this->pending_removal
            || $this->draft_config != $this->config
            || $this->draft_sort_order !== $this->sort_order
            || $this->draft_is_enabled !== $this->is_enabled;
    }

    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
