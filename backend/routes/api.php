<?php

use App\Http\Controllers\Api\V1\Admin;
use App\Http\Controllers\Api\V1\Storefront;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API v1
|--------------------------------------------------------------------------
| Public storefront endpoints are read-only (plus enquiry/newsletter/analytics writes) and never
| expose drafts or internal fields. Admin endpoints require a Sanctum session and are permission-gated
| server-side on every route.
*/

Route::prefix('v1')->group(function () {

    // ---- Storefront -----------------------------------------------------------------------------
    Route::middleware('throttle:api')->group(function () {
        Route::get('settings/public', [Storefront\ContentController::class, 'settings']);
        Route::get('navigation', [Storefront\ContentController::class, 'navigation']);
        Route::get('homepage', [Storefront\ContentController::class, 'homepage']);
        Route::get('pages', [Storefront\ContentController::class, 'footerPages']);
        Route::get('pages/{slug}', [Storefront\ContentController::class, 'page']);
        Route::get('lookbooks', [Storefront\ContentController::class, 'lookbooks']);
        Route::get('lookbooks/{slug}', [Storefront\ContentController::class, 'lookbook']);
        Route::get('redirects/resolve', [Storefront\ContentController::class, 'resolveRedirect']);
        Route::get('path-status', [Storefront\ContentController::class, 'pathStatus']);

        Route::get('departments', [Storefront\CatalogController::class, 'departments']);
        Route::get('departments/{slug}', [Storefront\CatalogController::class, 'department']);
        Route::get('categories', [Storefront\CatalogController::class, 'categories']);
        Route::get('categories/{path}', [Storefront\CatalogController::class, 'category'])->where('path', '[a-z0-9\-/]+');
        Route::get('collections', [Storefront\CatalogController::class, 'collections']);
        Route::get('collections/{slug}', [Storefront\CatalogController::class, 'collection']);
        Route::get('occasions', [Storefront\CatalogController::class, 'occasions']);
        Route::get('occasions/{slug}', [Storefront\CatalogController::class, 'occasion']);

        Route::get('products', [Storefront\ProductController::class, 'index']);
        Route::get('products/facets', [Storefront\ProductController::class, 'facets']);
        Route::get('products/{slug}', [Storefront\ProductController::class, 'show']);

        Route::get('enquiries/summary/{token}', [Storefront\EnquiryController::class, 'summary']);
        Route::get('sitemap', [Storefront\EngagementController::class, 'sitemap']);
    });

    Route::middleware('throttle:search')->group(function () {
        Route::get('search', [Storefront\SearchController::class, 'index']);
        Route::get('search/suggest', [Storefront\SearchController::class, 'suggest']);
    });

    Route::post('enquiries', [Storefront\EnquiryController::class, 'store'])->middleware('throttle:enquiries');
    Route::post('enquiries/{reference}/redirected', [Storefront\EnquiryController::class, 'redirected'])->middleware('throttle:enquiries');
    Route::post('newsletter', [Storefront\EngagementController::class, 'newsletter'])->middleware('throttle:forms');
    Route::post('newsletter/unsubscribe', [Storefront\EngagementController::class, 'unsubscribe'])->middleware('throttle:forms');
    Route::post('analytics/events', [Storefront\EngagementController::class, 'track'])->middleware('throttle:analytics');

    // ---- Admin authentication ---------------------------------------------------------------------
    Route::prefix('admin/auth')->group(function () {
        Route::post('login', [Admin\AuthController::class, 'login'])->middleware('throttle:login');
        Route::post('two-factor-challenge', [Admin\AuthController::class, 'twoFactorChallenge'])->middleware('throttle:login');
        Route::post('forgot-password', [Admin\AuthController::class, 'forgotPassword'])->middleware('throttle:forms');
        Route::post('reset-password', [Admin\AuthController::class, 'resetPassword'])->middleware('throttle:forms');

        Route::middleware('auth:sanctum')->group(function () {
            Route::post('logout', [Admin\AuthController::class, 'logout']);
            Route::get('me', [Admin\AuthController::class, 'me']);
            Route::put('password', [Admin\AuthController::class, 'changePassword']);
            Route::post('two-factor', [Admin\AuthController::class, 'twoFactorSetup']);
            Route::post('two-factor/confirm', [Admin\AuthController::class, 'twoFactorConfirm']);
            Route::delete('two-factor', [Admin\AuthController::class, 'twoFactorDisable']);
        });
    });

    // ---- Admin ------------------------------------------------------------------------------------
    Route::prefix('admin')->middleware(['auth:sanctum', 'mfa.enrolled', 'throttle:api'])->group(function () {

        Route::get('dashboard', [Admin\DashboardController::class, 'index'])->middleware('permission:reports.view');
        Route::get('reports', [Admin\DashboardController::class, 'reports'])->middleware('permission:reports.view');
        Route::get('lookups/statuses', [Admin\OrderController::class, 'statuses']);
        Route::get('team/assignees', [Admin\TeamController::class, 'assignees'])->middleware('permission:enquiries.view|orders.view');

        // Products (fine-grained checks in ProductPolicy)
        Route::get('products/export', [Admin\ProductImportController::class, 'export']);
        Route::get('products/import/template', [Admin\ProductImportController::class, 'template']);
        Route::get('products/imports', [Admin\ProductImportController::class, 'index']);
        Route::post('products/import', [Admin\ProductImportController::class, 'store']);
        Route::get('products/imports/{import}', [Admin\ProductImportController::class, 'show']);
        Route::post('products/imports/{import}/commit', [Admin\ProductImportController::class, 'commit']);
        Route::post('products/bulk', [Admin\ProductController::class, 'bulk']);
        Route::get('products', [Admin\ProductController::class, 'index']);
        Route::post('products', [Admin\ProductController::class, 'store']);
        Route::get('products/{id}', [Admin\ProductController::class, 'show'])->whereNumber('id');
        Route::patch('products/{product}', [Admin\ProductController::class, 'update']);
        Route::delete('products/{product}', [Admin\ProductController::class, 'destroy']);
        Route::post('products/{id}/restore', [Admin\ProductController::class, 'restore'])->whereNumber('id');
        Route::post('products/{product}/duplicate', [Admin\ProductController::class, 'duplicate']);
        Route::post('products/{product}/status', [Admin\ProductController::class, 'changeStatus']);
        Route::get('products/{product}/preview-token', [Admin\ProductController::class, 'previewToken']);

        // Taxonomy
        Route::middleware('permission:taxonomy.manage|products.view')->group(function () {
            Route::get('departments', [Admin\CategoryController::class, 'departments']);
            Route::get('categories', [Admin\CategoryController::class, 'index']);
            Route::get('categories/{category}', [Admin\CategoryController::class, 'show']);
            Route::get('collections', [Admin\CollectionController::class, 'index']);
            Route::get('collections/{collection}', [Admin\CollectionController::class, 'show']);
            Route::get('occasions', [Admin\CatalogSetupController::class, 'occasions']);
            Route::get('tags', [Admin\CatalogSetupController::class, 'tags']);
            Route::get('options', [Admin\CatalogSetupController::class, 'options']);
            Route::get('attributes', [Admin\CatalogSetupController::class, 'attributes']);
            Route::get('size-charts', [Admin\CatalogSetupController::class, 'sizeCharts']);
        });
        Route::middleware('permission:taxonomy.manage')->group(function () {
            Route::post('departments', [Admin\CategoryController::class, 'saveDepartment']);
            Route::patch('departments/{department}', [Admin\CategoryController::class, 'saveDepartment']);
            Route::delete('departments/{department}', [Admin\CategoryController::class, 'destroyDepartment']);
            Route::post('categories', [Admin\CategoryController::class, 'store']);
            Route::post('categories/reorder', [Admin\CategoryController::class, 'reorder']);
            Route::patch('categories/{category}', [Admin\CategoryController::class, 'update']);
            Route::delete('categories/{category}', [Admin\CategoryController::class, 'destroy']);
            Route::post('collections', [Admin\CollectionController::class, 'store']);
            Route::patch('collections/{collection}', [Admin\CollectionController::class, 'update']);
            Route::delete('collections/{collection}', [Admin\CollectionController::class, 'destroy']);
            Route::put('collections/{collection}/products', [Admin\CollectionController::class, 'syncProducts']);
            Route::post('occasions', [Admin\CatalogSetupController::class, 'saveOccasion']);
            Route::patch('occasions/{occasion}', [Admin\CatalogSetupController::class, 'saveOccasion']);
            Route::delete('occasions/{occasion}', [Admin\CatalogSetupController::class, 'destroyOccasion']);
            Route::delete('tags/{tag}', [Admin\CatalogSetupController::class, 'destroyTag']);
        });
        Route::middleware('permission:attributes.manage')->group(function () {
            Route::post('options/{option}/values', [Admin\CatalogSetupController::class, 'saveOptionValue']);
            Route::patch('options/{option}/values/{value}', [Admin\CatalogSetupController::class, 'saveOptionValue']);
            Route::delete('options/{option}/values/{value}', [Admin\CatalogSetupController::class, 'destroyOptionValue']);
            Route::post('attributes', [Admin\CatalogSetupController::class, 'saveAttribute']);
            Route::patch('attributes/{attribute}', [Admin\CatalogSetupController::class, 'saveAttribute']);
            Route::delete('attributes/{attribute}', [Admin\CatalogSetupController::class, 'destroyAttribute']);
            Route::post('size-charts', [Admin\CatalogSetupController::class, 'saveSizeChart']);
            Route::patch('size-charts/{sizeChart}', [Admin\CatalogSetupController::class, 'saveSizeChart']);
            Route::delete('size-charts/{sizeChart}', [Admin\CatalogSetupController::class, 'destroySizeChart']);
        });

        // Media (MediaAssetPolicy)
        Route::get('media', [Admin\MediaController::class, 'index']);
        Route::post('media', [Admin\MediaController::class, 'store']);
        Route::get('media/{medium}', [Admin\MediaController::class, 'show']);
        Route::patch('media/{medium}', [Admin\MediaController::class, 'update']);
        Route::delete('media/{medium}', [Admin\MediaController::class, 'destroy']);
        Route::post('media/{medium}/reprocess', [Admin\MediaController::class, 'reprocess']);

        // Enquiries (EnquiryPolicy)
        Route::get('enquiries/export', [Admin\EnquiryController::class, 'export']);
        Route::post('enquiries/bulk', [Admin\EnquiryController::class, 'bulk']);
        Route::get('enquiries', [Admin\EnquiryController::class, 'index']);
        Route::get('enquiries/{enquiry}', [Admin\EnquiryController::class, 'show']);
        Route::patch('enquiries/{enquiry}', [Admin\EnquiryController::class, 'update']);
        Route::delete('enquiries/{enquiry}', [Admin\EnquiryController::class, 'destroy']);
        Route::post('enquiries/{enquiry}/notes', [Admin\EnquiryController::class, 'addNote']);
        Route::get('enquiries/{enquiry}/order-draft', [Admin\OrderController::class, 'draftFromEnquiry']);

        // Orders (OrderPolicy / OrderRequest)
        Route::get('orders', [Admin\OrderController::class, 'index']);
        Route::post('orders', [Admin\OrderController::class, 'store']);
        Route::get('orders/{order}', [Admin\OrderController::class, 'show']);
        Route::patch('orders/{order}', [Admin\OrderController::class, 'update']);

        // Customers (CustomerPolicy)
        Route::get('customers', [Admin\CustomerController::class, 'index']);
        Route::get('customers/{customer}', [Admin\CustomerController::class, 'show']);
        Route::patch('customers/{customer}', [Admin\CustomerController::class, 'update']);
        Route::post('customers/{customer}/anonymize', [Admin\CustomerController::class, 'anonymize']);
        Route::get('newsletter-subscribers', [Admin\CustomerController::class, 'subscribers']);

        // Content
        Route::middleware('permission:content.manage')->group(function () {
            Route::get('homepage/sections', [Admin\HomepageController::class, 'index']);
            Route::post('homepage/sections', [Admin\HomepageController::class, 'store']);
            Route::post('homepage/sections/reorder', [Admin\HomepageController::class, 'reorder']);
            Route::patch('homepage/sections/{section}', [Admin\HomepageController::class, 'update']);
            Route::delete('homepage/sections/{section}', [Admin\HomepageController::class, 'destroy']);
            Route::post('homepage/sections/{section}/restore', [Admin\HomepageController::class, 'restore']);
            Route::post('homepage/publish', [Admin\HomepageController::class, 'publish']);
            Route::post('homepage/discard', [Admin\HomepageController::class, 'discard']);
            Route::get('homepage/preview-token', [Admin\HomepageController::class, 'previewToken']);

            Route::get('pages', [Admin\ContentController::class, 'pages']);
            Route::post('pages', [Admin\ContentController::class, 'savePage']);
            Route::get('pages/{page}', [Admin\ContentController::class, 'page']);
            Route::patch('pages/{page}', [Admin\ContentController::class, 'savePage']);
            Route::delete('pages/{page}', [Admin\ContentController::class, 'destroyPage']);
            Route::get('pages/{page}/preview-token', [Admin\ContentController::class, 'pagePreviewToken']);

            Route::get('lookbooks', [Admin\ContentController::class, 'lookbooks']);
            Route::post('lookbooks', [Admin\ContentController::class, 'saveLookbook']);
            Route::get('lookbooks/{lookbook}', [Admin\ContentController::class, 'lookbook']);
            Route::patch('lookbooks/{lookbook}', [Admin\ContentController::class, 'saveLookbook']);
            Route::delete('lookbooks/{lookbook}', [Admin\ContentController::class, 'destroyLookbook']);

            Route::get('testimonials', [Admin\ContentController::class, 'testimonials']);
            Route::post('testimonials', [Admin\ContentController::class, 'saveTestimonial']);
            Route::patch('testimonials/{testimonial}', [Admin\ContentController::class, 'saveTestimonial']);
            Route::post('testimonials/{testimonial}/approval', [Admin\ContentController::class, 'approveTestimonial']);
            Route::delete('testimonials/{testimonial}', [Admin\ContentController::class, 'destroyTestimonial']);
        });
        Route::middleware('permission:navigation.manage')->group(function () {
            Route::get('navigation', [Admin\ContentController::class, 'menus']);
            Route::put('navigation/{menu}', [Admin\ContentController::class, 'saveMenu']);
        });
        Route::middleware('permission:seo.manage')->group(function () {
            Route::get('redirects', [Admin\ContentController::class, 'redirects']);
            Route::post('redirects', [Admin\ContentController::class, 'saveRedirect']);
            Route::patch('redirects/{redirect}', [Admin\ContentController::class, 'saveRedirect']);
            Route::delete('redirects/{redirect}', [Admin\ContentController::class, 'destroyRedirect']);
        });

        // Settings & team
        Route::get('settings', [Admin\SettingsController::class, 'show'])->middleware('permission:settings.manage|seo.manage');
        Route::patch('settings', [Admin\SettingsController::class, 'update'])->middleware('permission:settings.manage');
        Route::get('users', [Admin\TeamController::class, 'users']);
        Route::post('users', [Admin\TeamController::class, 'storeUser']);
        Route::patch('users/{user}', [Admin\TeamController::class, 'updateUser']);
        Route::delete('users/{user}', [Admin\TeamController::class, 'destroyUser']);
        Route::get('roles', [Admin\TeamController::class, 'roles']);
        Route::patch('roles/{role}', [Admin\TeamController::class, 'updateRole']);
        Route::get('activity-logs', [Admin\TeamController::class, 'activity']);
    });
});
