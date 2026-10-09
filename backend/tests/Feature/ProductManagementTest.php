<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Redirect;
use Tests\TestCase;

class ProductManagementTest extends TestCase
{
    private function payload(array $overrides = []): array
    {
        $navy = $this->optionValue('color', 'Navy Blue')->id;
        $ivory = $this->optionValue('color', 'Ivory')->id;

        return [
            'name' => 'Midnight Blue Embroidered Lehenga Set',
            'sku' => 'GND-LH-900',
            'short_description' => 'A test lehenga.',
            'description' => '<p>Hand embroidered.</p><script>alert(1)</script><p onclick="x()">Safe</p>',
            'price_mode' => 'fixed',
            'price' => 24999,
            'category_ids' => [$this->category()->id],
            'collection_ids' => [],
            'occasion_ids' => [],
            'tags' => ['Embroidered', 'Silk'],
            'media' => [['media_asset_id' => $this->mediaAsset()->id, 'role' => 'gallery', 'alt_text' => 'Front']],
            'variants' => [
                ['sku' => 'GND-LH-900-M-NVY', 'size_value_id' => $this->optionValue('size', 'M')->id, 'color_value_id' => $navy, 'stock_quantity' => 2, 'stock_policy' => 'track'],
                ['sku' => 'GND-LH-900-L-NVY', 'size_value_id' => $this->optionValue('size', 'L')->id, 'color_value_id' => $navy, 'stock_quantity' => 0, 'stock_policy' => 'track'],
                ['sku' => 'GND-LH-900-M-IVR', 'size_value_id' => $this->optionValue('size', 'M')->id, 'color_value_id' => $ivory, 'price' => 26999, 'stock_quantity' => 1, 'stock_policy' => 'track'],
            ],
            ...$overrides,
        ];
    }

    public function test_catalog_manager_creates_a_draft_with_variants_and_relations(): void
    {
        $this->actingAsRole('catalog-manager');

        $response = $this->postJson('/api/v1/admin/products', $this->payload())->assertCreated();

        $response->assertJsonPath('data.slug', 'midnight-blue-embroidered-lehenga-set')
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonCount(3, 'data.variants')
            ->assertJsonPath('data.tags', ['Embroidered', 'Silk']);
        $product = Product::query()->where('sku', 'GND-LH-900')->first();
        $this->assertStringNotContainsString('<script', $product->description);
        $this->assertStringNotContainsString('onclick', $product->description);
        $this->assertSame('24999.00', $product->min_price);
        $this->assertTrue($product->has_stock);
        $this->assertNotNull($product->created_by);
    }

    public function test_slugs_and_skus_are_unique(): void
    {
        $this->actingAsRole('catalog-manager');
        $this->postJson('/api/v1/admin/products', $this->payload())->assertCreated();

        // Same name auto-suffixes the slug; same SKU is rejected.
        $this->postJson('/api/v1/admin/products', $this->payload(['variants' => []]))
            ->assertStatus(422)->assertJsonValidationErrors('sku');
        $second = $this->postJson('/api/v1/admin/products', $this->payload(['sku' => 'GND-LH-901', 'variants' => []]))->assertCreated();
        $this->assertSame('midnight-blue-embroidered-lehenga-set-2', $second->json('data.slug'));

        // An explicit duplicate slug is a validation error, not a silent change.
        $this->postJson('/api/v1/admin/products', $this->payload(['sku' => 'GND-LH-902', 'slug' => 'midnight-blue-embroidered-lehenga-set', 'variants' => []]))
            ->assertStatus(422)->assertJsonValidationErrors('slug');
    }

    public function test_duplicate_variant_combinations_and_foreign_variant_skus_are_rejected(): void
    {
        $this->actingAsRole('catalog-manager');
        $payload = $this->payload();
        $payload['variants'][1]['size_value_id'] = $payload['variants'][0]['size_value_id']; // two M / Navy rows

        $this->postJson('/api/v1/admin/products', $payload)->assertStatus(422)->assertJsonValidationErrors('variants.1.size_value_id');

        $this->postJson('/api/v1/admin/products', $this->payload())->assertCreated();
        $other = $this->payload(['sku' => 'GND-LH-950', 'name' => 'Other']);
        $other['variants'] = [$other['variants'][0]]; // reuses GND-LH-900-M-NVY
        $this->postJson('/api/v1/admin/products', $other)->assertStatus(422)->assertJsonValidationErrors('variants.0.sku');
    }

    public function test_size_ids_must_belong_to_the_size_option(): void
    {
        $this->actingAsRole('catalog-manager');
        $payload = $this->payload();
        $payload['variants'][0]['size_value_id'] = $this->optionValue('color', 'Gold')->id;

        $this->postJson('/api/v1/admin/products', $payload)->assertStatus(422)->assertJsonValidationErrors('variants.0.size_value_id');
    }

