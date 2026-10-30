<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\AuditEvent;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        $q = Customer::withCount('bills')
            ->orderByDesc('created_at');

        if ($search = $request->query('search')) {
            $q->where(function ($q) use ($search) {
                $q->where('name', 'like', "%$search%")
                  ->orWhere('phone', 'like', "%$search%")
                  ->orWhere('email', 'like', "%$search%");
            });
        }

        return $q->paginate(25);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'               => 'required|string|max:150',
            'phone'              => 'required|string|max:20',
            'email'              => 'nullable|email|max:150',
            'address'            => 'nullable|string',
            'preferred_contact'  => 'nullable|in:phone,whatsapp,email',
            'marketing_consent'  => 'boolean',
            'notes'              => 'nullable|string',
        ]);

        $customer = Customer::create($data);
        AuditEvent::log('crm', 'create_customer', $customer, null, $request->user());

        return response()->json($customer, 201);
    }

    public function show(Customer $customer)
    {
        return $customer->load([
            'bills' => fn($q) => $q->orderByDesc('bill_date')->limit(20),
        ]);
    }

    public function update(Request $request, Customer $customer)
    {
        $data = $request->validate([
            'name'              => 'sometimes|string|max:150',
            'phone'             => 'sometimes|string|max:20',
            'email'             => 'nullable|email|max:150',
            'address'           => 'nullable|string',
            'preferred_contact' => 'nullable|in:phone,whatsapp,email',
            'marketing_consent' => 'boolean',
            'notes'             => 'nullable|string',
        ]);

        $customer->update($data);
        AuditEvent::log('crm', 'update_customer', $customer, null, $request->user());

        return $customer;
    }

    public function measurements(Request $request, Customer $customer)
    {
        $data = $request->validate([
            'measurements' => 'required|array',
        ]);

        $customer->update(['measurements' => $data['measurements']]);
        AuditEvent::log('crm', 'update_measurements', $customer, null, $request->user());

        return $customer;
    }
}
