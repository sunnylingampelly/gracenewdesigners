<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\AuditEvent;
use Illuminate\Http\Request;

class ProductImageController extends Controller
{
    public function store(Request $request, Product $product)
    {
        $request->validate([
            'image'      => 'required|image|max:5120',
            'is_primary' => 'boolean',
            'sort_order' => 'nullable|integer',
        ]);

        $path = $request->file('image')->store("products/{$product->id}", 'public');

        if ($request->boolean('is_primary')) {
            $product->images()->update(['is_primary' => false]);
        }

        $image = $product->images()->create([
            'path'       => $path,
            'is_primary' => $request->boolean('is_primary'),
            'sort_order' => $request->input('sort_order', 0),
        ]);

        AuditEvent::log('product', 'upload_image', $product, null, $request->user());

        return response()->json($image, 201);
    }

    public function setPrimary(Product $product, ProductImage $image)
    {
        abort_if($image->product_id !== $product->id, 404);

        $product->images()->update(['is_primary' => false]);
        $image->update(['is_primary' => true]);

        return response()->json($image->fresh());
    }

    public function destroy(Request $request, Product $product, ProductImage $image)
    {
        abort_if($image->product_id !== $product->id, 404);

        \Illuminate\Support\Facades\Storage::disk('public')->delete($image->path);
        $image->delete();

        AuditEvent::log('product', 'delete_image', $product, null, $request->user());

        return response()->json(['message' => 'Image deleted.']);
    }
}
