<?php

namespace App\Services;

use App\Models\AuditEvent;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;

class InventoryService
{
    /**
     * Core stock movement. $qty: positive = in, negative = out.
     * $variantId accepts an int (ID) or ProductVariant instance.
     */
    public function move(
        int|ProductVariant $variantId,
        int $qty,
        string $type,
        $reference = null,
        string $reason = '',
        $user = null
    ): StockMovement {
        return DB::transaction(function () use ($variantId, $qty, $type, $reference, $reason, $user) {
            $variant = $variantId instanceof ProductVariant
                ? ProductVariant::lockForUpdate()->find($variantId->id)
                : ProductVariant::lockForUpdate()->findOrFail($variantId);

            $qtyBefore = $variant->qty_on_hand;
            $qtyAfter  = $qtyBefore + $qty;

            if ($qtyAfter < 0) {
                throw new \RuntimeException("Insufficient stock for SKU {$variant->sku}. Available: {$qtyBefore}");
            }

            $movement = StockMovement::create([
                'product_variant_id' => $variant->id,
                'created_by'         => $user?->id ?? auth()->id(),
                'movement_type'      => $type,
                'quantity'           => $qty,
                'qty_before'         => $qtyBefore,
                'qty_after'          => $qtyAfter,
                'reference_type'     => $reference ? get_class($reference) : null,
                'reference_id'       => $reference?->id,
                'reason'             => $reason,
                'status'             => 'posted',
                'posted_at'          => now(),
            ]);

            $variant->update(['qty_on_hand' => $qtyAfter]);

            return $movement;
        });
    }

    /** Increase stock from a goods receipt. */
    public function receiveGoods(int $variantId, int $qty, $reference, $user = null): StockMovement
    {
        return $this->move($variantId, $qty, 'receipt', $reference, 'Goods receipt', $user);
    }

    /** Mark incoming units as damaged (no qty_on_hand increase, increment qty_damaged). */
    public function receiveDamaged(int $variantId, int $qty, $reference, $user = null): void
    {
        DB::transaction(function () use ($variantId, $qty, $reference, $user) {
            $variant = ProductVariant::lockForUpdate()->findOrFail($variantId);

            StockMovement::create([
                'product_variant_id' => $variant->id,
                'created_by'         => $user?->id ?? auth()->id(),
                'movement_type'      => 'damage',
                'quantity'           => 0,
                'qty_before'         => $variant->qty_on_hand,
                'qty_after'          => $variant->qty_on_hand,
                'reference_type'     => $reference ? get_class($reference) : null,
                'reference_id'       => $reference?->id,
                'reason'             => "Damaged on receipt",
                'status'             => 'posted',
                'posted_at'          => now(),
            ]);

            $variant->increment('qty_damaged', $qty);
        });
    }

    /** Deduct stock when a bill is posted. */
    public function deductForSale(int $variantId, int $qty, $reference, $user = null): StockMovement
    {
        return $this->move($variantId, -$qty, 'sale', $reference, 'Sale', $user);
    }

    /** Restore stock from a customer return based on condition. */
    public function restoreFromReturn(int $variantId, int $qty, string $condition, $reference, $user = null): void
    {
        if ($condition === 'resellable') {
            $this->move($variantId, $qty, 'return', $reference, 'Customer return — resellable', $user);
        } else {
            // damaged or non-resellable: don't restore to available stock, just note it
            DB::transaction(function () use ($variantId, $qty, $reference, $user) {
                $variant = ProductVariant::lockForUpdate()->findOrFail($variantId);
                StockMovement::create([
                    'product_variant_id' => $variant->id,
                    'created_by'         => $user?->id ?? auth()->id(),
                    'movement_type'      => 'return_damaged',
                    'quantity'           => 0,
                    'qty_before'         => $variant->qty_on_hand,
                    'qty_after'          => $variant->qty_on_hand,
                    'reference_type'     => $reference ? get_class($reference) : null,
                    'reference_id'       => $reference?->id,
                    'reason'             => "Return — condition: {$condition}",
                    'status'             => 'posted',
                    'posted_at'          => now(),
                ]);
                $variant->increment('qty_damaged', $qty);
            });
        }
    }
}
