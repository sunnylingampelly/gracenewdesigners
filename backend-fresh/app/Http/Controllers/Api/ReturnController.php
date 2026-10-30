<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalesBill;
use App\Models\BillReturn;
use App\Models\AuditEvent;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReturnController extends Controller
{
    public function store(Request $request, SalesBill $bill, InventoryService $inv)
    {
        if ($bill->status !== 'posted') {
            return response()->json(['message' => 'Can only return items from a posted bill.'], 422);
        }

        $data = $request->validate([
            'items'                  => 'required|array|min:1',
            'items.*.variant_id'     => 'required|exists:product_variants,id',
            'items.*.qty'            => 'required|integer|min:1',
            'items.*.reason'         => 'required|string|max:255',
            'items.*.condition'      => 'required|in:resellable,damaged,non_resellable',
        ]);

        DB::transaction(function () use ($data, $bill, $inv, $request) {
            foreach ($data['items'] as $item) {
                $return = BillReturn::create([
                    'sales_bill_id'      => $bill->id,
                    'product_variant_id' => $item['variant_id'],
                    'qty'                => $item['qty'],
                    'reason'             => $item['reason'],
                    'condition'          => $item['condition'],
                    'processed_by'       => $request->user()->id,
                ]);

                $inv->restoreFromReturn(
                    $item['variant_id'],
                    $item['qty'],
                    $item['condition'],
                    $return,
                    $request->user()
                );
            }

            AuditEvent::log('sale', 'return', $bill, $request->input('reason'), $request->user());
        });

        return response()->json(['message' => 'Return recorded and stock updated.']);
    }
}
