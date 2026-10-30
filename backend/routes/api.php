<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\LeadController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SalesController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// ── PUBLIC (no auth required) ───────────────────────────────────────────────
Route::prefix('public')->group(function () {
    Route::get('products',           [ProductController::class, 'publicIndex']);
    Route::get('products/{product}', [ProductController::class, 'publicShow']);
    Route::get('categories',         [\App\Http\Controllers\Api\CategoryController::class, 'index']);
    Route::get('collections',        [\App\Http\Controllers\Api\CollectionController::class, 'index']);
    Route::get('whatsapp-number',    fn() => response()->json(['number' => config('app.whatsapp_number', env('WHATSAPP_NUMBER'))]));
});

// ── AUTH ────────────────────────────────────────────────────────────────────
Route::post('auth/login',  [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {

    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me',      [AuthController::class, 'me']);

    // ── CATALOGUE ───────────────────────────────────────────────────────────
    Route::apiResource('products',   ProductController::class);
    Route::apiResource('categories', \App\Http\Controllers\Api\CategoryController::class);
    Route::apiResource('collections',\App\Http\Controllers\Api\CollectionController::class);

    Route::prefix('products/{product}')->group(function () {
        Route::post('variants',            [\App\Http\Controllers\Api\VariantController::class, 'store']);
        Route::put('variants/{variant}',   [\App\Http\Controllers\Api\VariantController::class, 'update']);
        Route::delete('variants/{variant}',[\App\Http\Controllers\Api\VariantController::class, 'destroy']);
        Route::post('images',              [\App\Http\Controllers\Api\ProductImageController::class, 'store']);
        Route::delete('images/{image}',    [\App\Http\Controllers\Api\ProductImageController::class, 'destroy']);
    });

    // ── SUPPLIERS & PURCHASING ───────────────────────────────────────────────
    Route::apiResource('suppliers', SupplierController::class);
    Route::apiResource('purchases', PurchaseController::class);
    Route::post('purchases/{purchase}/receive',  [PurchaseController::class, 'receiveGoods']);
    Route::post('purchases/{purchase}/cancel',   [PurchaseController::class, 'cancel']);

    // ── INVENTORY ────────────────────────────────────────────────────────────
    Route::get('inventory',                              [InventoryController::class, 'stockOnHand']);
    Route::get('inventory/movements',                    [InventoryController::class, 'movements']);
    Route::post('inventory/adjust',                      [InventoryController::class, 'adjust']);
    Route::post('inventory/stock-counts',                [InventoryController::class, 'startCount']);
    Route::put('inventory/stock-counts/{count}',         [InventoryController::class, 'updateCount']);
    Route::post('inventory/stock-counts/{count}/post',   [InventoryController::class, 'postCount']);

    // ── CRM ──────────────────────────────────────────────────────────────────
    Route::apiResource('customers', CustomerController::class);
    Route::apiResource('leads',     LeadController::class);
    Route::post('leads/{lead}/convert', [LeadController::class, 'convert']);

    // ── SALES ────────────────────────────────────────────────────────────────
    Route::apiResource('sales', SalesController::class);
    Route::post('sales/{salesBill}/post',        [SalesController::class, 'post']);
    Route::post('sales/{salesBill}/void',        [SalesController::class, 'void']);
    Route::post('sales/{salesBill}/payments',    [SalesController::class, 'addPayment']);
    Route::post('sales/{salesBill}/returns',     [\App\Http\Controllers\Api\ReturnController::class, 'store']);

    // ── REPORTS ──────────────────────────────────────────────────────────────
    Route::prefix('reports')->group(function () {
        Route::get('dashboard',       [ReportController::class, 'dashboard']);
        Route::get('daily-sales',     [ReportController::class, 'dailySales']);
        Route::get('stock-on-hand',   [ReportController::class, 'stockOnHand']);
        Route::get('stock-valuation', [ReportController::class, 'stockValuation']);
        Route::get('outstanding',     [ReportController::class, 'outstandingReceivables']);
        Route::get('purchases',       [ReportController::class, 'purchaseRegister']);
        Route::get('audit-log',       [ReportController::class, 'auditLog']);
        Route::get('staff-activity',  [ReportController::class, 'staffActivity']);
    });

    // ── USER MANAGEMENT ──────────────────────────────────────────────────────
    Route::apiResource('users', UserController::class);
    Route::apiResource('roles', \App\Http\Controllers\Api\RoleController::class);

    // ── DAY CLOSE ────────────────────────────────────────────────────────────
    Route::post('day-close',     [\App\Http\Controllers\Api\DayCloseController::class, 'store']);
    Route::get('day-close',      [\App\Http\Controllers\Api\DayCloseController::class, 'index']);
    Route::get('day-close/summary',  [\App\Http\Controllers\Api\DayCloseController::class, 'summary']);
    Route::post('day-close',         [\App\Http\Controllers\Api\DayCloseController::class, 'close']);
});
