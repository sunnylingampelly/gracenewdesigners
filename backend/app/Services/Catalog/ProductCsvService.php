<?php

namespace App\Services\Catalog;

use App\Enums\PriceMode;
use App\Enums\ProductStatus;
use App\Enums\StockPolicy;
use App\Models\Attribute;
use App\Models\AttributeValue;
use App\Models\Category;
use App\Models\Collection;
use App\Models\Department;
use App\Models\Occasion;
use App\Models\Product;
use App\Models\ProductImport;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Models\ProductVariant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * CSV import/export. One row per variant; product-level columns are read from the first row of
 * each SKU group. Imports are idempotent: rows are matched on SKU, so re-importing a file updates
 * the same products instead of creating duplicates. Images are managed in the admin, not via CSV.
 */
class ProductCsvService
{
    public const COLUMNS = [
        'sku', 'name', 'slug', 'status', 'department', 'categories', 'primary_category', 'collections', 'occasions', 'tags',
        'price_mode', 'price', 'compare_at_price', 'currency', 'short_description', 'description',
        'is_featured', 'is_new_arrival', 'is_bestseller', 'is_exclusive', 'allows_custom_size', 'is_made_to_order',
        'lead_time_min_days', 'lead_time_max_days', 'set_includes', 'craftsmanship', 'care_instructions',
        'delivery_notes', 'fabric', 'work_type', 'seo_title', 'seo_description',
        'variant_sku', 'size', 'color', 'variant_price', 'stock_quantity', 'stock_policy',
    ];

    private int $baseLevel = 0;

    public function __construct(private readonly ProductService $products) {}

    /** @return iterable<array<string, mixed>> */
    public function exportRows(?array $productIds = null): iterable
    {
        $query = Product::query()
            ->with(['department', 'categories', 'collections', 'occasions', 'tags', 'variants.size', 'variants.color', 'attributeValues.attribute', 'attributeValues.option'])
            ->when($productIds, fn ($q) => $q->whereIn('id', $productIds))
            ->orderBy('id');

        foreach ($query->lazy(100) as $product) {
            $attr = fn (string $code) => $product->attributeValues->filter(fn ($v) => $v->attribute?->code === $code)
                ->map->displayValue()->implode('|');
            $base = [
                'sku' => $product->sku,
                'name' => $product->name,
                'slug' => $product->slug,
                'status' => $product->status->value,
                'department' => $product->department?->slug,
                'categories' => $product->categories->pluck('path')->implode('|'),
                'primary_category' => $product->primaryCategory()?->path,
                'collections' => $product->collections->pluck('slug')->implode('|'),
                'occasions' => $product->occasions->pluck('slug')->implode('|'),
                'tags' => $product->tags->pluck('name')->implode('|'),
                'price_mode' => $product->price_mode->value,
                'price' => $product->price,
                'compare_at_price' => $product->compare_at_price,
                'currency' => $product->currency,
                'short_description' => $product->short_description,
                'description' => $product->description,
                'is_featured' => (int) $product->is_featured,
                'is_new_arrival' => (int) $product->is_new_arrival,
                'is_bestseller' => (int) $product->is_bestseller,
                'is_exclusive' => (int) $product->is_exclusive,
                'allows_custom_size' => (int) $product->allows_custom_size,
                'is_made_to_order' => (int) $product->is_made_to_order,
                'lead_time_min_days' => $product->lead_time_min_days,
                'lead_time_max_days' => $product->lead_time_max_days,
                'set_includes' => $product->set_includes,
                'craftsmanship' => $product->craftsmanship,
                'care_instructions' => $product->care_instructions,
                'delivery_notes' => $product->delivery_notes,
                'fabric' => $attr('fabric'),
                'work_type' => $attr('work-type'),
                'seo_title' => $product->seo_title,
                'seo_description' => $product->seo_description,
            ];
            if ($product->variants->isEmpty()) {
                yield $base + array_fill_keys(['variant_sku', 'size', 'color', 'variant_price', 'stock_quantity', 'stock_policy'], null);

                continue;
            }
            foreach ($product->variants as $variant) {
                yield $base + [
                    'variant_sku' => $variant->sku,
                    'size' => $variant->size?->label,
                    'color' => $variant->color?->label,
                    'variant_price' => $variant->price,
                    'stock_quantity' => $variant->stock_quantity,
                    'stock_policy' => $variant->stock_policy->value,
                ];
            }
        }
    }

