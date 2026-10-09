<?php

namespace App\Http\Requests\Storefront;

use App\Services\Catalog\ProductListingService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductListingRequest extends FormRequest
{
    public function rules(): array
    {
        $list = ['nullable', 'string', 'max:500', 'regex:/^[a-z0-9\-\/,]*$/'];

        return [
            'q' => ['nullable', 'string', 'max:100'],
            'department' => ['nullable', 'string', 'max:120', 'alpha_dash'],
            'category' => ['nullable', 'string', 'max:400', 'regex:/^[a-z0-9\-\/]+$/'],
            'subcategory' => $list,
            'collection' => ['nullable', 'string', 'max:150', 'alpha_dash'],
            'collections' => $list,
            'occasion' => ['nullable', 'string', 'max:120', 'alpha_dash'],
            'occasions' => $list,
            'tag' => ['nullable', 'string', 'max:100', 'alpha_dash'],
            'size' => $list,
            'color' => $list,
            'attr' => ['nullable', 'array', 'max:10'],
            'attr.*' => $list,
            'price_min' => ['nullable', 'numeric', 'min:0'],
            'price_max' => ['nullable', 'numeric', 'min:0'],
            'availability' => ['nullable', Rule::in(['available'])],
            'fulfilment' => ['nullable', Rule::in(['made_to_order', 'ready_to_ship'])],
            'custom_size' => ['nullable', 'boolean'],
            'new' => ['nullable', 'boolean'],
            'featured' => ['nullable', 'boolean'],
            'bestseller' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::in(ProductListingService::SORTS)],
            'page' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.ProductListingService::MAX_PER_PAGE],
        ];
    }
}
