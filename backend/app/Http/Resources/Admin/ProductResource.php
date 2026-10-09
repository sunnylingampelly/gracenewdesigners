<?php

namespace App\Http\Resources\Admin;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Full admin representation of a product (includes internal fields — admin API only).
 *
 * @mixin Product
 */
class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'sku' => $this->sku,
            'brand' => $this->brand,
            'short_description' => $this->short_description,
            'description' => $this->description,
            'department_id' => $this->department_id,
            'status' => $this->status->value,
            'is_live' => $this->isPubliclyVisible(),
            'published_at' => $this->published_at?->toIso8601String(),
            'price_mode' => $this->price_mode->value,
            'price' => $this->price,
            'compare_at_price' => $this->compare_at_price,
            'cost_price' => $this->cost_price,
            'currency' => $this->currency,
            'show_price' => $this->show_price,
            'tax_note' => $this->tax_note,
            'is_featured' => $this->is_featured,
            'is_new_arrival' => $this->is_new_arrival,
            'is_bestseller' => $this->is_bestseller,
            'is_exclusive' => $this->is_exclusive,
            'recommendation_priority' => $this->recommendation_priority,
            'allows_custom_size' => $this->allows_custom_size,
            'is_made_to_order' => $this->is_made_to_order,
            'lead_time_min_days' => $this->lead_time_min_days,
            'lead_time_max_days' => $this->lead_time_max_days,
            'set_includes' => $this->set_includes,
            'craftsmanship' => $this->craftsmanship,
            'care_instructions' => $this->care_instructions,
            'delivery_notes' => $this->delivery_notes,
            'country_of_origin' => $this->country_of_origin,
            'size_chart_id' => $this->size_chart_id,
            'seo_title' => $this->seo_title,
            'seo_description' => $this->seo_description,
            'canonical_url' => $this->canonical_url,
            'og_media_id' => $this->og_media_id,
            'is_indexable' => $this->is_indexable,
            'internal_notes' => $this->internal_notes,
            'category_ids' => $this->whenLoaded('categories', fn () => $this->categories->pluck('id')),
            'primary_category_id' => $this->whenLoaded('categories', fn () => $this->primaryCategory()?->id),
            'collection_ids' => $this->whenLoaded('collections', fn () => $this->collections->pluck('id')),
            'occasion_ids' => $this->whenLoaded('occasions', fn () => $this->occasions->pluck('id')),
            'tags' => $this->whenLoaded('tags', fn () => $this->tags->pluck('name')),
            'variants' => $this->whenLoaded('variants', fn () => $this->variants->map(fn (ProductVariant $v) => [
                'id' => $v->id,
                'sku' => $v->sku,
                'size_value_id' => $v->size_value_id,
                'color_value_id' => $v->color_value_id,
                'price' => $v->price,
                'compare_at_price' => $v->compare_at_price,
                'stock_quantity' => $v->stock_quantity,
                'stock_policy' => $v->stock_policy->value,
                'low_stock_threshold' => $v->low_stock_threshold,
                'media_asset_id' => $v->media_asset_id,
                'is_active' => $v->is_active,
                'availability' => $v->availability()->value,
            ])),
            'media' => $this->whenLoaded('media', fn () => $this->media->map(fn ($m) => [
                'id' => $m->id,
                'media_asset_id' => $m->media_asset_id,
                'role' => $m->role,
                'alt_text' => $m->alt_text,
                'color_value_id' => $m->color_value_id,
                'asset' => $m->asset ? new MediaAssetResource($m->asset) : null,
            ])),
            'attributes' => $this->whenLoaded('attributeValues', fn () => $this->attributeValues->groupBy('attribute_id')->map(fn ($values, $attributeId) => [
                'attribute_id' => (int) $attributeId,
                'value_ids' => $values->pluck('attribute_value_id')->filter()->values(),
                'value_text' => $values->firstWhere('value_text', '!=', null)?->value_text,
            ])->values()),
            'related_product_ids' => $this->whenLoaded('relatedProducts', fn () => $this->relatedProducts->pluck('id')),
            'complete_the_look_ids' => $this->whenLoaded('completeTheLook', fn () => $this->completeTheLook->pluck('id')),
            'view_count' => $this->view_count,
            'enquiry_count' => $this->enquiry_count,
            'created_by' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'updated_by' => $this->whenLoaded('updater', fn () => $this->updater?->name),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'deleted_at' => $this->deleted_at?->toIso8601String(),
        ];
    }
}
