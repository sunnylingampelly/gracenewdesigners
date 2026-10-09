<?php

namespace App\Http\Resources\Storefront;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\Settings\SettingsService;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Product
 */
class ProductDetailResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $product = $this->resource;
        $variants = $this->variants->where('is_active', true)->values();
        $sizes = $variants->pluck('size')->filter()->unique('id')->sortBy('sort_order')->values();
        $colors = $variants->pluck('color')->filter()->unique('id')->sortBy('sort_order')->values();
        $category = $this->primaryCategory();
        $sizeChart = $this->sizeChart ?? $category?->sizeChart;
        $exposesPrice = $product->publicPrice() !== null;

        $attributes = $this->attributeValues
            ->filter(fn ($v) => $v->attribute?->is_visible)
            ->groupBy('attribute_id')
            ->map(fn ($values) => [
                'code' => $values->first()->attribute->code,
                'name' => $values->first()->attribute->name,
                'group' => $values->first()->attribute->group,
                'value' => $values->map->displayValue()->implode(', '),
                'sort' => $values->first()->attribute->sort_order,
            ])
            ->sortBy('sort')->map(fn ($a) => collect($a)->except('sort')->all())->values();

        $siteUrl = app(SettingsService::class)->siteUrl();

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'sku' => $this->sku,
            'name' => $this->name,
            'brand' => $this->brand,
            'url' => '/products/'.$this->slug,
            'short_description' => $this->short_description,
            'description' => $this->description,
            ...ProductCardResource::pricing($product),
            'badges' => array_values(array_filter([
                $this->is_new_arrival ? 'New' : null,
                $this->is_exclusive ? 'Exclusive' : null,
            ])),
            'department' => $this->department ? ['name' => $this->department->name, 'slug' => $this->department->slug] : null,
            'category' => $category ? ['name' => $category->name, 'path' => $category->path] : null,
            'breadcrumbs' => $category ? $category->breadcrumbTrail() : [],
            'collections' => $this->collections->map(fn ($c) => ['name' => $c->name, 'slug' => $c->slug])->values(),
            'occasions' => $this->occasions->map(fn ($o) => ['name' => $o->name, 'slug' => $o->slug])->values(),
            'tags' => $this->tags->pluck('name'),
            'gallery' => $this->media->filter(fn ($m) => $m->asset)->map(fn ($m) => [
                'id' => $m->id,
                'role' => $m->role,
                'color_code' => $m->color?->code,
                'media' => $m->asset->toPublicArray($m->alt_text ?: $this->name),
            ])->values(),
            'options' => [
                'sizes' => $sizes->map(fn ($s) => ['id' => $s->id, 'code' => $s->code, 'label' => $s->label, 'group' => $s->size_group])->values(),
                'colors' => $colors->map(fn ($c) => ['id' => $c->id, 'code' => $c->code, 'label' => $c->label, 'hex' => $c->hex])->values(),
            ],
            'variants' => $variants->map(function (ProductVariant $v) use ($product, $exposesPrice) {
                $price = $exposesPrice ? $v->effectivePrice($product) : null;
                $availability = $v->availability();

                return [
                    'id' => $v->id,
                    'sku' => $v->sku,
                    'size_id' => $v->size_value_id,
                    'color_id' => $v->color_value_id,
                    'price' => $price !== null ? (float) $price : null,
                    'price_label' => $price !== null ? Money::format($price, $product->currency) : null,
                    'compare_at_price' => $exposesPrice && $v->compare_at_price ? (float) $v->compare_at_price : null,
                    'availability' => $availability->value,
                    'availability_label' => $availability->label(),
                    'is_enquirable' => $availability->isEnquirable(),
                    'image' => $v->image?->toPublicArray($this->name),
                ];
            })->values(),
            'allows_custom_size' => $this->allows_custom_size,
            'is_made_to_order' => $this->is_made_to_order,
            'lead_time' => $this->leadTimeLabel(),
            'set_includes' => $this->set_includes,
            'craftsmanship' => $this->craftsmanship,
            'care_instructions' => $this->care_instructions,
            'delivery_notes' => $this->delivery_notes,
            'country_of_origin' => $this->country_of_origin,
            'tax_note' => $this->tax_note,
            'attributes' => $attributes,
            'size_chart' => $sizeChart ? [
                'name' => $sizeChart->name,
                'unit' => $sizeChart->unit,
                'description' => $sizeChart->description,
                'chart' => $sizeChart->chart,
                'measurement_guide' => $sizeChart->measurement_guide,
                'guide_url' => $sizeChart->guide?->url(),
            ] : null,
            'related' => ProductCardResource::collection($this->whenLoaded('relatedProducts')),
            'complete_the_look' => ProductCardResource::collection($this->whenLoaded('completeTheLook')),
            'published_at' => $this->published_at?->toIso8601String(),
            'seo' => [
                'title' => $this->seo_title ?: $this->name,
                'description' => $this->seo_description ?: ($this->short_description ? strip_tags($this->short_description) : null),
                'canonical_url' => $this->canonical_url ?: $siteUrl.'/products/'.$this->slug,
                'og_image' => ($this->ogImage ?? $this->media->first()?->asset)?->url('lg'),
                'indexable' => $this->is_indexable,
            ],
        ];
    }
}
