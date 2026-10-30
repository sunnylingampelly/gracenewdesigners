<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('audit_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('module'); // product | purchase | inventory | sale | payment | crm | user | system
            $table->string('action'); // create | update | delete | post | void | approve | reject | export | login
            $table->string('record_type')->nullable();
            $table->unsignedBigInteger('record_id')->nullable();
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->text('reason')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['record_type', 'record_id']);
            $table->index(['module', 'action']);
            $table->index('user_id');
        });

        Schema::create('day_closes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('closed_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('business_date')->unique();
            $table->decimal('expected_cash', 12, 2)->default(0);
            $table->decimal('actual_cash', 12, 2)->default(0);
            $table->decimal('cash_variance', 12, 2)->storedAs('actual_cash - expected_cash');
            $table->json('payment_mode_totals')->nullable(); // { upi: x, card: y, ... }
            $table->json('actual_mode_totals')->nullable();
            $table->text('variance_reason')->nullable();
            $table->enum('status', ['open', 'pending', 'closed', 'closed_with_variance'])->default('open');
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('bill_number_sequences', function (Blueprint $table) {
            $table->id();
            $table->string('prefix')->default('GND');
            $table->integer('year');
            $table->integer('last_number')->default(0);
            $table->unique(['prefix', 'year']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bill_number_sequences');
        Schema::dropIfExists('day_closes');
        Schema::dropIfExists('audit_events');
    }
};
