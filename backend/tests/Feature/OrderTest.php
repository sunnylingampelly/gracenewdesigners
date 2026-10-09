<?php

namespace Tests\Feature;

use App\Models\Enquiry;
use App\Models\Order;
use Tests\TestCase;

class OrderTest extends TestCase
{
    private function enquiryFor($product, int $quantity = 1): Enquiry
    {
        $this->configureWhatsApp();
        $variant = $product->variants()->where('stock_quantity', '>', 0)->orderBy('id')->first();
        $reference = $this->postJson('/api/v1/enquiries', ['type' => 'product', 'items' => [['product_id' => $product->id, 'variant_id' => $variant->id, 'quantity' => $quantity]]])
            ->assertCreated()->json('data.reference');

        return Enquiry::query()->where('reference', $reference)->first();
    }

    public function test_enquiry_converts_to_confirmed_order_and_commits_stock(): void
    {
        $product = $this->product();
        $enquiry = $this->enquiryFor($product, 2);
        $variant = $enquiry->items()->first()->variant;
        $this->assertSame(3, $variant->stock_quantity);
        $this->actingAsRole('enquiry-manager');

        $draft = $this->getJson("/api/v1/admin/enquiries/{$enquiry->id}/order-draft")->assertOk()->json('data');
        $draft['items'][0]['unit_price'] = 23500; // agreed price differs from displayed price
        $draft['shipping_amount'] = 500;

        $order = $this->postJson('/api/v1/admin/orders', $draft)->assertCreated();
        $order->assertJsonPath('data.status', 'pending_confirmation')
            ->assertJsonPath('data.payment_status', 'unpaid')
            ->assertJsonPath('data.total', '47500.00');
        $this->assertMatchesRegularExpression('/^GND-ORD-\d{6}$/', $order->json('data.reference'));
        $this->assertSame(3, $variant->fresh()->stock_quantity); // nothing committed while pending

        $id = $order->json('data.id');
        $this->patchJson("/api/v1/admin/orders/{$id}", ['status' => 'confirmed', 'payment_status' => 'partially_paid', 'amount_paid' => 20000, 'status_note' => 'Advance received by bank transfer'])
            ->assertOk()->assertJsonPath('data.status', 'confirmed')->assertJsonPath('data.balance_due', 27500);

        $this->assertSame(1, $variant->fresh()->stock_quantity);
        $this->assertSame('order_confirmed', $enquiry->fresh()->status->value);
        $this->assertDatabaseHas('order_status_histories', ['order_id' => $id, 'field' => 'payment_status', 'to_value' => 'partially_paid']);
        $this->assertDatabaseHas('analytics_events', ['event_name' => 'order_confirmed_manually']);

        // Cancelling restores the committed stock.
        $this->patchJson("/api/v1/admin/orders/{$id}", ['status' => 'cancelled'])->assertOk();
        $this->assertSame(3, $variant->fresh()->stock_quantity);
        $this->patchJson("/api/v1/admin/orders/{$id}", ['status' => 'confirmed'])->assertStatus(422);
    }

    public function test_confirmation_is_blocked_when_stock_is_insufficient(): void
    {
        $product = $this->product();
        $enquiry = $this->enquiryFor($product);
        $this->actingAsRole('enquiry-manager');
        $draft = $this->getJson("/api/v1/admin/enquiries/{$enquiry->id}/order-draft")->json('data');
        $draft['items'][0]['quantity'] = 10;

        $id = $this->postJson('/api/v1/admin/orders', $draft)->assertCreated()->json('data.id');
        $this->patchJson("/api/v1/admin/orders/{$id}", ['status' => 'confirmed'])->assertStatus(422)->assertJsonValidationErrors('status');
        $this->assertSame('pending_confirmation', Order::find($id)->status->value);
    }

    public function test_one_order_per_enquiry_and_manual_orders_without_enquiry(): void
    {
        $product = $this->product();
        $enquiry = $this->enquiryFor($product);
        $this->actingAsRole('enquiry-manager');
        $draft = $this->getJson("/api/v1/admin/enquiries/{$enquiry->id}/order-draft")->json('data');

        $this->postJson('/api/v1/admin/orders', $draft)->assertCreated();
        $this->postJson('/api/v1/admin/orders', $draft)->assertStatus(422)->assertJsonValidationErrors('enquiry_id');

        $this->postJson('/api/v1/admin/orders', ['items' => [['product_name' => 'Bespoke alteration', 'quantity' => 1, 'unit_price' => 1500]]])
            ->assertCreated()->assertJsonPath('data.enquiry', null)->assertJsonPath('data.total', '1500.00');
    }

    public function test_order_requires_agreed_prices(): void
    {
        $this->actingAsRole('enquiry-manager');

        $this->postJson('/api/v1/admin/orders', ['items' => [['product_name' => 'X', 'quantity' => 1]]])
            ->assertStatus(422)->assertJsonValidationErrors('items.0.unit_price');
    }
}
