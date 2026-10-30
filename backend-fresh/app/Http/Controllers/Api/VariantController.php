<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\AuditEvent;
use Illuminate\Http\Request;

class VariantController extends Controller
{
    public function index(Product $product)
    {
        return $product->variants()->orderBy('size')->get();
    }

    public function store(Request $request, Product $product)
    {
        $data = $request->validate([
            'sku'               => 'required|string|max:100|unique:product_variants,sku',
            'size'              => 'nullable|string|max:20',
            'color'             => 'nullable|string|max:50',
            'cost_price'        => 'nullable|numeric|min:0',
            'selling_price'     => 'nullable|numeric|min:0',
            'tax_category'      => 'nullable|string|max:30',
            'reorder_threshold' => 'nullable|integer|min:0',
        ]);

        $variant = $product->variants()->create($data);
        AuditEvent::log('product', 'create_variant', $variant, null, $request->user());

        return response()->json($variant, 201);
    }

    public function update(Request $request, Product $product, ProductVariant $variant)
    {
        abort_if($variant->product_id !== $product->id, 404);

        $data = $request->validate([
            'sku'               => 'sometimes|string|max:100|unique:product_variants,sku,' . $variant->id,
            'size'              => 'nullable|string|max:20',
            'color'             => 'nullable|string|max:50',
            'cost_price'        => 'nullable|numeric|min:0',
            'selling_price'     => 'nullable|numeric|min:0',
            'tax_category'      => 'nullable|string|max:30',
            'reorder_threshold' => 'nullable|integer|min:0',
            'qty_damaged'       => 'nullable|integer|min:0',
        ]);

        $variant->update($data);
        AuditEvent::log('product', 'update_variant', $variant, null, $request->user());

        return $variant;
    }

    public function destroy(Request $request, Product $product, ProductVariant $variant)
    {
        abort_if($variant->product_id !== $product->id, 404);

        if ($variant->qty_on_hand > 0 || $variant->qty_reserved > 0) {
            return response()->json(['message' => 'Cannot delete variant with stock. Adjust stock first.'], 422);
        }

        AuditEvent::log('product', 'delete_variant', $variant, null, $request->user());
        $variant->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}
