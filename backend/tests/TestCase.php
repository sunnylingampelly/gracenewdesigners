<?php

namespace Tests;

use App\Enums\MediaKind;
use App\Enums\ProductStatus;
use App\Models\Category;
use App\Models\MediaAsset;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Models\Role;
use App\Models\User;
use App\Services\Catalog\ProductService;
use App\Services\Settings\SettingsService;
use Database\Seeders\CatalogFoundationSeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Str;

abstract class TestCase extends BaseTestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesAndPermissionsSeeder::class, CatalogFoundationSeeder::class]);
        $this->withHeader('Accept', 'application/json');
        // Mimic the first-party SPA so Sanctum starts a session (stateful domain).
        $this->withHeader('Referer', 'http://localhost:3000/admin');
    }

    protected function userWithRole(string $role, array $attributes = []): User
    {
        $user = User::factory()->create(['is_active' => true, ...$attributes]);
        $user->roles()->attach(Role::query()->where('slug', $role)->value('id'));

        return $user->fresh();
    }

    protected function actingAsRole(string $role): User
    {
        $user = $this->userWithRole($role);
        $this->actingAs($user);

        return $user;
    }

    protected function mediaAsset(array $attributes = []): MediaAsset
    {
        $uuid = (string) Str::uuid();

        return MediaAsset::query()->create([
            'uuid' => $uuid, 'disk' => 'public', 'path' => "media/test/{$uuid}/original.jpg",
            'original_name' => 'test.jpg', 'mime_type' => 'image/jpeg', 'extension' => 'jpg',
            'kind' => MediaKind::Image, 'size_bytes' => 1000, 'width' => 1200, 'height' => 1500,
            'checksum' => hash('sha256', $uuid), 'processing_status' => 'processed', ...$attributes,
        ]);
    }

    protected function optionValue(string $option, string $label): ProductOptionValue
    {
        return ProductOptionValue::query()
            ->where('product_option_id', ProductOption::idFor($option))
            ->where('label', $label)->firstOrFail();
    }

    protected function category(string $path = 'women/lehengas'): Category
    {
        return Category::query()->where('path', $path)->firstOrFail();
    }

    /**
     * Create a product through the real service. Variants default to M and L in Navy Blue and Ivory.
     */
    protected function product(array $overrides = [], bool $publish = true): Product
    {
        $sku = $overrides['sku'] ?? 'TST-'.Str::upper(Str::random(6));
        $variants = $overrides['variants'] ?? collect([['M', 'Navy Blue', 3], ['L', 'Navy Blue', 0], ['M', 'Ivory', 2]])
            ->map(fn ($v) => [
                'sku' => $sku.'-'.$v[0].'-'.Str::upper(Str::substr(Str::slug($v[1], ''), 0, 3)),
                'size_value_id' => $this->optionValue('size', $v[0])->id,
                'color_value_id' => $this->optionValue('color', $v[1])->id,
                'stock_quantity' => $v[2],
                'stock_policy' => 'track',
                'low_stock_threshold' => 1,
            ])->all();

        $product = app(ProductService::class)->create([
            'name' => 'Test Product '.Str::random(5),
            'sku' => $sku,
            'price_mode' => 'fixed',
            'price' => 24999,
            'currency' => 'INR',
            'status' => 'draft',
            'category_ids' => [$this->category()->id],
            'media' => [['media_asset_id' => $this->mediaAsset()->id, 'role' => 'gallery']],
            'internal_notes' => 'secret internal note',
            'cost_price' => 9000,
            ...collect($overrides)->except('variants')->all(),
            'variants' => $variants,
        ]);

        if ($publish) {
            app(ProductService::class)->changeStatus($product, ProductStatus::Published);
        }

        return $product->fresh();
    }

    protected function configureWhatsApp(?string $number = '+919876543210'): void
    {
        app(SettingsService::class)->update(['whatsapp_business_number' => $number, 'site_url' => 'https://shop.example.test']);
    }
}
