<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Attribute;
use App\Models\Occasion;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Models\SizeChart;
use App\Models\Tag;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Occasions, tags, option dictionaries (sizes/colours), attributes and size charts.
 */
class CatalogSetupController extends Controller
{
    public function __construct(private readonly ActivityLogger $logger) {}

    // ---- Occasions ---------------------------------------------------------------------------

    public function occasions(): JsonResponse
    {
        return response()->json(['data' => Occasion::query()->with('image')->withCount('products')->orderBy('sort_order')->get()
            ->map(fn (Occasion $o) => [...$o->only(['id', 'name', 'slug', 'description', 'image_media_id', 'sort_order', 'is_published', 'seo_title', 'seo_description']),
                'products_count' => $o->products_count, 'image_url' => $o->image?->url('thumb')])]);
    }

    public function saveOccasion(Request $request, ?Occasion $occasion = null): JsonResponse
    {
        $occasion ??= new Occasion;
        $occasion->fill($request->validate([
            'name' => [$occasion->exists ? 'sometimes' : 'required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('occasions')->ignore($occasion->id)],
            'description' => ['nullable', 'string', 'max:2000'],
            'image_media_id' => ['nullable', 'integer', 'exists:media_assets,id'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_published' => ['sometimes', 'boolean'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:500'],
        ]))->save();
        $this->logger->log('occasion.saved', "Saved occasion {$occasion->name}", $occasion);

        return response()->json(['data' => $occasion], $occasion->wasRecentlyCreated ? 201 : 200);
    }

    public function destroyOccasion(Occasion $occasion): JsonResponse
    {
        $occasion->delete();
        $this->logger->log('occasion.deleted', "Deleted occasion {$occasion->name}");

        return response()->json(null, 204);
    }

    // ---- Tags --------------------------------------------------------------------------------

    public function tags(Request $request): JsonResponse
    {
        return response()->json(['data' => Tag::query()->withCount('products')
            ->when($request->query('q'), fn ($q, $term) => $q->where('name', 'like', '%'.$term.'%'))
            ->orderBy('name')->limit(200)->get()]);
    }

    public function destroyTag(Tag $tag): JsonResponse
    {
        $tag->delete();

        return response()->json(null, 204);
    }

    // ---- Options (sizes and colours) ----------------------------------------------------------

    public function options(): JsonResponse
    {
        return response()->json(['data' => ProductOption::query()->with('values')->orderBy('sort_order')->get()]);
    }

    public function saveOptionValue(Request $request, ProductOption $option, ?ProductOptionValue $value = null): JsonResponse
    {
        $value ??= new ProductOptionValue(['product_option_id' => $option->id]);
        abort_if($value->exists && $value->product_option_id !== $option->id, 404);

        $data = $request->validate([
            'label' => ['required', 'string', 'max:80'],
            'code' => ['nullable', 'string', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('product_option_values')->where('product_option_id', $option->id)->ignore($value->id)],
            'hex' => [Rule::requiredIf($option->code === ProductOption::COLOR), 'nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'size_group' => ['nullable', 'string', 'max:60'],
            'is_custom' => ['sometimes', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);
        $value->fill($data);
        $value->product_option_id = $option->id;
        $value->save();

        return response()->json(['data' => $value], $value->wasRecentlyCreated ? 201 : 200);
    }

    public function destroyOptionValue(ProductOption $option, ProductOptionValue $value): JsonResponse
    {
        abort_if($value->product_option_id !== $option->id, 404);
        $inUse = DB::table('product_variants')->where('size_value_id', $value->id)->orWhere('color_value_id', $value->id)->count();
        if ($inUse) {
            throw ValidationException::withMessages(['value' => "“{$value->label}” is used by {$inUse} variant(s) and cannot be deleted."]);
        }
        $value->delete();

        return response()->json(null, 204);
    }

    // ---- Attributes ---------------------------------------------------------------------------

    public function attributes(): JsonResponse
    {
        return response()->json(['data' => Attribute::query()->with(['values', 'categories:id'])->orderBy('sort_order')->get()
            ->map(fn (Attribute $a) => [...$a->toArray(), 'category_ids' => $a->categories->pluck('id')])]);
    }

    public function saveAttribute(Request $request, ?Attribute $attribute = null): JsonResponse
    {
        $attribute ??= new Attribute;
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:60', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('attributes')->ignore($attribute->id)],
            'type' => ['required', Rule::in(Attribute::TYPES)],
            'group' => ['required', Rule::in(Attribute::GROUPS)],
            'is_filterable' => ['sometimes', 'boolean'],
            'is_visible' => ['sometimes', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'values' => ['sometimes', 'array', 'max:200'],
            'values.*.id' => ['nullable', 'integer'],
            'values.*.value' => ['required', 'string', 'max:150'],
            'category_ids' => ['sometimes', 'array'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
        ]);

        DB::transaction(function () use ($attribute, $data) {
            $attribute->fill(collect($data)->except(['values', 'category_ids'])->all())->save();
            if (array_key_exists('values', $data)) {
                $keep = [];
                foreach (array_values($data['values']) as $i => $input) {
                    $value = isset($input['id']) ? $attribute->values()->find($input['id']) : null;
                    $value ??= $attribute->values()->make();
                    $value->fill(['value' => $input['value'], 'slug' => null, 'sort_order' => $i])->save();
                    $keep[] = $value->id;
                }
                $attribute->values()->whereNotIn('id', $keep)->delete();
            }
            if (array_key_exists('category_ids', $data)) {
                $attribute->categories()->sync($data['category_ids']);
            }
        });
        $this->logger->log('attribute.saved', "Saved attribute {$attribute->name}", $attribute);

        return response()->json(['data' => $attribute->load('values')], $attribute->wasRecentlyCreated ? 201 : 200);
    }

    public function destroyAttribute(Attribute $attribute): JsonResponse
    {
        $attribute->delete();
        $this->logger->log('attribute.deleted', "Deleted attribute {$attribute->name}");

        return response()->json(null, 204);
    }

    // ---- Size charts --------------------------------------------------------------------------

    public function sizeCharts(): JsonResponse
    {
        return response()->json(['data' => SizeChart::query()->with('guide')->orderBy('name')->get()
            ->map(fn (SizeChart $s) => [...$s->toArray(), 'guide_url' => $s->guide?->url()])]);
    }

    public function saveSizeChart(Request $request, ?SizeChart $sizeChart = null): JsonResponse
    {
        $sizeChart ??= new SizeChart;
        $sizeChart->fill($request->validate([
            'name' => ['required', 'string', 'max:150'],
            'slug' => ['nullable', 'string', 'max:150', Rule::unique('size_charts')->ignore($sizeChart->id)],
            'description' => ['nullable', 'string', 'max:2000'],
            'unit' => ['required', Rule::in(['in', 'cm'])],
            'chart' => ['nullable', 'array'],
            'chart.columns' => ['required_with:chart', 'array', 'min:1', 'max:12'],
            'chart.columns.*' => ['string', 'max:40'],
            'chart.rows' => ['required_with:chart', 'array', 'max:40'],
            'chart.rows.*' => ['array'],
            'chart.rows.*.*' => ['nullable', 'string', 'max:40'],
            'measurement_guide' => ['nullable', 'string', 'max:5000'],
            'guide_media_id' => ['nullable', 'integer', 'exists:media_assets,id'],
        ]))->save();

        return response()->json(['data' => $sizeChart], $sizeChart->wasRecentlyCreated ? 201 : 200);
    }

    public function destroySizeChart(SizeChart $sizeChart): JsonResponse
    {
        $sizeChart->delete();

        return response()->json(null, 204);
    }
}
