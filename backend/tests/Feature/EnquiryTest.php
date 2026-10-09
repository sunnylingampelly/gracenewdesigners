<?php

namespace Tests\Feature;

use App\Models\Enquiry;
use App\Models\Product;
use App\Notifications\NewEnquiryNotification;
use App\Services\Settings\SettingsService;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class EnquiryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->configureWhatsApp();
    }

    private function availableVariant(Product $product)
    {
        return $product->variants()->where('stock_quantity', '>', 0)->with(['size', 'color'])->orderBy('id')->first();
    }

    public function test_product_enquiry_is_saved_before_the_whatsapp_handoff(): void
    {
        $product = $this->product(['name' => 'Midnight Blue Embroidered Lehenga Set', 'sku' => 'GND-LH-001']);
        $variant = $this->availableVariant($product);

        $response = $this->postJson('/api/v1/enquiries', [
            'type' => 'product',
            'items' => [['product_id' => $product->id, 'variant_id' => $variant->id, 'quantity' => 1]],
            'source_path' => '/products/'.$product->slug.'?utm_source=instagram',
        ])->assertCreated();

        $reference = $response->json('data.reference');
        $this->assertMatchesRegularExpression('/^GND-ENQ-\d{6}$/', $reference);
        $response->assertJsonPath('data.status', 'initiated');

        $message = $response->json('data.message');
        $this->assertStringContainsString('Hello Grace New Designers,', $message);
        $this->assertStringContainsString('Product: Midnight Blue Embroidered Lehenga Set', $message);
        $this->assertStringContainsString('Reference: GND-LH-001', $message);
        $this->assertStringContainsString("Size: {$variant->size->label}", $message);
        $this->assertStringContainsString("Color: {$variant->color->label}", $message);
        $this->assertStringContainsString('Quantity: 1', $message);
        $this->assertStringContainsString('Displayed Price: ₹24,999', $message);
        $this->assertStringContainsString('Product Link: https://shop.example.test/products/'.$product->slug, $message);
        $this->assertStringContainsString("Enquiry Ref: {$reference}", $message);

        $url = $response->json('data.whatsapp_url');
        $this->assertStringStartsWith('https://wa.me/919876543210?text=', $url);
        $this->assertSame($message, rawurldecode(substr($url, strlen('https://wa.me/919876543210?text='))));

        $enquiry = Enquiry::query()->where('reference', $reference)->with('items')->first();
        $this->assertSame('new', $enquiry->status->value);
        $this->assertSame('/products/'.$product->slug, $enquiry->source_path); // query string stripped
        $this->assertSame($variant->id, $enquiry->items[0]->product_variant_id);
        $this->assertSame('24999.00', $enquiry->items[0]->unit_price);
        $this->assertNull($enquiry->redirect_initiated_at);
        $this->assertSame(1, $product->fresh()->enquiry_count);
        $this->assertDatabaseHas('analytics_events', ['event_name' => 'whatsapp_enquiry_initiated', 'product_id' => $product->id]);
    }

    public function test_redirect_marker_requires_the_matching_token(): void
    {
        $product = $this->product();
        $data = $this->postJson('/api/v1/enquiries', ['type' => 'product', 'items' => [['product_id' => $product->id, 'variant_id' => $this->availableVariant($product)->id, 'quantity' => 1]]])->json('data');

        $this->postJson("/api/v1/enquiries/{$data['reference']}/redirected", ['token' => str_repeat('x', 40)])->assertNotFound();
        $this->postJson("/api/v1/enquiries/{$data['reference']}/redirected", ['token' => $data['summary_token']])->assertOk();
        $this->assertNotNull(Enquiry::query()->where('reference', $data['reference'])->value('redirect_initiated_at'));
    }

    public function test_invalid_unavailable_and_foreign_variants_are_rejected(): void
    {
        $product = $this->product();
        $other = $this->product();
        $outOfStock = $product->variants()->where('stock_quantity', 0)->first();

        $send = fn (array $item) => $this->postJson('/api/v1/enquiries', ['type' => 'product', 'items' => [['quantity' => 1, ...$item]]]);

        $send(['product_id' => $product->id])->assertStatus(422)->assertJsonValidationErrors('items.0.variant_id');
        $send(['product_id' => $product->id, 'variant_id' => $outOfStock->id])->assertStatus(422)->assertJsonValidationErrors('items.0.variant_id');
        $send(['product_id' => $product->id, 'variant_id' => $other->variants()->first()->id])->assertStatus(422)->assertJsonValidationErrors('items.0.variant_id');
        $send(['product_id' => $product->id, 'variant_id' => $this->availableVariant($product)->id, 'quantity' => 50])->assertStatus(422);
        $this->assertSame(0, Enquiry::query()->count());
    }

    public function test_unpublished_products_cannot_be_enquired(): void
    {
        $draft = $this->product([], publish: false);

        $this->postJson('/api/v1/enquiries', ['type' => 'product', 'items' => [['product_id' => $draft->id, 'variant_id' => $draft->variants()->first()->id, 'quantity' => 1]]])
            ->assertStatus(422)->assertJsonValidationErrors('items.0.product_id');
    }

    public function test_price_on_request_message_has_no_price(): void
    {
        $product = $this->product(['price_mode' => 'on_request', 'price' => 123456]);

        $data = $this->postJson('/api/v1/enquiries', ['type' => 'product', 'items' => [['product_id' => $product->id, 'variant_id' => $this->availableVariant($product)->id, 'quantity' => 1]]])
            ->assertCreated()->json('data');

        $this->assertStringNotContainsString('123', $data['message']);
        $this->assertStringNotContainsString('Displayed Price', $data['message']);
        $this->assertStringContainsString('share the price', $data['message']);
        $this->assertNull(Enquiry::query()->first()->items()->first()->unit_price);
    }

    public function test_custom_size_requests_a_fitting_consultation(): void
    {
        $plain = $this->product();
        $custom = $this->product(['allows_custom_size' => true]);
        $navy = $this->optionValue('color', 'Navy Blue')->id;

        $this->postJson('/api/v1/enquiries', ['type' => 'product', 'items' => [['product_id' => $plain->id, 'custom_size' => true, 'color_value_id' => $navy, 'quantity' => 1]]])
            ->assertStatus(422)->assertJsonValidationErrors('items.0.custom_size');

        $data = $this->postJson('/api/v1/enquiries', [
            'type' => 'product',
            'items' => [['product_id' => $custom->id, 'custom_size' => true, 'color_value_id' => $navy, 'quantity' => 1]],
            'measurements' => ['bust' => '35', 'waist' => '29'],
        ])->assertCreated()->json('data');

        $this->assertStringContainsString('Size: Custom size (fitting consultation requested)', $data['message']);
        $this->assertStringNotContainsString('35', $data['message']); // measurements never go into WhatsApp
        $enquiry = Enquiry::query()->latest('id')->first();
        $this->assertTrue($enquiry->fitting_consultation_requested);
        $this->assertNull($enquiry->measurements); // no privacy consent → measurements not stored
    }

    public function test_contact_details_require_privacy_consent_and_are_kept_out_of_whatsapp(): void
    {
        $product = $this->product();
        $item = ['product_id' => $product->id, 'variant_id' => $this->availableVariant($product)->id, 'quantity' => 1];

        $this->postJson('/api/v1/enquiries', ['type' => 'product', 'items' => [$item], 'customer' => ['name' => 'Asha', 'phone' => '+91 91234 00000']])
            ->assertStatus(422)->assertJsonValidationErrors('privacy_consent');

        $data = $this->postJson('/api/v1/enquiries', [
            'type' => 'product', 'items' => [$item], 'privacy_consent' => true,
            'customer' => ['name' => 'Asha', 'phone' => '+91 91234 00000', 'email' => 'Asha@Example.com'],
        ])->assertCreated()->json('data');

        $this->assertStringNotContainsString('Asha', $data['message']);
        $this->assertStringNotContainsString('91234', $data['whatsapp_url']);
        $enquiry = Enquiry::query()->latest('id')->with('customer')->first();
        $this->assertSame('+919123400000', $enquiry->customer->phone);
        $this->assertSame('asha@example.com', $enquiry->customer->email);
    }

    public function test_utm_attribution_is_only_stored_with_consent(): void
    {
        $product = $this->product();
        $item = ['product_id' => $product->id, 'variant_id' => $this->availableVariant($product)->id, 'quantity' => 1];

        $this->postJson('/api/v1/enquiries', ['type' => 'product', 'items' => [$item], 'utm' => ['source' => 'instagram']])->assertCreated();
        $this->assertNull(Enquiry::query()->latest('id')->first()->utm_source);

        $this->postJson('/api/v1/enquiries', ['type' => 'product', 'items' => [$item], 'utm' => ['source' => 'instagram'], 'attribution_consent' => true])->assertCreated();
        $this->assertSame('instagram', Enquiry::query()->latest('id')->first()->utm_source);
    }

    public function test_bag_enquiry_lists_items_and_truncates_long_bags_with_a_summary_link(): void
    {
        $items = [];
        foreach (range(1, 18) as $i) {
            $product = $this->product(['name' => "Very Long Descriptive Product Name Number {$i} With Extra Words"]);
            $items[] = ['product_id' => $product->id, 'variant_id' => $this->availableVariant($product)->id, 'quantity' => 1];
        }

        $data = $this->postJson('/api/v1/enquiries', ['type' => 'bag', 'items' => $items])->assertCreated()->json('data');

        $this->assertLessThanOrEqual(1800, strlen(rawurlencode($data['message'])));
        $this->assertStringContainsString('more item(s) in the full list', $data['message']);
        $this->assertStringContainsString('Full list: https://shop.example.test/enquiry/', $data['message']);

        $summary = $this->getJson('/api/v1/enquiries/summary/'.$data['summary_token'])->assertOk();
        $summary->assertJsonCount(18, 'data.items')->assertJsonPath('data.reference', $data['reference']);
        $this->assertStringNotContainsString('customer', $summary->getContent());
    }

    public function test_enquiry_is_saved_even_when_whatsapp_is_not_configured(): void
    {
        app(SettingsService::class)->update(['whatsapp_business_number' => null]);
        $product = $this->product();

        $this->postJson('/api/v1/enquiries', ['type' => 'product', 'items' => [['product_id' => $product->id, 'variant_id' => $this->availableVariant($product)->id, 'quantity' => 1]]])
            ->assertCreated()->assertJsonPath('data.whatsapp_url', null);
        $this->assertSame(1, Enquiry::query()->count());
    }

    public function test_honeypot_blocks_bots(): void
    {
        $product = $this->product();

        $this->postJson('/api/v1/enquiries', ['type' => 'product', 'website' => 'spam.example', 'items' => [['product_id' => $product->id, 'variant_id' => $this->availableVariant($product)->id, 'quantity' => 1]]])
            ->assertStatus(422);
        $this->assertSame(0, Enquiry::query()->count());
    }

    public function test_consultation_enquiry_and_admin_notification(): void
    {
        Notification::fake();
        app(SettingsService::class)->update(['notify_new_enquiry_email' => 'team@example.com']);

        $data = $this->postJson('/api/v1/enquiries', ['type' => 'consultation', 'preferred_date' => now()->addWeek()->toDateString()])
            ->assertCreated()->json('data');

        $this->assertStringContainsString("I'd like to book a consultation.", $data['message']);
        Notification::assertSentOnDemand(NewEnquiryNotification::class);
    }

    public function test_enquiries_are_rate_limited(): void
    {
        $product = $this->product();
        $payload = ['type' => 'product', 'items' => [['product_id' => $product->id, 'variant_id' => $this->availableVariant($product)->id, 'quantity' => 1]]];
        foreach (range(1, 8) as $_) {
            $this->postJson('/api/v1/enquiries', $payload)->assertCreated();
        }
        $this->postJson('/api/v1/enquiries', $payload)->assertStatus(429);
    }

    public function test_admin_lead_workflow_records_history_notes_and_export(): void
    {
        $product = $this->product();
        $reference = $this->postJson('/api/v1/enquiries', ['type' => 'product', 'items' => [['product_id' => $product->id, 'variant_id' => $this->availableVariant($product)->id, 'quantity' => 1]]])->json('data.reference');
        $enquiry = Enquiry::query()->where('reference', $reference)->first();
        $manager = $this->actingAsRole('enquiry-manager');

        $this->patchJson("/api/v1/admin/enquiries/{$enquiry->id}", [
            'status' => 'awaiting_response', 'status_note' => 'Sent fabric photos',
            'assigned_to' => $manager->id, 'follow_up_at' => now()->subDay()->toIso8601String(), 'note' => 'Prefers navy',
        ])->assertOk()
            ->assertJsonPath('data.status', 'awaiting_response')
            ->assertJsonPath('data.assigned_to.id', $manager->id)
            ->assertJsonPath('data.notes.0.body', 'Prefers navy')
            ->assertJsonPath('data.history.0.to', 'awaiting_response');

        $this->getJson('/api/v1/admin/enquiries?follow_up=overdue')->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/admin/enquiries?q='.$reference)->assertJsonPath('data.0.reference', $reference);

        $csv = $this->get('/api/v1/admin/enquiries/export')->assertOk()->streamedContent();
        $this->assertStringContainsString($reference, $csv);
    }
}
