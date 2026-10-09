<?php

namespace Tests\Feature;

use App\Models\Enquiry;
use App\Models\Role;
use App\Models\User;
use Tests\TestCase;

/**
 * Permissions are enforced server-side regardless of what the admin UI shows.
 */
class PermissionTest extends TestCase
{
    public function test_content_editor_cannot_create_or_edit_products(): void
    {
        $product = $this->product();
        $this->actingAsRole('content-editor');

        $this->getJson('/api/v1/admin/products')->assertOk(); // products.view is granted
        $this->postJson('/api/v1/admin/products', ['name' => 'X', 'sku' => 'X-1', 'price_mode' => 'on_request'])->assertForbidden();
        $this->patchJson("/api/v1/admin/products/{$product->id}", ['name' => 'Hacked'])->assertForbidden();
        $this->deleteJson("/api/v1/admin/products/{$product->id}")->assertForbidden();
    }

    public function test_enquiry_manager_cannot_publish_products_or_change_settings(): void
    {
        $product = $this->product([], publish: false);
        $this->actingAsRole('enquiry-manager');

        $this->postJson("/api/v1/admin/products/{$product->id}/status", ['status' => 'published'])->assertForbidden();
        $this->patchJson('/api/v1/admin/settings', ['brand_name' => 'Other'])->assertForbidden();
        $this->getJson('/api/v1/admin/homepage/sections')->assertForbidden();
    }

    public function test_catalog_manager_cannot_read_enquiries_or_customers(): void
    {
        $this->actingAsRole('catalog-manager');

        $this->getJson('/api/v1/admin/enquiries')->assertForbidden();
        $this->getJson('/api/v1/admin/customers')->assertForbidden();
        $this->getJson('/api/v1/admin/orders')->assertForbidden();
    }

    public function test_only_owners_manage_the_team(): void
    {
        $this->actingAsRole('administrator');
        $this->getJson('/api/v1/admin/users')->assertForbidden();
        $this->postJson('/api/v1/admin/users', ['name' => 'X', 'email' => 'x@example.com', 'role_ids' => [1]])->assertForbidden();

        $this->actingAsRole('owner');
        $this->getJson('/api/v1/admin/users')->assertOk();
    }

    public function test_owners_cannot_remove_themselves_and_an_owner_always_remains(): void
    {
        $owner = $this->actingAsRole('owner');
        $second = $this->userWithRole('owner');
        $adminRole = Role::query()->where('slug', 'administrator')->value('id');

        $this->deleteJson("/api/v1/admin/users/{$owner->id}")->assertForbidden();
        $this->patchJson("/api/v1/admin/users/{$owner->id}", ['role_ids' => [$adminRole]])->assertStatus(422);

        // Demoting another owner is fine while one active owner remains…
        $this->patchJson("/api/v1/admin/users/{$second->id}", ['role_ids' => [$adminRole]])->assertOk();

        // Inactive owners can be demoted by the remaining active owner.
        $second->roles()->sync([Role::query()->where('slug', 'owner')->value('id')]);
        $owner->update(['is_active' => false]);
        $this->actingAs($second->fresh());
        $third = $this->userWithRole('owner');
        $third->update(['is_active' => false]);
        $this->patchJson("/api/v1/admin/users/{$owner->id}", ['role_ids' => [$adminRole]])->assertOk();
        $this->assertFalse($owner->fresh()->isOwner());
    }

    public function test_deactivated_user_loses_access(): void
    {
        $user = $this->actingAsRole('catalog-manager');
        $user->update(['is_active' => false]);

        $this->getJson('/api/v1/admin/categories')->assertUnauthorized();
    }

    public function test_enquiry_manager_can_update_leads(): void
    {
        $this->configureWhatsApp();
        $product = $this->product();
        $variant = $product->variants()->where('stock_quantity', '>', 0)->first();
        $reference = $this->postJson('/api/v1/enquiries', ['type' => 'product', 'items' => [['product_id' => $product->id, 'variant_id' => $variant->id, 'quantity' => 1]]])->json('data.reference');
        $enquiry = Enquiry::query()->where('reference', $reference)->first();

        $manager = $this->actingAsRole('enquiry-manager');
        $this->patchJson("/api/v1/admin/enquiries/{$enquiry->id}", ['status' => 'contacted', 'assigned_to' => $manager->id])
            ->assertOk()->assertJsonPath('data.status', 'contacted');
    }

    public function test_user_permissions_are_reported_for_the_ui_but_not_trusted(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user); // authenticated but no role

        $this->getJson('/api/v1/admin/auth/me')->assertOk()->assertJsonPath('data.permissions', []);
        $this->getJson('/api/v1/admin/products')->assertForbidden();
        $this->getJson('/api/v1/admin/dashboard')->assertForbidden();
    }
}
