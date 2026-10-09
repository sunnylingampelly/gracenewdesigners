<?php

namespace Tests\Feature;

use App\Models\Category;
use Tests\TestCase;

class StorefrontCatalogTest extends TestCase
{
    public function test_only_published_products_are_listed(): void
    {
        $live = $this->product(['name' => 'Live Design']);
        $this->product(['name' => 'Draft Design'], publish: false);

        $this->getJson('/api/v1/products')->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.slug', $live->slug);
    }

    public function test_public_payloads_never_expose_internal_fields(): void
    {
        $product = $this->product();

        foreach (["/api/v1/products/{$product->slug}", '/api/v1/products'] as $url) {
            $body = $this->getJson($url)->assertOk()->getContent();
            $this->assertStringNotContainsString('secret internal note', $body);
            $this->assertStringNotContainsString('cost_price', $body);
            $this->assertStringNotContainsString('9000', $body);
            $this->assertStringNotContainsString('stock_quantity', $body);
            $this->assertStringNotContainsString('internal_notes', $body);
        }
    }

    public function test_price_on_request_never_reveals_a_number(): void
    {
        $product = $this->product(['price_mode' => 'on_request', 'price' => 99999]);

        $this->getJson("/api/v1/products/{$product->slug}")->assertOk()
            ->assertJsonPath('data.price', null)
            ->assertJsonPath('data.price_label', 'Price on Request')
            ->assertJsonPath('data.cta_label', 'Request Price on WhatsApp')
            ->assertJsonPath('data.variants.0.price', null);
        $this->assertStringNotContainsString('99999', $this->getJson('/api/v1/products')->getContent());
    }

    public function test_cta_labels_follow_price_mode(): void
    {
        $fixed = $this->product(['price_mode' => 'fixed']);
        $starting = $this->product(['price_mode' => 'starting_from']);

        $this->getJson("/api/v1/products/{$fixed->slug}")->assertJsonPath('data.cta_label', 'Order on WhatsApp')->assertJsonPath('data.price_label', '₹24,999');
        $this->getJson("/api/v1/products/{$starting->slug}")->assertJsonPath('data.cta_label', 'Enquire on WhatsApp')->assertJsonPath('data.price_label', 'From ₹24,999');
    }

    public function test_variant_matrix_reports_availability_per_combination(): void
    {
        $product = $this->product();

        $variants = collect($this->getJson("/api/v1/products/{$product->slug}")->json('data.variants'));
        $l = $this->optionValue('size', 'L')->id;
        $outOfStock = $variants->firstWhere('size_id', $l);

        $this->assertSame('out_of_stock', $outOfStock['availability']);
        $this->assertFalse($outOfStock['is_enquirable']);
        // L only exists in navy: there is no L / Ivory variant to imply availability.
        $this->assertNull($variants->first(fn ($v) => $v['size_id'] === $l && $v['color_id'] === $this->optionValue('color', 'Ivory')->id));
    }

