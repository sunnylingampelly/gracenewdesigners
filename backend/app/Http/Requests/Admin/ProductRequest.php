<?php

namespace App\Http\Requests\Admin;

use App\Enums\PriceMode;
use App\Enums\ProductStatus;
use App\Enums\StockPolicy;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductOption;
use App\Models\ProductVariant;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        $product = $this->route('product');

        return $product
            ? $this->user()->can('update', $product)
            : $this->user()->can('create', Product::class);
    }

    public function rules(): array
    {
        $product = $this->route('product');
        $required = $product ? 'sometimes' : 'required';
        $variantIds = $product ? $product->variants()->pluck('id')->all() : [];

        return [
            'name' => [$required, 'string', 'max:200'],
            'slug' => ['nullable', 'string', 'max:200', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('products', 'slug')->ignore($product?->id)],
            'sku' => [$required, 'string', 'max:64', 'regex:/^[A-Za-z0-9\-_]+$/',
                Rule::unique('products', 'sku')->ignore($product?->id)],
            'brand' => ['nullable', 'string', 'max:120'],
            'short_description' => ['nullable', 'string', 'max:600'],
            'description' => ['nullable', 'string', 'max:20000'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'status' => ['sometimes', Rule::in([ProductStatus::Draft->value, ProductStatus::Scheduled->value, ProductStatus::Published->value, ProductStatus::Archived->value])],
            'published_at' => ['nullable', 'date'],

            'price_mode' => [$required, Rule::enum(PriceMode::class)],
            'price' => ['nullable', 'numeric', 'min:0', 'max:99999999', Rule::requiredIf(fn () => $this->input('price_mode') === PriceMode::Fixed->value && ! $this->variantsHavePrices())],
            'compare_at_price' => ['nullable', 'numeric', 'min:0', 'max:99999999', 'gte:price'],
            'cost_price' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'show_price' => ['sometimes', 'boolean'],
            'tax_note' => ['nullable', 'string', 'max:255'],

            'is_featured' => ['sometimes', 'boolean'],
            'is_new_arrival' => ['sometimes', 'boolean'],
            'is_bestseller' => ['sometimes', 'boolean'],
            'is_exclusive' => ['sometimes', 'boolean'],
            'recommendation_priority' => ['sometimes', 'integer', 'min:-100', 'max:100'],

            'allows_custom_size' => ['sometimes', 'boolean'],
            'is_made_to_order' => ['sometimes', 'boolean'],
            'lead_time_min_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'lead_time_max_days' => ['nullable', 'integer', 'min:0', 'max:365', 'gte:lead_time_min_days'],
            'set_includes' => ['nullable', 'string', 'max:255'],
            'craftsmanship' => ['nullable', 'string', 'max:5000'],
            'care_instructions' => ['nullable', 'string', 'max:3000'],
            'delivery_notes' => ['nullable', 'string', 'max:3000'],
            'country_of_origin' => ['nullable', 'string', 'max:80'],
            'size_chart_id' => ['nullable', 'integer', 'exists:size_charts,id'],

            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:500'],
            'canonical_url' => ['nullable', 'url', 'max:500'],
            'og_media_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'is_indexable' => ['sometimes', 'boolean'],
            'internal_notes' => ['nullable', 'string', 'max:5000'],

            'category_ids' => ['sometimes', 'array', 'max:20'],
            'category_ids.*' => ['integer', 'distinct', 'exists:categories,id'],
            'primary_category_id' => ['nullable', 'integer', 'in_array:category_ids.*'],
            'collection_ids' => ['sometimes', 'array', 'max:30'],
            'collection_ids.*' => ['integer', 'distinct', 'exists:collections,id'],
            'occasion_ids' => ['sometimes', 'array', 'max:20'],
            'occasion_ids.*' => ['integer', 'distinct', 'exists:occasions,id'],
            'tags' => ['sometimes', 'array', 'max:30'],
            'tags.*' => ['string', 'max:60'],

            'variants' => ['sometimes', 'array', 'max:200'],
            'variants.*.id' => ['nullable', 'integer', Rule::in($variantIds)],
            'variants.*.sku' => ['required', 'string', 'max:80', 'distinct:ignore_case', 'regex:/^[A-Za-z0-9\-_]+$/'],
            'variants.*.size_value_id' => ['nullable', 'integer', Rule::exists('product_option_values', 'id')->where('product_option_id', $this->optionId('size'))],
            'variants.*.color_value_id' => ['nullable', 'integer', Rule::exists('product_option_values', 'id')->where('product_option_id', $this->optionId('color'))],
            'variants.*.price' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'variants.*.compare_at_price' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'variants.*.stock_quantity' => ['required', 'integer', 'min:0', 'max:100000'],
            'variants.*.stock_policy' => ['required', Rule::enum(StockPolicy::class)],
            'variants.*.low_stock_threshold' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'variants.*.media_asset_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'variants.*.is_active' => ['sometimes', 'boolean'],

            'media' => ['sometimes', 'array', 'max:40'],
            'media.*.media_asset_id' => ['required', 'integer', 'exists:media_assets,id'],
            'media.*.role' => ['nullable', Rule::in(ProductMedia::ROLES)],
            'media.*.alt_text' => ['nullable', 'string', 'max:300'],
            'media.*.color_value_id' => ['nullable', 'integer', 'exists:product_option_values,id'],

            'attributes' => ['sometimes', 'array', 'max:50'],
            'attributes.*.attribute_id' => ['required', 'integer', 'exists:attributes,id'],
            'attributes.*.value_ids' => ['nullable', 'array'],
            'attributes.*.value_ids.*' => ['integer'],
            'attributes.*.value_text' => ['nullable', 'string', 'max:2000'],

            'related_product_ids' => ['sometimes', 'array', 'max:24'],
            'related_product_ids.*' => ['integer', 'exists:products,id'],
            'complete_the_look_ids' => ['sometimes', 'array', 'max:12'],
            'complete_the_look_ids.*' => ['integer', 'exists:products,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'price.required' => 'A fixed-price product needs a price (or prices on its variants).',
            'variants.*.sku.distinct' => 'Each variant needs its own SKU.',
            'variants.*.sku.required' => 'Every variant needs a SKU.',
            'compare_at_price.gte' => 'The compare-at price should be higher than the selling price.',
            'slug.regex' => 'Use lowercase letters, numbers and hyphens only.',
        ];
    }

    /** Variant SKUs must also be unique across other products. */
    public function after(): array
    {
        return [function ($validator) {
            $product = $this->route('product');
            foreach ((array) $this->input('variants', []) as $i => $variant) {
                if (empty($variant['sku'])) {
                    continue;
                }
                $clash = ProductVariant::query()
                    ->where('sku', strtoupper($variant['sku']))
                    ->when($product, fn ($q) => $q->where('product_id', '!=', $product->id))
                    ->exists();
                if ($clash) {
                    $validator->errors()->add("variants.$i.sku", 'This SKU is already used by another product.');
                }
            }
        }];
    }

    private function variantsHavePrices(): bool
    {
        $variants = (array) $this->input('variants', []);

        return $variants !== [] && collect($variants)->every(fn ($v) => isset($v['price']) && $v['price'] !== '');
    }

    private function optionId(string $code): int
    {
        return ProductOption::idFor($code);
    }
}
