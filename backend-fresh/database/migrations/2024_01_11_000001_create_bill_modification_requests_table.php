<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('bill_modification_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bill_id')->constrained('sales_bills')->cascadeOnDelete();
            $table->foreignId('requested_by')->constrained('users');
            $table->text('reason');
            $table->enum('status', ['pending','approved','rejected','completed'])->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users');
            $table->text('admin_notes')->nullable();
            $table->timestamps();
        });
    }
    public function down(): void { Schema::dropIfExists('bill_modification_requests'); }
};
