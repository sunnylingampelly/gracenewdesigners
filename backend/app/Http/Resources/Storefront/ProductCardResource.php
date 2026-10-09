<?php

namespace App\Http\Resources\Storefront;

use App\Enums\PriceMode;
use App\Models\Product;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Product
 */
class ProductCardResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $media = $this->relationLoaded('media') ? $this->media : collect();
        $images = $media->filter(fn ($m) => $m->asset && $m->asset->kind->value === 'image')->values();
        $colors = $this->relationLoaded('variants')
            ? $this->variants->pluck('color')->filter()->unique('id')->sortBy('sort_order')->values()
            : collect();
        $primaryCategory = $this->relationLoaded('categories') ? $this->primaryCategory() : null;

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'url' => '/products/'.$this->slug,
            'category' => $primaryCategory?->name,
            ...self::pricing($this->resource),
            'badges' => array_values(array_filter([
                $this->is_new_arrival ? 'New' : null,
                $this->is_exclusive ? 'Exclusive' : null,
                $this->is_made_to_order ? 'Made to Order' : null,
            ])),
            'image' => $images->get(0)?->asset->toPublicArray($images->get(0)->alt_text ?: $this->name),
            'hover_image' => $images->get(1)?->asset->toPublicArray($images->get(1)->alt_text ?: $this->name),
            'colors' => $colors->map(fn ($c) => ['code' => $c->code, 'label' => $c->label, 'hex' => $c->hex])->all(),
            'is_available' => (bool) $this->has_stock,
            'allows_custom_size' => (bool) $this->allows_custom_size,
        ];
    }

    /**
     * Pricing payload shared by cards and detail pages. Price-on-request products never expose a figure.
     *
     * @return array<string, mixed>
     */
    public static function pricing(Product $product): array
    {
        $price = $product->publicPrice();
        $exposes = $price !== null;
        $compare = $exposes && $product->price_mode === PriceMode::Fixed ? $product->compare_at_price : null;

        $label = match (true) {
            ! $exposes => 'Price on Request',
            $product->price_mode === PriceMode::StartingFrom => 'From '.Money::format($price, $product->currency),
            default => Money::format($price, $product->currency),
        };

        return [
            'price_mode' => $product->price_mode->value,
            'price' => $exposes ? (float) $price : null,
            'compare_at_price' => $compare !== null && (float) $compare > (float) $price ? (float) $compare : null,
            'currency' => $product->currency,
            'price_label' => $label,
            'cta_label' => $product->price_mode->ctaLabel(),
        ];
    }
}
