<?php

namespace App\Models;

use App\Models\Concerns\HasSlug;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'title', 'slug', 'season', 'description', 'cover_media_id', 'collection_id', 'status', 'published_at',
    'sort_order', 'seo_title', 'seo_description',
])]
class Lookbook extends Model
{
    use HasSlug, SoftDeletes;

    protected function slugSource(): string
    {
        return 'title';
    }

    protected function casts(): array
    {
        return ['published_at' => 'datetime', 'sort_order' => 'integer'];
    }

    public function scopePubliclyVisible(Builder $query): void
    {
        $query->where('status', 'published')->where(fn ($q) => $q->whereNull('published_at')->orWhere('published_at', '<=', now()));
    }

    public function cover(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'cover_media_id');
    }

    public function collection(): BelongsTo
    {
        return $this->belongsTo(Collection::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(LookbookMedia::class)->orderBy('sort_order')->orderBy('id');
    }
}
