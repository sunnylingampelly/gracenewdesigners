<?php

namespace App\Models;

use App\Enums\PriceMode;
use App\Enums\ProductStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'name', 'slug', 'sku', 'brand', 'short_description', 'description', 'department_id', 'status', 'published_at',
    'price_mode', 'price', 'compare_at_price', 'cost_price', 'currency', 'show_price', 'tax_note',
    'is_featured', 'is_new_arrival', 'is_bestseller', 'is_exclusive', 'recommendation_priority',
    'allows_custom_size', 'is_made_to_order', 'lead_time_min_days', 'lead_time_max_days', 'set_includes',
    'craftsmanship', 'care_instructions', 'delivery_notes', 'country_of_origin', 'size_chart_id',
    'seo_title', 'seo_description', 'canonical_url', 'og_media_id', 'is_indexable', 'internal_notes',
])]
class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return [
            'status' => ProductStatus::class,
            'price_mode' => PriceMode::class,
            'published_at' => 'datetime',
            'price' => 'decimal:2',
            'compare_at_price' => 'decimal:2',
            'cost_price' => 'decimal:2',
            'min_price' => 'decimal:2',
            'show_price' => 'boolean',
            'is_featured' => 'boolean',
            'is_new_arrival' => 'boolean',
            'is_bestseller' => 'boolean',
            'is_exclusive' => 'boolean',
            'allows_custom_size' => 'boolean',
            'is_made_to_order' => 'boolean',
            'is_indexable' => 'boolean',
            'has_stock' => 'boolean',
            'recommendation_priority' => 'integer',
            'view_count' => 'integer',
            'enquiry_count' => 'integer',
        ];
    }

    /**
     * Products visible on the storefront: published (or scheduled and due) and not archived/deleted.
     */
    public function scopePubliclyVisible(Builder $query): void
    {
        $query->whereIn('status', [ProductStatus::Published->value, ProductStatus::Scheduled->value])
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now());
    }

    public function isPubliclyVisible(): bool
    {
        return in_array($this->status, [ProductStatus::Published, ProductStatus::Scheduled], true)
            && $this->published_at !== null
            && $this->published_at->lte(now())
            && ! $this->trashed();
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class)->withPivot(['is_primary', 'sort_order']);
    }

    public function collections(): BelongsToMany
    {
        return $this->belongsToMany(Collection::class)->withPivot('sort_order');
    }

    public function occasions(): BelongsToMany
    {
        return $this->belongsToMany(Occasion::class);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class);
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)->orderBy('sort_order')->orderBy('id');
    }

    public function media(): HasMany
    {
        return $this->hasMany(ProductMedia::class)->orderBy('sort_order')->orderBy('id');
    }

    public function attributeValues(): HasMany
    {
        return $this->hasMany(ProductAttributeValue::class);
    }

    public function sizeChart(): BelongsTo
    {
        return $this->belongsTo(SizeChart::class);
    }

    public function ogImage(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'og_media_id');
    }

    public function relatedProducts(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'product_relations', 'product_id', 'related_product_id')
            ->withPivot(['type', 'sort_order'])
            ->wherePivot('type', 'related')
            ->orderByPivot('sort_order');
    }

    public function completeTheLook(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'product_relations', 'product_id', 'related_product_id')
            ->withPivot(['type', 'sort_order'])
            ->wherePivot('type', 'complete_the_look')
            ->orderByPivot('sort_order');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function primaryCategory(): ?Category
    {
        return $this->categories->firstWhere('pivot.is_primary', true) ?? $this->categories->first();
    }

    /** Price shown publicly, or null when the price must not be exposed. */
    public function publicPrice(): ?string
    {
        if (! $this->price_mode->exposesPrice() || ! $this->show_price) {
            return null;
        }

        return $this->min_price ?? $this->price;
    }

    public function leadTimeLabel(): ?string
    {
        if (! $this->lead_time_min_days && ! $this->lead_time_max_days) {
            return null;
        }
        $min = $this->lead_time_min_days ?? $this->lead_time_max_days;
        $max = $this->lead_time_max_days ?? $this->lead_time_min_days;
        $toWeeks = fn (int $days) => max(1, (int) round($days / 7));

        return $min === $max
            ? sprintf('Approximately %d weeks', $toWeeks($min))
            : sprintf('Approximately %d–%d weeks', $toWeeks($min), $toWeeks($max));
    }
}
