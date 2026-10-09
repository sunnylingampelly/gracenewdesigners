<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('size_charts', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('unit', 10)->default('in');
            // Display table: {"columns": ["Size","Bust","Waist"], "rows": [["S","34","28"], ...]}
            $table->json('chart')->nullable();
            $table->text('measurement_guide')->nullable();
            $table->foreignId('guide_media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('departments', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('slug', 120)->unique();
            $table->text('description')->nullable();
            $table->foreignId('banner_media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->string('seo_title')->nullable();
            $table->string('seo_description', 500)->nullable();
            $table->timestamps();
            $table->index(['is_active', 'sort_order']);
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->constrained()->restrictOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('categories')->restrictOnDelete();
            $table->string('name', 150);
            $table->string('slug', 150);
            // Full public path, e.g. "women/lehengas" — unique, which scopes slugs to their parent.
            $table->string('path', 400)->unique();
            $table->unsignedTinyInteger('depth')->default(0);
            $table->text('intro')->nullable();
            $table->foreignId('banner_media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->foreignId('image_media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->foreignId('size_chart_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_published')->default(true);
            $table->boolean('show_in_menu')->default(true);
            $table->boolean('hide_when_empty')->default(true);
            $table->string('seo_title')->nullable();
            $table->string('seo_description', 500)->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['department_id', 'parent_id', 'sort_order']);
            $table->index(['is_published', 'show_in_menu']);
        });

        Schema::create('collections', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('slug', 150)->unique();
            $table->string('tagline')->nullable();
            $table->text('story')->nullable();
            $table->foreignId('cover_media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->foreignId('banner_media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_published')->default(false);
            $table->boolean('is_featured')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('seo_title')->nullable();
            $table->string('seo_description', 500)->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['is_published', 'sort_order']);
        });

        Schema::create('occasions', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('slug', 120)->unique();
            $table->text('description')->nullable();
            $table->foreignId('image_media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_published')->default(true);
            $table->string('seo_title')->nullable();
            $table->string('seo_description', 500)->nullable();
            $table->timestamps();
        });

        Schema::create('tags', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('slug', 100)->unique();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('sku', 64)->unique();
            $table->string('brand', 120)->default('Grace New Designers');
            $table->string('short_description', 600)->nullable();
            $table->longText('description')->nullable(); // sanitized HTML
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 20)->default('draft'); // draft|scheduled|published|archived
            $table->timestamp('published_at')->nullable();

            $table->string('price_mode', 20)->default('fixed'); // fixed|starting_from|on_request
            $table->decimal('price', 12, 2)->nullable();
            $table->decimal('compare_at_price', 12, 2)->nullable();
            $table->decimal('cost_price', 12, 2)->nullable(); // internal only
            $table->char('currency', 3)->default('INR');
            $table->boolean('show_price')->default(true);
            $table->string('tax_note')->nullable();

            $table->boolean('is_featured')->default(false);
            $table->boolean('is_new_arrival')->default(false);
            $table->boolean('is_bestseller')->default(false);
            $table->boolean('is_exclusive')->default(false);
            $table->integer('recommendation_priority')->default(0);

            $table->boolean('allows_custom_size')->default(false);
            $table->boolean('is_made_to_order')->default(false);
            $table->unsignedSmallInteger('lead_time_min_days')->nullable();
            $table->unsignedSmallInteger('lead_time_max_days')->nullable();
            $table->string('set_includes')->nullable();
            $table->text('craftsmanship')->nullable();
            $table->text('care_instructions')->nullable();
            $table->text('delivery_notes')->nullable();
            $table->string('country_of_origin', 80)->nullable()->default('India');
            $table->foreignId('size_chart_id')->nullable()->constrained()->nullOnDelete();

            $table->string('seo_title')->nullable();
            $table->string('seo_description', 500)->nullable();
            $table->string('canonical_url', 500)->nullable();
            $table->foreignId('og_media_id')->nullable()->constrained('media_assets')->nullOnDelete();
            $table->boolean('is_indexable')->default(true);

            $table->text('internal_notes')->nullable(); // internal only
            $table->text('search_text')->nullable(); // denormalized search document
            $table->unsignedBigInteger('view_count')->default(0);
            $table->unsignedBigInteger('enquiry_count')->default(0);
            // Denormalized from active variants for fast listing filters (kept in sync by ProductService).
            $table->boolean('has_stock')->default(false);
            $table->decimal('min_price', 12, 2)->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'published_at']);
            $table->index(['is_featured', 'status']);
            $table->index(['is_new_arrival', 'status']);
            $table->index(['is_bestseller', 'status']);
            $table->index('min_price');
            $table->index('department_id');
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE products ADD FULLTEXT INDEX products_fulltext (name, search_text)');
        }

        Schema::create('category_product', function (Blueprint $table) {
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_primary')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->primary(['category_id', 'product_id']);
            $table->index('product_id');
        });

        Schema::create('collection_product', function (Blueprint $table) {
            $table->foreignId('collection_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('sort_order')->default(0);
            $table->primary(['collection_id', 'product_id']);
            $table->index('product_id');
        });

        Schema::create('occasion_product', function (Blueprint $table) {
            $table->foreignId('occasion_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->primary(['occasion_id', 'product_id']);
            $table->index('product_id');
        });

        Schema::create('product_tag', function (Blueprint $table) {
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->primary(['product_id', 'tag_id']);
            $table->index('tag_id');
        });

        Schema::create('product_relations', function (Blueprint $table) {
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('related_product_id')->constrained('products')->cascadeOnDelete();
            $table->string('type', 30); // related | complete_the_look
            $table->unsignedInteger('sort_order')->default(0);
            $table->primary(['product_id', 'related_product_id', 'type']);
        });

        // Global option dictionaries: Size, Color (admins may add values and size groups).
        Schema::create('product_options', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60);
            $table->string('code', 40)->unique(); // size | color
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('product_option_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_option_id')->constrained()->restrictOnDelete();
            $table->string('label', 80);
            $table->string('code', 80);
            $table->string('hex', 7)->nullable();
            $table->string('size_group', 60)->nullable();
            $table->boolean('is_custom')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['product_option_id', 'code']);
        });

        Schema::create('product_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('media_asset_id')->constrained()->restrictOnDelete();
            $table->string('role', 20)->default('gallery'); // gallery|alternate|detail|video
            $table->foreignId('color_value_id')->nullable()->constrained('product_option_values')->nullOnDelete();
            $table->string('alt_text', 300)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['product_id', 'sort_order']);
        });

        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('sku', 80)->unique();
            $table->foreignId('size_value_id')->nullable()->constrained('product_option_values')->restrictOnDelete();
            $table->foreignId('color_value_id')->nullable()->constrained('product_option_values')->restrictOnDelete();
            // Normalized combination key ("s:12|c:4") so NULL options still enforce uniqueness.
            $table->string('combination_key', 60);
            $table->decimal('price', 12, 2)->nullable();
            $table->decimal('compare_at_price', 12, 2)->nullable();
            $table->integer('stock_quantity')->default(0);
            $table->string('stock_policy', 20)->default('track'); // track|made_to_order|untracked
            $table->unsignedInteger('low_stock_threshold')->default(2);
            $table->foreignId('media_asset_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['product_id', 'combination_key']);
            $table->index(['size_value_id']);
            $table->index(['color_value_id']);
        });

        Schema::create('attributes', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('code', 60)->unique();
            $table->string('type', 20)->default('select'); // text|textarea|select|multiselect|boolean
            $table->string('group', 40)->default('details');
            $table->boolean('is_filterable')->default(false);
            $table->boolean('is_visible')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('attribute_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attribute_id')->constrained()->cascadeOnDelete();
            $table->string('value', 150);
            $table->string('slug', 150);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->unique(['attribute_id', 'slug']);
        });

        Schema::create('attribute_category', function (Blueprint $table) {
            $table->foreignId('attribute_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_required')->default(false);
            $table->primary(['attribute_id', 'category_id']);
        });

        Schema::create('product_attribute_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('attribute_id')->constrained()->cascadeOnDelete();
            $table->foreignId('attribute_value_id')->nullable()->constrained()->cascadeOnDelete();
            $table->text('value_text')->nullable();
            $table->timestamps();
            $table->index(['product_id', 'attribute_id']);
            $table->index(['attribute_value_id', 'product_id']);
        });

        Schema::create('redirects', function (Blueprint $table) {
            $table->id();
            $table->string('from_path', 500)->unique();
            $table->string('to_path', 500)->nullable(); // null + 410 = gone
            $table->unsignedSmallInteger('status_code')->default(301);
            $table->unsignedBigInteger('hits')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach ([
            'redirects', 'product_attribute_values', 'attribute_category', 'attribute_values', 'attributes',
            'product_variants', 'product_media', 'product_option_values', 'product_options', 'product_relations',
            'product_tag', 'occasion_product', 'collection_product', 'category_product', 'products', 'tags',
            'occasions', 'collections', 'categories', 'departments', 'size_charts',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
