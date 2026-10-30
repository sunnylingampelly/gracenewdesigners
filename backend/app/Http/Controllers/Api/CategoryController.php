<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\AuditEvent;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index()
    {
        return Category::orderBy('sort_order')->orderBy('name')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'        => 'required|string|max:100|unique:categories,name',
            'description' => 'nullable|string',
            'sort_order'  => 'nullable|integer',
        ]);

        $category = Category::create($data);

        AuditEvent::log('category', 'create', $category, null, $request->user());

        return response()->json($category, 201);
    }

    public function update(Request $request, Category $category)
    {
        $data = $request->validate([
            'name'        => 'sometimes|string|max:100|unique:categories,name,' . $category->id,
            'description' => 'nullable|string',
            'sort_order'  => 'nullable|integer',
        ]);

        $category->update($data);

        AuditEvent::log('category', 'update', $category, null, $request->user());

        return $category;
    }

    public function destroy(Request $request, Category $category)
    {
        if ($category->products()->exists()) {
            return response()->json(['message' => 'Cannot delete category with products.'], 422);
        }

        AuditEvent::log('category', 'delete', $category, null, $request->user());
        $category->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}