    public function templateRows(): array
    {
        return [array_combine(self::COLUMNS, [
            'GND-SAMPLE-001', 'Sample Ivory Organza Saree', '', 'draft', 'women', 'women/sarees', 'women/sarees', 'wedding-edit', 'reception|festive', 'Organza|Handwork',
            'fixed', '18500', '', 'INR', 'Short description shown near the price.', '<p>Long description.</p>',
            '0', '1', '0', '0', '0', '0', '', '', 'Saree with unstitched blouse fabric', '', 'Dry clean only.',
            '', 'Organza', 'Zardozi', '', '',
            'GND-SAMPLE-001-FS-IVR', 'Free Size', 'Ivory', '', '3', 'track',
        ])];
    }

    /**
     * Process an uploaded import. In dry-run mode nothing is written; the preview and per-row errors
     * are stored on the ProductImport record for the admin to review.
     */
    public function run(ProductImport $import): void
    {
        $import->update(['status' => 'processing', 'started_at' => now()]);
        $this->baseLevel = DB::transactionLevel();

        try {
            $rows = $this->readCsv(Storage::disk('local')->path($import->path));
            $groups = [];
            foreach ($rows as $line => $row) {
                $sku = Str::upper(trim($row['sku'] ?? ''));
                $groups[$sku][$line] = $row;
            }

            $errors = [];
            $preview = [];
            $counts = ['created' => 0, 'updated' => 0, 'skipped' => 0];

            // A dry run performs the real writes inside a transaction that is always rolled back,
            // so the preview reflects exactly what an actual import would do — with no side effects.
            if ($import->dry_run) {
                DB::beginTransaction();
            }

            foreach ($groups as $sku => $groupRows) {
                $firstLine = array_key_first($groupRows);
                try {
                    $payload = $this->buildPayload($sku, $groupRows);
                    $existing = Product::withTrashed()->where('sku', $sku)->first();
                    $action = $existing ? 'update' : 'create';

                    DB::transaction(function () use ($existing, $payload) {
                        $status = $payload['status'];
                        unset($payload['status']);
                        $product = $existing
                            ? $this->products->update($existing, $payload)
                            : $this->products->create([...$payload, 'status' => 'draft']);
                        if ($status !== $product->status->value) {
                            $this->products->changeStatus($product->fresh(), ProductStatus::from($status));
                        }
                    });
                    $counts[$action === 'create' ? 'created' : 'updated']++;
                    if (count($preview) < 50) {
                        $preview[] = ['line' => $firstLine, 'sku' => $sku, 'name' => $payload['name'], 'action' => $action, 'variants' => count($payload['variants'])];
                    }
                } catch (ValidationException $e) {
                    $counts['skipped']++;
                    foreach ($e->errors() as $field => $messages) {
                        $errors[] = ['line' => $firstLine, 'sku' => $sku ?: null, 'field' => $field, 'message' => $messages[0]];
                    }
                }
            }

            if ($import->dry_run) {
                DB::rollBack();
            }

            $import->update([
                'status' => 'completed',
                'total_rows' => count($rows),
                'created_count' => $counts['created'],
                'updated_count' => $counts['updated'],
                'skipped_count' => $counts['skipped'],
                'error_count' => count($errors),
                'row_errors' => array_slice($errors, 0, 500),
                'preview' => $preview,
                'finished_at' => now(),
            ]);
        } catch (Throwable $e) {
            while ($import->dry_run && DB::transactionLevel() > 0 && DB::transactionLevel() > $this->baseLevel) {
                DB::rollBack();
            }
            $import->update([
                'status' => 'failed',
                'row_errors' => [['line' => null, 'field' => 'file', 'message' => $e instanceof ValidationException ? collect($e->errors())->flatten()->first() : 'The file could not be processed: '.$e->getMessage()]],
                'finished_at' => now(),
            ]);
        }
    }

