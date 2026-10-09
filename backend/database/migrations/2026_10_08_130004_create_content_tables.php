<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Draft and published state live side by side so the homepage can be
        // edited and previewed without affecting the live storefront.
        Schema::create('homepage_sections', function (Blueprint $table) {
            $table->id();
            $table->string('page_key', 40)->default('home');
            $table->string('type', 40);
            $table->string('name', 150);
            $table->json('draft_config');
            $table->unsignedInteger('draft_sort_order')->default(0);
            $table->boolean('draft_is_enabled')->default(true);
            $table->json('config')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_enabled')->default(false);
            $table->boolean('is_published')->default(false);
            $table->boolean('pending_removal')->default(false);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['page_key', 'is_published', 'sort_order']);
        });

        Schema::create('pages', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('template', 30)->default('default'); // default|story|policy|contact
            $table->string('excerpt', 500)->nullable();
            $table->longText('body')->nullable(); // sanitized HTML
            $table->foreignId('hero_media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->string('status', 20)->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->boolean('show_in_footer')->default(false);
            $table->string('seo_title')->nullable();
            $table->string('seo_description', 500)->nullable();
            $table->boolean('is_indexable')->default(true);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['status', 'published_at']);
        });

        Schema::create('navigation_menus', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('location', 40)->unique(); // header|footer_shop|footer_house|footer_help|mobile
            $table->timestamps();
        });

        Schema::create('navigation_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('navigation_menu_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('navigation_items')->cascadeOnDelete();
            $table->string('label', 120);
            // url|department|category|collection|occasion|page|lookbook|route
            $table->string('link_type', 20)->default('url');
            $table->unsignedBigInteger('link_id')->nullable();
            $table->string('url', 500)->nullable();
            $table->string('group_heading', 120)->nullable(); // mega-menu column heading
            $table->foreignId('image_media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->string('highlight_text', 120)->nullable();
            $table->boolean('open_in_new_tab')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['navigation_menu_id', 'parent_id', 'sort_order']);
        });

        Schema::create('lookbooks', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('season', 80)->nullable();
            $table->text('description')->nullable();
            $table->foreignId('cover_media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->foreignId('collection_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 20)->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('seo_title')->nullable();
            $table->string('seo_description', 500)->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('lookbook_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lookbook_id')->constrained()->cascadeOnDelete();
            $table->foreignId('media_asset_id')->constrained()->restrictOnDelete();
            $table->string('caption')->nullable();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('collection_id')->nullable()->constrained()->nullOnDelete();
            $table->string('layout', 20)->default('portrait'); // portrait|landscape|full
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('testimonials', function (Blueprint $table) {
            $table->id();
            $table->string('author_name', 120);
            $table->string('location', 120)->nullable();
            $table->string('occasion', 120)->nullable();
            $table->text('quote');
            $table->foreignId('media_asset_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('consent_confirmed')->default(false);
            $table->boolean('is_approved')->default(false);
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('newsletter_subscribers', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->string('source', 60)->nullable();
            $table->timestamp('consented_at');
            $table->timestamp('unsubscribed_at')->nullable();
            $table->string('unsubscribe_token', 64)->unique();
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('group', 40)->index();
            $table->string('key', 100)->unique();
            $table->json('value')->nullable();
            $table->boolean('is_public')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['settings', 'newsletter_subscribers', 'testimonials', 'lookbook_media', 'lookbooks',
            'navigation_items', 'navigation_menus', 'pages', 'homepage_sections'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
