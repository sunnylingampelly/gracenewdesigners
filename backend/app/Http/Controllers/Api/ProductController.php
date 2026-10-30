<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditEvent;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $q = Product::with(['category', 'collection', 'primaryImage', 'variants'])
            ->when($request->status, fn($q, $v) => $q->where('status', $v))
            ->when($request->category_id, fn($q, $v) => $q->where('category_id', $v))
            ->when($request->collection_id, fn($q, $v) => $q->where('collection_id', $v))
            ->when($request->occasion, fn($q, $v) => $q->where('occasion', $v))
            ->when($request->search, fn($q, $v) => $q->where('name', 'like', "%$v%"))
            ->latest();

        return response()->json($q->paginate($request->per_page ?? 20));
    }

    public function publicIndex(Request $request)
    {
        $q = Product::with(['category', 'collection', 'images'])
            ->published()
            ->when($request->category_id, fn($q, $v) => $q->where('category_id', $v))
            ->when($request->collection_id, fn($q, $v) => $q->where('collection_id', $v))
            ->when($request->occasion, fn($q, $v) => $q->where('occasion', $v))
            ->latest();

        return response()->json($q->paginate($request->per_page ?? 12));
    }

    public function publicShow(Product $product)
    {
        if ($product->status !== 'published') {
            abort(404);
        }

        $product->load(['category', 'collection', 'images', 'variants' => fn($q) => $q->orderBy('size')]);

        $data = $product->toArray();
        foreach ($data['variants'] as &$v) {
            unset($v['cost_price']);
        }

        return response()->json($data);
    }

    public function show(Product $product)
    {
        $product->load(['category', 'collection', 'images', 'variants' => fn($q) => $q->where('is_active', true)]);

        $data = $product->toArray();

        // Strip cost price from public-accessible endpoint
        if (!request()->user()?->hasPermission('view_cost_price')) {
            foreach ($data['variants'] as &$v) {
                unset($v['cost_price']);
            }
        }

        return response()->json($data);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'category_id'    => 'required|exists:categories,id',
            'collection_id'  => 'nullable|exists:collections,id',
            'name'           => 'required|string|max:255',
            'description'    => 'nullable|string',
            'fabric'         => 'nullable|string',
            'craftsmanship'  => 'nullable|string',
            'care_notes'     => 'nullable|string',
            'occasion'       => 'nullable|string',
            'fit'            => 'nullable|string',
            'status'         => 'in:draft,published,archived',
            'show_price'     => 'boolean',
        ]);

        $data['slug']       = Str::slug($data['name']) . '-' . Str::random(4);
        $data['created_by'] = $request->user()->id;

        $product = Product::create($data);
        AuditEvent::log('product', 'create', $product, ['after' => $product->toArray()]);

        return response()->json($product->load(['category', 'collection']), 201);
    }

    public function update(Request $request, Product $product)
    {
        $before = $product->toArray();
        $data   = $request->validate([
            'category_id'   => 'sometimes|exists:categories,id',
            'collection_id' => 'nullable|exists:collections,id',
            'name'          => 'sometimes|string|max:255',
            'description'   => 'nullable|string',
            'fabric'        => 'nullable|string',
            'craftsmanship' => 'nullable|string',
            'care_notes'    => 'nullable|string',
            'occasion'      => 'nullable|string',
            'fit'           => 'nullable|string',
            'status'        => 'in:draft,published,archived',
            'show_price'    => 'boolean',
        ]);

        if (isset($data['name'])) {
            $data['slug'] = Str::slug($data['name']) . '-' . Str::random(4);
        }

        $product->update($data);
        AuditEvent::log('product', 'update', $product, ['before' => $before, 'after' => $product->fresh()->toArray()]);

        return response()->json($product->fresh()->load(['category', 'collection']));
    }

    public function destroy(Product $product)
    {
        AuditEvent::log('product', 'delete', $product, ['before' => $product->toArray()]);
        $product->delete();
        return response()->json(['message' => 'Product archived.']);
    }
}
