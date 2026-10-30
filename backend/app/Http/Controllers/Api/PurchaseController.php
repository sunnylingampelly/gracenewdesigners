<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Purchase;
use App\Models\GoodsReceipt;
use App\Models\AuditEvent;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PurchaseController extends Controller
{
    public function index(Request $request)
    {
        $q = Purchase::with('supplier')
            ->withCount('items')
            ->orderByDesc('order_date');

        if ($supplier = $request->query('supplier_id')) {
            $q->where('supplier_id', $supplier);
        }

        return $q->paginate(20);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'supplier_id'        => 'required|exists:suppliers,id',
            'order_date'         => 'required|date',
            'expected_date'      => 'nullable|date',
            'supplier_invoice_no'=> 'nullable|string|max:100',
            'notes'              => 'nullable|string',
            'items'              => 'required|array|min:1',
            'items.*.variant_id' => 'required|exists:product_variants,id',
            'items.*.qty_ordered'=> 'required|integer|min:1',
            'items.*.unit_cost'  => 'required|numeric|min:0',
        ]);

        // Duplicate invoice detection
        if (!empty($data['supplier_invoice_no'])) {
            $exists = Purchase::where('supplier_id', $data['supplier_id'])
                ->where('supplier_invoice_no', $data['supplier_invoice_no'])
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'Supplier invoice number already recorded for this supplier.'], 422);
            }
        }

        $purchase = DB::transaction(function () use ($data, $request) {
            $total = collect($data['items'])->sum(fn($i) => $i['qty_ordered'] * $i['unit_cost']);

            $purchase = Purchase::create([
                'supplier_id'         => $data['supplier_id'],
                'reference_number'    => 'PO-' . strtoupper(Str::random(8)),
                'order_date'          => $data['order_date'],
                'expected_date'       => $data['expected_date'] ?? null,
                'supplier_invoice_no' => $data['supplier_invoice_no'] ?? null,
                'notes'               => $data['notes'] ?? null,
                'total_amount'        => $total,
                'status'              => 'ordered',
                'payment_status'      => 'unpaid',
                'created_by'          => $request->user()->id,
            ]);

            foreach ($data['items'] as $item) {
                $purchase->items()->create([
                    'product_variant_id' => $item['variant_id'],
                    'qty_ordered'        => $item['qty_ordered'],
                    'unit_cost'          => $item['unit_cost'],
                    'subtotal'           => $item['qty_ordered'] * $item['unit_cost'],
                ]);
            }

            AuditEvent::log('purchase', 'create', $purchase, null, $request->user());

            return $purchase;
        });

        return response()->json($purchase->load(['supplier', 'items.variant.product']), 201);
    }

    public function show(Purchase $purchase)
    {
        return $purchase->load(['supplier', 'items.variant.product', 'goodsReceipts.items.variant']);
    }

    public function receiveGoods(Request $request, Purchase $purchase, InventoryService $inv)
    {
        if (!in_array($purchase->status, ['ordered', 'partial'])) {
            return response()->json(['message' => 'Purchase cannot receive goods in current status.'], 422);
        }

        $data = $request->validate([
            'notes'                  => 'nullable|string',
            'items'                  => 'required|array|min:1',
            'items.*.purchase_item_id' => 'required|exists:purchase_items,id',
            'items.*.qty_accepted'   => 'required|integer|min:0',
            'items.*.qty_damaged'    => 'nullable|integer|min:0',
            'items.*.qty_rejected'   => 'nullable|integer|min:0',
        ]);

        DB::transaction(function () use ($data, $purchase, $inv, $request) {
            $grn = $purchase->goodsReceipts()->create([
                'received_by' => $request->user()->id,
                'notes'       => $data['notes'] ?? null,
                'posted_at'   => now(),
            ]);

            foreach ($data['items'] as $item) {
                $purchaseItem = $purchase->items()->find($item['purchase_item_id']);
                $accepted = (int) ($item['qty_accepted'] ?? 0);
                $damaged  = (int) ($item['qty_damaged'] ?? 0);

                $grn->items()->create([
                    'purchase_item_id'   => $item['purchase_item_id'],
                    'product_variant_id' => $purchaseItem->product_variant_id,
                    'qty_accepted'       => $accepted,
                    'qty_damaged'        => $damaged,
                    'qty_rejected'       => $item['qty_rejected'] ?? 0,
                ]);

                if ($accepted > 0) {
                    $inv->receiveGoods($purchaseItem->product_variant_id, $accepted, $grn, $request->user());
                }
                if ($damaged > 0) {
                    $inv->receiveDamaged($purchaseItem->product_variant_id, $damaged, $grn, $request->user());
                }
            }

            // Update purchase status
            $allReceived = $purchase->items->every(fn($i) => $i->qty_received >= $i->qty_ordered);
            $purchase->update(['status' => $allReceived ? 'received' : 'partial']);

            AuditEvent::log('purchase', 'grn', $grn, null, $request->user());
        });

        return response()->json(['message' => 'Goods receipt recorded.']);
    }

    public function cancel(Request $request, Purchase $purchase)
    {
        if ($purchase->status === 'received') {
            return response()->json(['message' => 'Cannot cancel a fully received purchase.'], 422);
        }

        $purchase->update(['status' => 'cancelled']);
        AuditEvent::log('purchase', 'cancel', $purchase, $request->input('reason'), $request->user());

        return response()->json(['message' => 'Purchase cancelled.']);
    }
}
