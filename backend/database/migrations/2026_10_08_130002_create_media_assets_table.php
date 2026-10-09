<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('media_assets', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('disk', 40);
            $table->string('path', 500);
            $table->string('original_name');
            $table->string('mime_type', 100);
            $table->string('extension', 10);
            $table->string('kind', 20)->index(); // image | video | document
            $table->unsignedBigInteger('size_bytes');
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->string('checksum', 64)->index();
            $table->string('alt_text', 300)->nullable();
            $table->string('title')->nullable();
            $table->string('folder', 100)->nullable()->index();
            // Derived renditions: {"thumb": {"path": "...", "width": 320, "height": 400, "format": "webp"}, ...}
            $table->json('renditions')->nullable();
            $table->string('processing_status', 20)->default('pending')->index();
            $table->text('processing_error')->nullable();
            $table->decimal('focal_x', 5, 4)->nullable();
            $table->decimal('focal_y', 5, 4)->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_assets');
    }
};
