<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductVariant;
use App\Models\StockCount;
use App\Models\AuditEvent;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryController extends Controller
{
    public function stockOnHand(Request $request)
    {
        $q = ProductVariant::with(['product.category'])
            ->orderBy('sku');

        if ($search = $request->query('search')) {
            $q->where('sku', 'like', "%$search%")
              ->orWhereHas('product', fn($q) => $q->where('name', 'like', "%$search%"));
        }

        if ($request->query('low_stock')) {
            $q->whereRaw('qty_on_hand - qty_reserved <= reorder_threshold');
        }

        return $q->paginate(50);
    }

    public function movements(Request $request)
    {
        $q = \App\Models\StockMovement::with(['variant.product', 'createdBy'])
            ->orderByDesc('created_at');

        if ($variantId = $request->query('variant_id')) {
            $q->where('product_variant_id', $variantId);
        }

        if ($type = $request->query('movement_type')) {
            $q->where('movement_type', $type);
        }

        return $q->paginate(50);
    }

    public function adjust(Request $request, InventoryService $inv)
    {
        $data = $request->validate([
            'variant_id' => 'required|exists:product_variants,id',
            'qty'        => 'required|integer|not_in:0',
            'reason'     => 'required|string|max:255',
        ]);

        $inv->move(
            $data['variant_id'],
            $data['qty'],
            'adjustment',
            null,
            $data['reason'],
            $request->user()
        );

        return response()->json(['message' => 'Stock adjusted.']);
    }

    public function startCount(Request $request)
    {
        $count = StockCount::create([
            'started_by' => $request->user()->id,
            'status'     => 'in_progress',
            'notes'      => $request->input('notes'),
        ]);

        $variants = ProductVariant::select('id', 'product_id', 'sku', 'qty_on_hand')->get();
        foreach ($variants as $v) {
            $count->items()->create([
                'product_variant_id' => $v->id,
                'system_qty'         => $v->qty_on_hand,
                'counted_qty'        => null,
            ]);
        }

        AuditEvent::log('inventory', 'start_count', $count, null, $request->user());

        return response()->json($count->load('items.variant'), 201);
    }

    public function updateCount(Request $request, StockCount $count)
    {
        if ($count->status !== 'in_progress') {
            return response()->json(['message' => 'Count is not in progress.'], 422);
        }

        $data = $request->validate([
            'items'                      => 'required|array',
            'items.*.stock_count_item_id'=> 'required|exists:stock_count_items,id',
            'items.*.counted_qty'        => 'required|integer|min:0',
        ]);

        DB::transaction(function () use ($data, $count) {
            foreach ($data['items'] as $item) {
                $count->items()->where('id', $item['stock_count_item_id'])
                    ->update(['counted_qty' => $item['counted_qty']]);
            }
        });

        return response()->json(['message' => 'Count updated.']);
    }

    public function postCount(Request $request, StockCount $count, InventoryService $inv)
    {
        if ($count->status !== 'in_progress') {
            return response()->json(['message' => 'Count is not in progress.'], 422);
        }

        $uncounted = $count->items()->whereNull('counted_qty')->count();
        if ($uncounted > 0) {
            return response()->json(['message' => "$uncounted items have not been counted yet."], 422);
        }

        DB::transaction(function () use ($count, $inv, $request) {
            foreach ($count->items as $item) {
                $variance = $item->counted_qty - $item->system_qty;
                if ($variance !== 0) {
                    $inv->move(
                        $item->product_variant_id,
                        $variance,
                        'count_adjustment',
                        $count,
                        "Stock count #{$count->id}",
                        $request->user()
                    );
                }
            }

            $count->update([
                'status'     => 'posted',
                'posted_by'  => $request->user()->id,
                'posted_at'  => now(),
            ]);

            AuditEvent::log('inventory', 'post_count', $count, null, $request->user());
        });

        return response()->json(['message' => 'Stock count posted.']);
    }
}