    public function test_publishing_requires_category_image_and_price(): void
    {
        $this->actingAsRole('catalog-manager');
        $id = $this->postJson('/api/v1/admin/products', $this->payload(['media' => [], 'category_ids' => []]))->assertCreated()->json('data.id');

        $this->postJson("/api/v1/admin/products/{$id}/status", ['status' => 'published'])
            ->assertStatus(422)->assertJsonValidationErrors(['category_ids', 'media']);
    }

    public function test_publish_schedule_archive_and_public_visibility(): void
    {
        $this->actingAsRole('catalog-manager');
        $id = $this->postJson('/api/v1/admin/products', $this->payload())->json('data.id');
        $slug = Product::find($id)->slug;

        $this->getJson("/api/v1/products/{$slug}")->assertNotFound();

        $this->postJson("/api/v1/admin/products/{$id}/status", ['status' => 'scheduled', 'published_at' => now()->addDay()->toIso8601String()])
            ->assertOk()->assertJsonPath('data.status', 'scheduled')->assertJsonPath('data.is_live', false);
        $this->getJson("/api/v1/products/{$slug}")->assertNotFound();

        $this->travel(2)->days();
        $this->artisan('catalog:publish-scheduled')->assertSuccessful();
        $this->assertSame('published', Product::find($id)->status->value);
        $this->getJson("/api/v1/products/{$slug}")->assertOk();

        $this->postJson("/api/v1/admin/products/{$id}/status", ['status' => 'archived'])->assertOk();
        $this->getJson("/api/v1/products/{$slug}")->assertStatus(410);
    }

    public function test_slug_change_on_live_product_records_a_redirect(): void
    {
        $product = $this->product(['name' => 'Original Name']);
        $this->actingAsRole('catalog-manager');

        $this->patchJson("/api/v1/admin/products/{$product->id}", ['slug' => 'renamed-design'])->assertOk();

        $this->assertDatabaseHas('redirects', ['from_path' => "/products/{$product->slug}", 'to_path' => '/products/renamed-design', 'status_code' => 301]);
        $this->getJson('/api/v1/redirects/resolve?path=/products/'.$product->slug)->assertJsonPath('data.to', '/products/renamed-design');
    }

    public function test_redirect_chains_collapse(): void
    {
        Redirect::record('/products/a', '/products/b');
        Redirect::record('/products/b', '/products/c');

        $this->assertSame('/products/c', Redirect::query()->where('from_path', '/products/a')->value('to_path'));
    }

    public function test_duplicate_creates_a_draft_copy_with_unique_skus(): void
    {
        $product = $this->product();
        $this->actingAsRole('catalog-manager');

        $copy = $this->postJson("/api/v1/admin/products/{$product->id}/duplicate")->assertCreated();

        $copy->assertJsonPath('data.status', 'draft')->assertJsonCount(3, 'data.variants');
        $this->assertNotSame($product->sku, $copy->json('data.sku'));
        $this->assertNotSame($product->slug, $copy->json('data.slug'));
        $this->assertSame($product->categories()->pluck('id')->all(), $copy->json('data.category_ids'));
    }

    public function test_soft_delete_and_restore(): void
    {
        $product = $this->product();
        $this->actingAsRole('catalog-manager');

        $this->deleteJson("/api/v1/admin/products/{$product->id}")->assertNoContent();
        $this->assertSoftDeleted($product);
        $this->getJson("/api/v1/products/{$product->slug}")->assertStatus(410);

        $this->postJson("/api/v1/admin/products/{$product->id}/restore")->assertOk()->assertJsonPath('data.status', 'draft');
        $this->assertNotSoftDeleted($product);
    }

    public function test_bulk_status_change_reports_failures(): void
    {
        $ready = $this->product([], publish: false);
        $incomplete = $this->product(['media' => [], 'sku' => 'NOIMG-1', 'variants' => []], publish: false);
        $this->actingAsRole('catalog-manager');

        $response = $this->postJson('/api/v1/admin/products/bulk', ['ids' => [$ready->id, $incomplete->id], 'action' => 'publish'])->assertOk();

        $response->assertJsonPath('data.updated', 1)->assertJsonPath('data.failed.0.id', $incomplete->id);
    }

    public function test_updating_variants_keeps_ids_and_removes_missing_rows(): void
    {
        $product = $this->product();
        $this->actingAsRole('catalog-manager');
        $variants = $this->getJson("/api/v1/admin/products/{$product->id}")->json('data.variants');

        $variants[0]['stock_quantity'] = 9;
        array_pop($variants);
        $this->patchJson("/api/v1/admin/products/{$product->id}", ['variants' => $variants])->assertOk();

        $this->assertSame(2, $product->variants()->count());
        $this->assertSame(9, $product->variants()->find($variants[0]['id'])->stock_quantity);
    }

    public function test_admin_listing_filters_by_status_and_stock(): void
    {
        $this->product();
        $this->product([], publish: false);
        $this->actingAsRole('catalog-manager');

        $this->getJson('/api/v1/admin/products?status=draft')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/admin/products?stock=out_of_stock')->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson('/api/v1/admin/products')->assertJsonPath('meta.counts.published', 1);
    }
}
