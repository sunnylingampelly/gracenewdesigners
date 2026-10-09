<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class CategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('taxonomy.manage');
    }

    public function rules(): array
    {
        $required = $this->route('category') ? 'sometimes' : 'required';

        return [
            'department_id' => [$required, 'integer', 'exists:departments,id'],
            'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
            'name' => [$required, 'string', 'max:150'],
            'slug' => ['nullable', 'string', 'max:150', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'intro' => ['nullable', 'string', 'max:3000'],
            'banner_media_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'image_media_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'size_chart_id' => ['nullable', 'integer', 'exists:size_charts,id'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_published' => ['sometimes', 'boolean'],
            'show_in_menu' => ['sometimes', 'boolean'],
            'hide_when_empty' => ['sometimes', 'boolean'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:500'],
            'attribute_ids' => ['sometimes', 'array'],
            'attribute_ids.*' => ['integer', 'exists:attributes,id'],
        ];
    }
}