    public function test_category_filter_includes_descendant_categories(): void
    {
        $parent = $this->category('women/lehengas');
        $child = Category::query()->create(['department_id' => $parent->department_id, 'parent_id' => $parent->id, 'name' => 'Velvet Lehengas']);
        $this->assertSame('women/lehengas/velvet-lehengas', $child->path);
        $inChild = $this->product(['category_ids' => [$child->id]]);
        $this->product(['category_ids' => [$this->category('women/sarees')->id]]);

        $this->getJson('/api/v1/products?category=women/lehengas')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $inChild->id);
        $this->getJson('/api/v1/categories/women/lehengas/velvet-lehengas')->assertOk()->assertJsonCount(3, 'data.breadcrumbs');
    }

    public function test_size_colour_price_and_availability_filters(): void
    {
        $a = $this->product(['price' => 10000]);
        $b = $this->product(['price' => 50000, 'variants' => [[
            'sku' => 'ONLY-XS-GOLD', 'size_value_id' => $this->optionValue('size', 'XS')->id,
            'color_value_id' => $this->optionValue('color', 'Gold')->id, 'stock_quantity' => 0, 'stock_policy' => 'track',
        ]]]);

        $this->getJson('/api/v1/products?size=xs')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $b->id);
        $this->getJson('/api/v1/products?color=navy-blue')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $a->id);
        $this->getJson('/api/v1/products?price_min=20000')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $b->id);
        $this->getJson('/api/v1/products?availability=available')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $a->id);
        $this->getJson('/api/v1/products?sort=price_desc')->assertJsonPath('data.0.id', $b->id);
        $this->getJson('/api/v1/products?sort=price_asc')->assertJsonPath('data.0.id', $a->id);
    }

    public function test_price_on_request_sorts_last(): void
    {
        $this->product(['price' => 5000]);
        $onRequest = $this->product(['price_mode' => 'on_request', 'price' => null]);

        $this->assertSame($onRequest->id, collect($this->getJson('/api/v1/products?sort=price_asc')->json('data'))->last()['id']);
        $this->assertSame($onRequest->id, collect($this->getJson('/api/v1/products?sort=price_desc')->json('data'))->last()['id']);
    }

    public function test_pagination_and_validation(): void
    {
        foreach (range(1, 5) as $_) {
            $this->product();
        }

        $this->getJson('/api/v1/products?per_page=2&page=2')->assertOk()
            ->assertJsonCount(2, 'data')->assertJsonPath('meta.current_page', 2)->assertJsonPath('meta.last_page', 3);
        $this->getJson('/api/v1/products?per_page=500')->assertStatus(422);
        $this->getJson('/api/v1/products?sort=hacker')->assertStatus(422);
        $this->getJson("/api/v1/products?category=women/lehengas'--")->assertStatus(422);
    }

    public function test_facets_count_products_in_context(): void
    {
        $this->product();
        $this->product(['category_ids' => [$this->category('women/sarees')->id]]);

        $facets = $this->getJson('/api/v1/products/facets?department=women')->assertOk()->json('data');

        $this->assertEqualsCanonicalizing(['women/lehengas', 'women/sarees'], array_column($facets['subcategories'], 'value'));
        $this->assertSame(2, collect($facets['colors'])->firstWhere('value', 'navy-blue')['count']);
        $this->assertSame(24999.0, (float) $facets['price']['min']);
    }

    public function test_empty_categories_are_hidden_from_navigation_tree(): void
    {
        $this->product();

        $women = collect($this->getJson('/api/v1/categories')->json('data'))->firstWhere('slug', 'women');

        $this->assertSame(['women/lehengas'], array_column($women['categories'], 'path'));
    }

    public function test_search_tolerates_typos_and_suggests(): void
    {
        $this->product(['name' => 'Midnight Lehenga']);

        $this->getJson('/api/v1/search?q=lehnga')->assertOk()
            ->assertJsonPath('meta.total', 1)->assertJsonPath('meta.corrected_query', 'lehenga');
        $this->getJson('/api/v1/search/suggest?q=midn')->assertOk()->assertJsonCount(1, 'data.products');
        $this->getJson('/api/v1/search?q=zzzzzz')->assertOk()->assertJsonPath('meta.total', 0)->assertJsonStructure(['meta' => ['recommendations']]);
    }

    public function test_deleting_a_category_never_deletes_products(): void
    {
        $category = Category::query()->create(['department_id' => $this->category()->department_id, 'name' => 'Temporary']);
        $product = $this->product(['category_ids' => [$category->id, $this->category()->id]]);
        $this->actingAsRole('catalog-manager');

        $this->deleteJson("/api/v1/admin/categories/{$category->id}")->assertNoContent();
        $this->assertNotSoftDeleted($product);
        $this->assertSame([$this->category()->id], $product->categories()->pluck('categories.id')->all());
    }

    public function test_category_cannot_become_its_own_descendant(): void
    {
        $parent = $this->category();
        $child = Category::query()->create(['department_id' => $parent->department_id, 'parent_id' => $parent->id, 'name' => 'Child']);
        $this->actingAsRole('catalog-manager');

        $this->patchJson("/api/v1/admin/categories/{$parent->id}", ['parent_id' => $child->id])->assertStatus(422)->assertJsonValidationErrors('parent_id');
        $this->patchJson("/api/v1/admin/categories/{$parent->id}", ['slug' => 'lehenga-sets'])->assertOk();
        $this->assertSame('women/lehenga-sets/child', $child->fresh()->path);
    }
}
