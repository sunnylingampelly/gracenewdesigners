<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\ProductImport;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProductImportTest extends TestCase
{
    private function csv(array $rows): UploadedFile
    {
        $header = ['sku', 'name', 'status', 'department', 'categories', 'price_mode', 'price', 'tags', 'fabric', 'variant_sku', 'size', 'color', 'stock_quantity', 'stock_policy'];
        $lines = [implode(',', $header)];
        foreach ($rows as $row) {
            $lines[] = implode(',', array_map(fn ($v) => '"'.str_replace('"', '""', (string) $v).'"', $row));
        }

        return UploadedFile::fake()->createWithContent('products.csv', implode("\n", $lines));
    }

    private function rows(): array
    {
        return [
            ['IMP-001', 'Imported Saree', 'draft', 'women', 'women/sarees', 'fixed', '15000', 'Silk|Festive', 'Silk', 'IMP-001-FS-GLD', 'Free Size', 'Gold', '4', 'track'],
            ['IMP-001', 'Imported Saree', 'draft', 'women', 'women/sarees', 'fixed', '15000', 'Silk|Festive', 'Silk', 'IMP-001-FS-IVR', 'Free Size', 'Ivory', '0', 'track'],
            ['IMP-002', 'Imported Gown', 'draft', 'women', 'women/gowns', 'on_request', '', '', '', 'IMP-002-M-NVY', 'M', 'Navy Blue', '0', 'made_to_order'],
            ['IMP-003', 'Broken Row', 'draft', 'women', 'women/not-a-category', 'fixed', '100', '', '', '', '', '', '', ''],
        ];
    }

    public function test_dry_run_previews_without_writing_then_commit_imports(): void
    {
        Storage::fake('local');
        $this->actingAsRole('catalog-manager');

        $dry = $this->post('/api/v1/admin/products/import', ['file' => $this->csv($this->rows()), 'dry_run' => true])->assertStatus(202)->json('data');
        $import = ProductImport::find($dry['id']);

        $this->assertSame('completed', $import->status);
        $this->assertSame(2, $import->created_count);
        $this->assertSame(1, $import->skipped_count);
        $this->assertSame('categories', $import->row_errors[0]['field']);
        $this->assertSame(5, $import->row_errors[0]['line']);
        $this->assertSame(0, Product::query()->count(), 'dry run must not write products');

        $real = $this->postJson("/api/v1/admin/products/imports/{$import->id}/commit")->assertStatus(202)->json('data');
        $this->assertSame(2, ProductImport::find($real['id'])->created_count);
        $saree = Product::query()->where('sku', 'IMP-001')->with('variants', 'tags')->first();
        $this->assertCount(2, $saree->variants);
        $this->assertEqualsCanonicalizing(['Silk', 'Festive'], $saree->tags->pluck('name')->all());
        $this->assertSame('on_request', Product::query()->where('sku', 'IMP-002')->first()->price_mode->value);
    }

    public function test_reimport_is_idempotent_and_updates_existing_rows(): void
    {
        Storage::fake('local');
        $this->actingAsRole('catalog-manager');
        $rows = array_slice($this->rows(), 0, 3);

        $this->post('/api/v1/admin/products/import', ['file' => $this->csv($rows), 'dry_run' => false])->assertStatus(202);
        $rows[0][12] = '9';
        $second = $this->post('/api/v1/admin/products/import', ['file' => $this->csv($rows), 'dry_run' => false])->json('data');

        $this->assertSame(0, ProductImport::find($second['id'])->created_count);
        $this->assertSame(2, ProductImport::find($second['id'])->updated_count);
        $this->assertSame(2, Product::query()->count());
        $this->assertSame(9, Product::query()->where('sku', 'IMP-001')->first()->variants()->where('sku', 'IMP-001-FS-GLD')->value('stock_quantity'));
    }

    public function test_export_round_trips_and_neutralizes_formulas(): void
    {
        $this->product(['name' => '=HYPERLINK("http://evil")', 'sku' => 'EXP-1']);
        $this->actingAsRole('catalog-manager');

        $csv = $this->get('/api/v1/admin/products/export')->assertOk()->streamedContent();

        $this->assertStringContainsString('EXP-1', $csv);
        $this->assertStringContainsString("'=HYPERLINK", $csv);
        $this->assertStringStartsWith("\xEF\xBB\xBFsku,name", $csv);
    }

    public function test_missing_required_columns_fail_the_import(): void
    {
        Storage::fake('local');
        $this->actingAsRole('catalog-manager');
        $file = UploadedFile::fake()->createWithContent('bad.csv', "name,price\nX,1");

        $id = $this->post('/api/v1/admin/products/import', ['file' => $file, 'dry_run' => true])->json('data.id');

        $this->assertSame('failed', ProductImport::find($id)->status);
        $this->assertStringContainsString('Missing required columns', ProductImport::find($id)->row_errors[0]['message']);
    }
}
