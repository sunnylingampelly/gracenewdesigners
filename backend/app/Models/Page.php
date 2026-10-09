<?php

namespace App\Models;

use App\Models\Concerns\HasSlug;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'title', 'slug', 'template', 'excerpt', 'body', 'hero_media_id', 'status', 'published_at', 'show_in_footer',
    'seo_title', 'seo_description', 'is_indexable', 'updated_by',
])]
class Page extends Model
{
    use HasSlug, SoftDeletes;

    public const TEMPLATES = ['default', 'story', 'policy', 'contact'];

    protected function slugSource(): string
    {
        return 'title';
    }

    protected function casts(): array
    {
        return ['published_at' => 'datetime', 'show_in_footer' => 'boolean', 'is_indexable' => 'boolean'];
    }

    public function scopePubliclyVisible(Builder $query): void
    {
        $query->where('status', 'published')->where(fn ($q) => $q->whereNull('published_at')->orWhere('published_at', '<=', now()));
    }

    public function hero(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'hero_media_id');
    }
}
