<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use App\Models\AuditEvent;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function index(Request $request)
    {
        $q = Supplier::orderBy('name');

        if ($search = $request->query('search')) {
            $q->where('name', 'like', "%$search%")
              ->orWhere('contact_name', 'like', "%$search%");
        }

        return $q->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'         => 'required|string|max:150',
            'contact_name' => 'nullable|string|max:150',
            'phone'        => 'nullable|string|max:20',
            'email'        => 'nullable|email|max:150',
            'address'      => 'nullable|string',
            'gstin'        => 'nullable|string|max:15',
            'notes'        => 'nullable|string',
            'payment_terms'=> 'nullable|integer|min:0',
        ]);

        $supplier = Supplier::create($data);
        AuditEvent::log('purchase', 'create_supplier', $supplier, null, $request->user());

        return response()->json($supplier, 201);
    }

    public function show(Supplier $supplier)
    {
        return $supplier->load(['purchases' => fn($q) => $q->orderByDesc('order_date')->limit(20)]);
    }

    public function update(Request $request, Supplier $supplier)
    {
        $data = $request->validate([
            'name'         => 'sometimes|string|max:150',
            'contact_name' => 'nullable|string|max:150',
            'phone'        => 'nullable|string|max:20',
            'email'        => 'nullable|email|max:150',
            'address'      => 'nullable|string',
            'gstin'        => 'nullable|string|max:15',
            'notes'        => 'nullable|string',
            'payment_terms'=> 'nullable|integer|min:0',
        ]);

        $supplier->update($data);
        AuditEvent::log('purchase', 'update_supplier', $supplier, null, $request->user());

        return $supplier;
    }
}
