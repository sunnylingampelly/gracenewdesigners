<?php

namespace Tests\Feature;

use Tests\TestCase;

class DashboardTest extends TestCase
{
    public function test_dashboard_separates_measured_and_confirmed_figures(): void
    {
        $this->configureWhatsApp();
        $product = $this->product();
        $variant = $product->variants()->where('stock_quantity', '>', 0)->first();
        $this->postJson('/api/v1/enquiries', ['type' => 'product', 'items' => [['product_id' => $product->id, 'variant_id' => $variant->id, 'quantity' => 1]]])->assertCreated();
        $this->actingAsRole('administrator');

        $this->getJson('/api/v1/admin/dashboard')->assertOk()
            ->assertJsonPath('data.measured.enquiry_intents_today', 1)
            ->assertJsonPath('data.confirmed.orders_confirmed_month', 0)
            ->assertJsonPath('data.catalogue.live_products', 1);
    }

    public function test_reports_return_daily_series_for_each_range(): void
    {
        $this->configureWhatsApp();
        $product = $this->product();
        $variant = $product->variants()->where('stock_quantity', '>', 0)->first();
        $this->postJson('/api/v1/enquiries', ['type' => 'product', 'items' => [['product_id' => $product->id, 'variant_id' => $variant->id, 'quantity' => 1]]])->assertCreated();
        $this->actingAsRole('administrator');

        foreach ([7, 30, 90, 365] as $days) {
            $response = $this->getJson("/api/v1/admin/reports?days={$days}")->assertOk()->assertJsonCount($days, 'data.enquiries_by_day');
            $this->assertSame(1, collect($response->json('data.enquiries_by_day'))->sum('count'));
        }
        $this->getJson('/api/v1/admin/reports?days=13')->assertStatus(422);
    }

    public function test_reports_require_permission(): void
    {
        $this->actingAsRole('content-editor');
        $this->getJson('/api/v1/admin/reports')->assertForbidden();
    }
}
