<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Collection;
use App\Models\AuditEvent;
use Illuminate\Http\Request;

class CollectionController extends Controller
{
    public function index()
    {
        return Collection::withCount('products')->orderByDesc('created_at')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'        => 'required|string|max:150',
            'description' => 'nullable|string',
            'season'      => 'nullable|string|max:50',
            'year'        => 'nullable|integer|min:2000|max:2099',
            'is_active'   => 'boolean',
        ]);

        $collection = Collection::create($data);
        AuditEvent::log('collection', 'create', $collection, null, $request->user());

        return response()->json($collection, 201);
    }

    public function show(Collection $collection)
    {
        return $collection->load(['products.category', 'products.variants', 'products.images']);
    }

    public function update(Request $request, Collection $collection)
    {
        $data = $request->validate([
            'name'        => 'sometimes|string|max:150',
            'description' => 'nullable|string',
            'season'      => 'nullable|string|max:50',
            'year'        => 'nullable|integer|min:2000|max:2099',
            'is_active'   => 'boolean',
        ]);

        $collection->update($data);
        AuditEvent::log('collection', 'update', $collection, null, $request->user());

        return $collection;
    }

    public function destroy(Request $request, Collection $collection)
    {
        $collection->products()->update(['collection_id' => null]);
        AuditEvent::log('collection', 'delete', $collection, null, $request->user());
        $collection->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}
