<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('sales_bills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('bill_number')->unique();
            $table->date('bill_date');
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->string('discount_reason')->nullable();
            $table->decimal('tax_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->decimal('amount_paid', 12, 2)->default(0);
            $table->decimal('amount_due', 12, 2)->storedAs('total_amount - amount_paid');
            // status: draft | posted | paid | partial | cancelled | void | refunded
            $table->string('status')->default('draft');
            $table->text('notes')->nullable();
            $table->boolean('is_walk_in')->default(false);
            $table->string('walk_in_name')->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('bill_line_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bill_id')->constrained('sales_bills')->cascadeOnDelete();
            $table->foreignId('variant_id')->constrained('product_variants')->restrictOnDelete();
            $table->integer('quantity');
            $table->decimal('unit_price', 10, 2);
            $table->decimal('discount_percent', 5, 2)->default(0);
            $table->decimal('discount_amount', 10, 2)->default(0);
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->decimal('tax_amount', 10, 2)->default(0);
            $table->decimal('line_total', 12, 2); // after discount + tax
            $table->boolean('is_returned')->default(false);
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bill_id')->constrained('sales_bills')->restrictOnDelete();
            $table->foreignId('received_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            // mode: cash | upi | card | bank_transfer | cheque | other
            $table->string('mode');
            $table->decimal('amount', 12, 2);
            $table->string('reference')->nullable(); // UPI txn id, cheque no etc.
            $table->date('payment_date');
            $table->time('payment_time')->nullable();
            $table->enum('status', ['pending', 'confirmed', 'reversed'])->default('confirmed');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bill_id')->constrained('sales_bills')->restrictOnDelete();
            $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('amount', 12, 2);
            $table->string('mode'); // original mode or alternative
            $table->string('reference')->nullable();
            $table->text('reason')->nullable();
            // status: pending | approved | processed | rejected
            $table->string('status')->default('pending');
            $table->timestamps();
        });

        Schema::create('returns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bill_id')->constrained('sales_bills')->restrictOnDelete();
            $table->foreignId('line_item_id')->constrained('bill_line_items')->restrictOnDelete();
            $table->foreignId('refund_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->integer('quantity');
            $table->text('reason');
            // condition: resellable | damaged | non_resellable
            $table->string('condition')->default('resellable');
            // status: pending | approved | stock_updated | rejected
            $table->string('status')->default('pending');
            $table->timestamps();
        });

        // Add lead FK to bills
        Schema::table('leads', function (Blueprint $table) {
            $table->foreign('converted_bill_id')->references('id')->on('sales_bills')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->dropForeign(['converted_bill_id']);
        });
        Schema::dropIfExists('returns');
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('bill_line_items');
        Schema::dropIfExists('sales_bills');
    }
};
