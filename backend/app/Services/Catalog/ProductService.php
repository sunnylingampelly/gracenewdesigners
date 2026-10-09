<?php

namespace App\Services\Catalog;

use App\Enums\Availability;
use App\Enums\PriceMode;
use App\Enums\ProductStatus;
use App\Models\Attribute;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Redirect;
use App\Models\Tag;
use App\Services\ActivityLogger;
use App\Support\HtmlSanitizer;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProductService
{
    public function __construct(
        private readonly ActivityLogger $logger,
        private readonly HtmlSanitizer $sanitizer,
    ) {}

    /** Fields copied straight from validated input onto the product row. */
    private const SCALAR_FIELDS = [
        'name', 'slug', 'sku', 'brand', 'short_description', 'description', 'department_id', 'status', 'published_at',
        'price_mode', 'price', 'compare_at_price', 'cost_price', 'currency', 'show_price', 'tax_note',
        'is_featured', 'is_new_arrival', 'is_bestseller', 'is_exclusive', 'recommendation_priority',
        'allows_custom_size', 'is_made_to_order', 'lead_time_min_days', 'lead_time_max_days', 'set_includes',
        'craftsmanship', 'care_instructions', 'delivery_notes', 'country_of_origin', 'size_chart_id',
        'seo_title', 'seo_description', 'canonical_url', 'og_media_id', 'is_indexable', 'internal_notes',
    ];

    public function create(array $data): Product
    {
        return DB::transaction(function () use ($data) {
            $product = new Product;
            $product->created_by = Auth::id();
            $this->fill($product, $data);
            $product->save();
            $this->syncRelations($product, $data);
            $this->refreshDerivedFields($product);
            $this->logger->log('product.created', "Created product {$product->name}", $product);

            return $product;
        });
    }

    public function update(Product $product, array $data): Product
    {
        return DB::transaction(function () use ($product, $data) {
            $oldSlug = $product->slug;
            $wasVisible = $product->isPubliclyVisible();

            $this->fill($product, $data);
            $changes = $this->logger->diff($product);
            $product->save();
            $this->syncRelations($product, $data);
            $this->refreshDerivedFields($product);

            if ($wasVisible && $oldSlug !== $product->slug) {
                Redirect::record("/products/{$oldSlug}", "/products/{$product->slug}");
            }

            $this->logger->log('product.updated', "Updated product {$product->name}", $product, $changes ?: null);

            return $product;
        });
    }

    private function fill(Product $product, array $data): void
    {
        $attributes = Arr::only($data, self::SCALAR_FIELDS);

        if (array_key_exists('description', $attributes)) {
            $attributes['description'] = $this->sanitizer->clean($attributes['description']);
        }
        if (array_key_exists('slug', $attributes) || ! $product->exists) {
            $requested = $attributes['slug'] ?? null;
            $attributes['slug'] = $this->uniqueSlug($requested ?: ($attributes['name'] ?? $product->name), $product->id);
        }
        if (isset($attributes['sku'])) {
            $attributes['sku'] = Str::upper(trim($attributes['sku']));
        }

        $product->fill($attributes);
        $product->updated_by = Auth::id();
        $this->normalizePublishing($product);
    }

    /** Keep status and published_at consistent with each other. */
    private function normalizePublishing(Product $product): void
    {
        if ($product->status === ProductStatus::Published && $product->published_at === null) {
            $product->published_at = now();
        }
        if ($product->status === ProductStatus::Published && $product->published_at->isFuture()) {
            $product->status = ProductStatus::Scheduled;
        }
        if ($product->status === ProductStatus::Scheduled && $product->published_at === null) {
            throw ValidationException::withMessages(['published_at' => 'A publish date is required to schedule a product.']);
        }
    }

    private function uniqueSlug(string $value, ?int $ignoreId): string
    {
        $base = Str::slug($value) ?: Str::lower(Str::random(8));
        $slug = $base;
        $i = 2;
        while (Product::withTrashed()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }

    private function syncRelations(Product $product, array $data): void
    {
        if (array_key_exists('category_ids', $data)) {
            $primary = $data['primary_category_id'] ?? ($data['category_ids'][0] ?? null);
            $product->categories()->sync(collect($data['category_ids'])->mapWithKeys(fn ($id) => [
                $id => ['is_primary' => (int) $id === (int) $primary],
            ])->all());
            if (! $product->department_id && $primary) {
                $product->forceFill(['department_id' => Category::query()->whereKey($primary)->value('department_id')])->saveQuietly();
            }
        }
        if (array_key_exists('collection_ids', $data)) {
            $existing = $product->collections()->pluck('collection_product.sort_order', 'collections.id');
            $product->collections()->sync(collect($data['collection_ids'])->mapWithKeys(fn ($id) => [
                $id => ['sort_order' => $existing[$id] ?? 0],
            ])->all());
        }
        if (array_key_exists('occasion_ids', $data)) {
            $product->occasions()->sync($data['occasion_ids']);
        }
        if (array_key_exists('tags', $data)) {
            $tagIds = collect($data['tags'])->filter()->map(function (string $name) {
                $name = trim($name);

                return Tag::query()->firstOrCreate(['slug' => Str::slug($name)], ['name' => $name])->id;
            });
            $product->tags()->sync($tagIds->all());
        }
        if (array_key_exists('variants', $data)) {
            $this->syncVariants($product, $data['variants']);
        }
        if (array_key_exists('media', $data)) {
            $product->media()->delete();
            foreach (array_values($data['media']) as $i => $item) {
                $product->media()->create([
                    'media_asset_id' => $item['media_asset_id'],
                    'role' => $item['role'] ?? 'gallery',
                    'alt_text' => $item['alt_text'] ?? null,
                    'color_value_id' => $item['color_value_id'] ?? null,
                    'sort_order' => $i,
                ]);
            }
        }
        if (array_key_exists('attributes', $data)) {
            $this->syncAttributes($product, $data['attributes']);
        }
        foreach (['related_product_ids' => 'related', 'complete_the_look_ids' => 'complete_the_look'] as $key => $type) {
            if (array_key_exists($key, $data)) {
                DB::table('product_relations')->where('product_id', $product->id)->where('type', $type)->delete();
                $rows = collect($data[$key])->reject(fn ($id) => (int) $id === $product->id)->unique()->values()
                    ->map(fn ($id, $i) => ['product_id' => $product->id, 'related_product_id' => $id, 'type' => $type, 'sort_order' => $i]);
                DB::table('product_relations')->insert($rows->all());
            }
        }
    }

    /**
     * Upsert the size/colour matrix. Duplicate combinations are rejected rather than silently merged.
     */
    private function syncVariants(Product $product, array $variants): void
    {
        $seen = [];
        foreach ($variants as $i => $variant) {
            $key = ProductVariant::combinationKey($variant['size_value_id'] ?? null, $variant['color_value_id'] ?? null);
            if (isset($seen[$key])) {
                throw ValidationException::withMessages([
                    "variants.$i.size_value_id" => 'This size and colour combination is listed more than once.',
                ]);
            }
            $seen[$key] = true;
        }

        $keepIds = [];
        foreach (array_values($variants) as $i => $input) {
            $attributes = Arr::only($input, [
                'sku', 'size_value_id', 'color_value_id', 'price', 'compare_at_price', 'stock_quantity',
                'stock_policy', 'low_stock_threshold', 'media_asset_id', 'is_active',
            ]);
            $attributes['sku'] = Str::upper(trim($attributes['sku']));
            $attributes['sort_order'] = $i;

            $variant = isset($input['id'])
                ? $product->variants()->whereKey($input['id'])->first()
                : null;
            $variant ??= $product->variants()
                ->where('combination_key', ProductVariant::combinationKey($input['size_value_id'] ?? null, $input['color_value_id'] ?? null))
                ->first();
            $variant ??= new ProductVariant(['product_id' => $product->id]);

            $variant->fill($attributes);
            $variant->product_id = $product->id;
            $variant->save();
            $keepIds[] = $variant->id;
        }

        $product->variants()->whereNotIn('id', $keepIds)->delete();
    }

    private function syncAttributes(Product $product, array $attributes): void
    {
        $product->attributeValues()->delete();
        $definitions = Attribute::query()->whereIn('id', array_column($attributes, 'attribute_id'))->get()->keyBy('id');

        foreach ($attributes as $input) {
            $attribute = $definitions->get($input['attribute_id']);
            if (! $attribute) {
                continue;
            }
            if ($attribute->usesOptions()) {
                $valueIds = $attribute->values()->whereIn('id', (array) ($input['value_ids'] ?? []))->pluck('id');
                if ($attribute->type === 'select') {
                    $valueIds = $valueIds->take(1);
                }
                foreach ($valueIds as $valueId) {
                    $product->attributeValues()->create(['attribute_id' => $attribute->id, 'attribute_value_id' => $valueId]);
                }
            } elseif (filled($input['value_text'] ?? null)) {
                $product->attributeValues()->create(['attribute_id' => $attribute->id, 'value_text' => $input['value_text']]);
            }
        }
    }

    /**
     * Recompute denormalized listing fields: lowest price, stock flag and search document.
     */
    public function refreshDerivedFields(Product $product): void
    {
        $product->load(['variants.size', 'variants.color', 'categories', 'collections', 'occasions', 'tags', 'attributeValues.option']);
        $activeVariants = $product->variants->where('is_active', true);

        if ($product->price_mode === PriceMode::OnRequest) {
            $minPrice = null;
        } else {
            $prices = $activeVariants->map(fn (ProductVariant $v) => $v->effectivePrice($product))->filter(fn ($p) => $p !== null);
            $minPrice = $prices->isNotEmpty() ? $prices->min() : $product->price;
        }

        $hasStock = $activeVariants->isEmpty()
            ? true
            : $activeVariants->contains(fn (ProductVariant $v) => $v->availability()->isEnquirable());

        $searchText = collect([
            $product->sku,
            $product->short_description,
            $product->categories->pluck('name')->implode(' '),
            $product->collections->pluck('name')->implode(' '),
            $product->occasions->pluck('name')->implode(' '),
            $product->tags->pluck('name')->implode(' '),
            $activeVariants->map(fn ($v) => $v->color?->label)->filter()->unique()->implode(' '),
            $product->attributeValues->map(fn ($v) => $v->displayValue())->implode(' '),
        ])->filter()->implode(' ');

        Product::withoutTimestamps(fn () => $product->forceFill([
            'min_price' => $minPrice,
            'has_stock' => $hasStock,
            'search_text' => Str::limit(strip_tags($searchText), 4000, ''),
        ])->saveQuietly());
    }

    public function duplicate(Product $source): Product
    {
        return DB::transaction(function () use ($source) {
            $source->load(['categories', 'collections', 'occasions', 'tags', 'variants', 'media', 'attributeValues']);

            $copy = $source->replicate(['slug', 'sku', 'view_count', 'enquiry_count', 'published_at', 'search_text']);
            $copy->name = $source->name.' (Copy)';
            $copy->slug = $this->uniqueSlug($copy->name, null);
            $copy->sku = $this->uniqueSku($source->sku.'-COPY');
            $copy->status = ProductStatus::Draft;
            $copy->published_at = null;
            $copy->created_by = Auth::id();
            $copy->updated_by = Auth::id();
            $copy->save();

            $copy->categories()->sync($source->categories->mapWithKeys(fn ($c) => [$c->id => ['is_primary' => $c->pivot->is_primary]])->all());
            $copy->collections()->sync($source->collections->pluck('id')->all());
            $copy->occasions()->sync($source->occasions->pluck('id')->all());
            $copy->tags()->sync($source->tags->pluck('id')->all());

            foreach ($source->variants as $variant) {
                $clone = $variant->replicate(['sku', 'combination_key']);
                $clone->product_id = $copy->id;
                $clone->sku = $this->uniqueVariantSku($variant->sku.'-COPY');
                $clone->save();
            }
            foreach ($source->media as $media) {
                $copy->media()->create($media->only(['media_asset_id', 'role', 'alt_text', 'color_value_id', 'sort_order']));
            }
            foreach ($source->attributeValues as $value) {
                $copy->attributeValues()->create($value->only(['attribute_id', 'attribute_value_id', 'value_text']));
            }

            $this->refreshDerivedFields($copy);
            $this->logger->log('product.duplicated', "Duplicated {$source->name} as draft", $copy, ['source_id' => $source->id]);

            return $copy;
        });
    }

    public function changeStatus(Product $product, ProductStatus $status, ?string $publishAt = null): Product
    {
        $from = $product->status;
        $product->status = $status;
        if ($status === ProductStatus::Published) {
            $product->published_at = $publishAt ? now()->parse($publishAt) : ($product->published_at && $product->published_at->isPast() ? $product->published_at : now());
        } elseif ($status === ProductStatus::Scheduled) {
            $product->published_at = now()->parse($publishAt);
        }
        if (in_array($status, [ProductStatus::Published, ProductStatus::Scheduled], true)) {
            $this->assertPublishable($product);
        }
        $this->normalizePublishing($product);
        $product->updated_by = Auth::id();
        $product->save();

        $this->logger->log('product.status_changed', "Changed {$product->name} from {$from->value} to {$product->status->value}", $product, [
            'status' => ['from' => $from->value, 'to' => $product->status->value],
        ]);

        return $product;
    }

    /** Minimum content a product needs before it can go live. */
    public function assertPublishable(Product $product): void
    {
        $errors = [];
        if ($product->categories()->count() === 0) {
            $errors['category_ids'] = 'Assign at least one category before publishing.';
        }
        if ($product->media()->count() === 0) {
            $errors['media'] = 'Add at least one image before publishing.';
        }
        if ($product->price_mode !== PriceMode::OnRequest && $product->price === null
            && $product->variants()->whereNotNull('price')->doesntExist()) {
            $errors['price'] = 'Set a price, or switch the price mode to Price on Request.';
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function uniqueSku(string $base): string
    {
        $sku = Str::upper($base);
        $i = 2;
        while (Product::withTrashed()->where('sku', $sku)->exists()) {
            $sku = Str::upper($base).'-'.$i++;
        }

        return $sku;
    }

    private function uniqueVariantSku(string $base): string
    {
        $sku = Str::upper($base);
        $i = 2;
        while (ProductVariant::query()->where('sku', $sku)->exists()) {
            $sku = Str::upper($base).'-'.$i++;
        }

        return $sku;
    }

    /** Variant availability summary used by low-stock reporting. */
    public static function isOutOfStock(ProductVariant $variant): bool
    {
        return $variant->availability() === Availability::OutOfStock;
    }
}
