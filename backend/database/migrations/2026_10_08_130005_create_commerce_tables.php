<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150)->nullable();
            $table->string('phone', 32)->nullable()->index();
            $table->string('email')->nullable()->index();
            $table->string('city', 120)->nullable();
            $table->string('country', 80)->nullable();
            $table->text('notes')->nullable(); // internal only
            $table->boolean('marketing_consent')->default(false);
            $table->timestamp('marketing_consent_at')->nullable();
            $table->timestamp('anonymized_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('enquiries', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 30)->unique();
            $table->string('type', 20); // product|bag|consultation|contact
            $table->string('channel', 20)->default('whatsapp');
            $table->string('status', 30)->default('new')->index();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->text('customer_message')->nullable();
            $table->text('measurements')->nullable(); // encrypted JSON, voluntary
            $table->boolean('fitting_consultation_requested')->default(false);
            $table->date('preferred_date')->nullable();
            $table->decimal('display_total', 12, 2)->nullable();
            $table->char('currency', 3)->default('INR');
            $table->string('source_path', 500)->nullable();
            $table->string('referrer_host')->nullable();
            $table->string('utm_source', 100)->nullable();
            $table->string('utm_medium', 100)->nullable();
            $table->string('utm_campaign', 150)->nullable();
            $table->string('utm_content', 150)->nullable();
            $table->string('utm_term', 150)->nullable();
            $table->boolean('attribution_consent')->default(false);
            $table->string('whatsapp_number', 32)->nullable();
            $table->text('whatsapp_message')->nullable();
            $table->string('summary_token', 64)->unique();
            $table->timestamp('redirect_initiated_at')->nullable();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('follow_up_at')->nullable()->index();
            $table->timestamp('status_changed_at')->nullable();
            $table->string('ip_hash', 64)->nullable()->index();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['created_at', 'status']);
        });

        Schema::create('enquiry_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('enquiry_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product_name');
            $table->string('product_sku', 64);
            $table->string('variant_sku', 80)->nullable();
            $table->string('size_label', 80)->nullable();
            $table->string('color_label', 80)->nullable();
            $table->boolean('is_custom_size')->default(false);
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->string('price_mode', 20);
            $table->decimal('unit_price', 12, 2)->nullable(); // displayed price snapshot (never for on_request)
            $table->char('currency', 3)->default('INR');
            $table->string('product_url', 500)->nullable();
            $table->timestamps();
            $table->index('product_id');
        });

        Schema::create('enquiry_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('enquiry_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('note', 1000)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('enquiry_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('enquiry_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->text('body');
            $table->timestamps();
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 30)->unique();
            $table->foreignId('enquiry_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 30)->default('pending_confirmation')->index();
            $table->string('payment_status', 30)->default('unpaid')->index();
            $table->string('payment_note', 500)->nullable();
            $table->char('currency', 3)->default('INR');
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('shipping_amount', 12, 2)->default(0);
            $table->decimal('tax_amount', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->decimal('amount_paid', 12, 2)->default(0);
            $table->boolean('requires_shipping')->default(true);
            $table->string('shipping_name', 150)->nullable();
            $table->string('shipping_phone', 32)->nullable();
            $table->string('shipping_line1')->nullable();
            $table->string('shipping_line2')->nullable();
            $table->string('shipping_city', 120)->nullable();
            $table->string('shipping_state', 120)->nullable();
            $table->string('shipping_postal_code', 20)->nullable();
            $table->string('shipping_country', 80)->nullable();
            $table->string('tracking_carrier', 100)->nullable();
            $table->string('tracking_number', 100)->nullable();
            $table->date('expected_delivery_date')->nullable();
            $table->text('internal_notes')->nullable();
            $table->boolean('stock_committed')->default(false);
            $table->timestamp('confirmed_at')->nullable();
            $table->foreignId('confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index('created_at');
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product_name');
            $table->string('sku', 80)->nullable();
            $table->string('size_label', 80)->nullable();
            $table->string('color_label', 80)->nullable();
            $table->boolean('is_custom_size')->default(false);
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('line_total', 12, 2);
            $table->string('notes', 1000)->nullable();
            $table->timestamps();
        });

        Schema::create('order_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('field', 30); // status | payment_status
            $table->string('from_value', 30)->nullable();
            $table->string('to_value', 30);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('note', 1000)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        foreach (['order_status_histories', 'order_items', 'orders', 'enquiry_notes',
            'enquiry_status_histories', 'enquiry_items', 'enquiries', 'customers'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