    /** @return array<int, array<string, string>> keyed by 1-based CSV line number */
    private function readCsv(string $path): array
    {
        $handle = fopen($path, 'r');
        if (! $handle) {
            throw ValidationException::withMessages(['file' => 'Could not open the uploaded file.']);
        }
        $header = fgetcsv($handle, escape: '\\');
        if (! $header) {
            throw ValidationException::withMessages(['file' => 'The file is empty.']);
        }
        $header = array_map(fn ($h) => Str::snake(trim(preg_replace('/^\xEF\xBB\xBF/', '', (string) $h))), $header);
        $missing = array_diff(['sku', 'name', 'price_mode'], $header);
        if ($missing) {
            throw ValidationException::withMessages(['file' => 'Missing required columns: '.implode(', ', $missing)]);
        }

        $rows = [];
        $line = 1;
        while (($data = fgetcsv($handle, escape: '\\')) !== false) {
            $line++;
            if ($data === [null] || count(array_filter($data, fn ($v) => trim((string) $v) !== '')) === 0) {
                continue;
            }
            $rows[$line] = array_combine($header, array_pad(array_slice($data, 0, count($header)), count($header), ''));
            if (count($rows) > 5000) {
                throw ValidationException::withMessages(['file' => 'Imports are limited to 5,000 rows per file.']);
            }
        }
        fclose($handle);

        return $rows;
    }

