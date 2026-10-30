<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('preferred_contact')->default('whatsapp'); // whatsapp | phone | email
            $table->text('address')->nullable();
            $table->date('dob')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('marketing_consent')->default(false);
            $table->timestamps();
            $table->softDeletes();

            $table->index('phone');
            $table->index('email');
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('converted_bill_id')->nullable(); // set when lead converts; FK added later
            $table->string('name'); // in case customer not yet created
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            // status: new | contacted | qualified | consultation_planned | quote_shared | follow_up | won | lost | not_proceeding
            $table->string('status')->default('new');
            $table->string('source')->nullable(); // whatsapp | walk_in | referral | instagram | google
            $table->string('occasion')->nullable();
            $table->text('product_interest')->nullable();
            $table->text('preferences')->nullable();
            $table->decimal('budget', 10, 2)->nullable();
            $table->date('follow_up_date')->nullable();
            $table->text('lost_reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leads');
        Schema::dropIfExists('customers');
    }
};