    private function buildPayload(string $sku, array $rows): array
    {
        $first = reset($rows);
        $bool = fn ($v) => in_array(Str::lower(trim((string) $v)), ['1', 'true', 'yes', 'y'], true);
        $list = fn ($v) => array_values(array_filter(array_map('trim', explode('|', (string) $v))));
        $blank = fn ($v) => trim((string) $v) === '' ? null : trim((string) $v);

        $data = [
            'sku' => $sku,
            'name' => $blank($first['name'] ?? null),
            'slug' => $blank($first['slug'] ?? null),
            'status' => Str::lower($blank($first['status'] ?? null) ?? 'draft'),
            'price_mode' => Str::lower($blank($first['price_mode'] ?? null) ?? ''),
            'price' => $blank($first['price'] ?? null),
            'compare_at_price' => $blank($first['compare_at_price'] ?? null),
            'currency' => Str::upper($blank($first['currency'] ?? null) ?? 'INR'),
            'short_description' => $blank($first['short_description'] ?? null),
            'description' => $blank($first['description'] ?? null),
            'lead_time_min_days' => $blank($first['lead_time_min_days'] ?? null),
            'lead_time_max_days' => $blank($first['lead_time_max_days'] ?? null),
            'set_includes' => $blank($first['set_includes'] ?? null),
            'craftsmanship' => $blank($first['craftsmanship'] ?? null),
            'care_instructions' => $blank($first['care_instructions'] ?? null),
            'delivery_notes' => $blank($first['delivery_notes'] ?? null),
            'seo_title' => $blank($first['seo_title'] ?? null),
            'seo_description' => $blank($first['seo_description'] ?? null),
        ];
        foreach (['is_featured', 'is_new_arrival', 'is_bestseller', 'is_exclusive', 'allows_custom_size', 'is_made_to_order'] as $flag) {
            if (array_key_exists($flag, $first)) {
                $data[$flag] = $bool($first[$flag]);
            }
        }

        Validator::make($data, [
            'sku' => ['required', 'max:64', 'regex:/^[A-Z0-9\-_]+$/'],
            'name' => ['required', 'max:200'],
            'slug' => ['nullable', 'max:200', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'status' => [Rule::enum(ProductStatus::class)],
            'price_mode' => ['required', Rule::enum(PriceMode::class)],
            'price' => ['nullable', 'numeric', 'min:0', Rule::requiredIf($data['price_mode'] === 'fixed' && collect($rows)->every(fn ($r) => trim((string) ($r['variant_price'] ?? '')) === ''))],
            'compare_at_price' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['size:3'],
            'lead_time_min_days' => ['nullable', 'integer', 'min:0'],
            'lead_time_max_days' => ['nullable', 'integer', 'min:0'],
        ], ['price.required_if' => 'A fixed price product needs a price.'])->validate();

        if ($dept = $blank($first['department'] ?? null)) {
            $data['department_id'] = Department::query()->where('slug', $dept)->value('id')
                ?? throw ValidationException::withMessages(['department' => "Unknown department “{$dept}”."]);
        }
        if (array_key_exists('categories', $first)) {
            $paths = $list($first['categories']);
            $categories = Category::query()->whereIn('path', $paths)->pluck('id', 'path');
            if ($unknown = array_diff($paths, $categories->keys()->all())) {
                throw ValidationException::withMessages(['categories' => 'Unknown category path(s): '.implode(', ', $unknown)]);
            }
            $data['category_ids'] = $categories->values()->all();
            $primary = $blank($first['primary_category'] ?? null);
            $data['primary_category_id'] = $primary ? ($categories[$primary] ?? null) : null;
        }
        if (array_key_exists('collections', $first)) {
            $slugs = $list($first['collections']);
            $found = Collection::query()->whereIn('slug', $slugs)->pluck('id', 'slug');
            if ($unknown = array_diff($slugs, $found->keys()->all())) {
                throw ValidationException::withMessages(['collections' => 'Unknown collection(s): '.implode(', ', $unknown)]);
            }
            $data['collection_ids'] = $found->values()->all();
        }
        if (array_key_exists('occasions', $first)) {
            $slugs = $list($first['occasions']);
            $found = Occasion::query()->whereIn('slug', $slugs)->pluck('id', 'slug');
            if ($unknown = array_diff($slugs, $found->keys()->all())) {
                throw ValidationException::withMessages(['occasions' => 'Unknown occasion(s): '.implode(', ', $unknown)]);
            }
            $data['occasion_ids'] = $found->values()->all();
        }
        if (array_key_exists('tags', $first)) {
            $data['tags'] = $list($first['tags']);
        }

        $attributes = [];
        foreach (['fabric' => 'fabric', 'work_type' => 'work-type'] as $column => $code) {
            if (! array_key_exists($column, $first) || ! ($attribute = Attribute::query()->where('code', $code)->first())) {
                continue;
            }
            $valueIds = collect($list($first[$column]))->map(fn ($label) => AttributeValue::query()->firstOrCreate(
                ['attribute_id' => $attribute->id, 'slug' => Str::slug($label)], ['value' => $label]
            )->id)->all();
            $attributes[] = ['attribute_id' => $attribute->id, 'value_ids' => $valueIds];
        }
        if ($attributes) {
            $existing = Product::query()->where('sku', $sku)->with('attributeValues')->first();
            $keep = $existing ? $existing->attributeValues->whereNotIn('attribute_id', array_column($attributes, 'attribute_id'))
                ->groupBy('attribute_id')->map(fn ($v, $id) => ['attribute_id' => $id, 'value_ids' => $v->pluck('attribute_value_id')->filter()->all(), 'value_text' => $v->first()->value_text])
                ->values()->all() : [];
            $data['attributes'] = [...$keep, ...$attributes];
        }

        $data['variants'] = $this->buildVariants($sku, $rows);

        return $data;
    }

    private function buildVariants(string $productSku, array $rows): array
    {
        $sizeOption = ProductOption::idFor(ProductOption::SIZE);
        $colorOption = ProductOption::idFor(ProductOption::COLOR);
        $product = Product::query()->where('sku', $productSku)->first();
        $variants = [];

        foreach ($rows as $line => $row) {
            $variantSku = Str::upper(trim((string) ($row['variant_sku'] ?? '')));
            if ($variantSku === '') {
                continue;
            }
            $clash = ProductVariant::query()->where('sku', $variantSku)
                ->when($product, fn ($q) => $q->where('product_id', '!=', $product->id))->exists();
            if ($clash) {
                throw ValidationException::withMessages(["line {$line}" => "Variant SKU {$variantSku} belongs to another product."]);
            }
            $size = trim((string) ($row['size'] ?? ''));
            $color = trim((string) ($row['color'] ?? ''));
            $policy = Str::lower(trim((string) ($row['stock_policy'] ?? ''))) ?: StockPolicy::Track->value;
            if (! StockPolicy::tryFrom($policy)) {
                throw ValidationException::withMessages(["line {$line}" => "Unknown stock policy “{$policy}”."]);
            }
            $variants[] = [
                'id' => $product?->variants()->where('sku', $variantSku)->value('id'),
                'sku' => $variantSku,
                'size_value_id' => $size !== '' ? $this->optionValue($sizeOption, $size) : null,
                'color_value_id' => $color !== '' ? $this->optionValue($colorOption, $color) : null,
                'price' => trim((string) ($row['variant_price'] ?? '')) !== '' ? (float) $row['variant_price'] : null,
                'stock_quantity' => max(0, (int) ($row['stock_quantity'] ?? 0)),
                'stock_policy' => $policy,
                'is_active' => true,
            ];
        }

        return array_map(fn ($v) => array_filter($v, fn ($value, $key) => $key !== 'id' || $value !== null, ARRAY_FILTER_USE_BOTH), $variants);
    }

    private function optionValue(int $optionId, string $label): int
    {
        return ProductOptionValue::query()->firstOrCreate(
            ['product_option_id' => $optionId, 'code' => Str::slug($label)],
            ['label' => $label, 'sort_order' => 100]
        )->id;
    }
}
