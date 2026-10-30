<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Models\Customer;
use App\Models\AuditEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LeadController extends Controller
{
    public function index(Request $request)
    {
        $q = Lead::with(['customer', 'assignedTo'])
            ->orderByDesc('created_at');

        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }

        if ($search = $request->query('search')) {
            $q->whereHas('customer', fn($q) => $q->where('name', 'like', "%$search%")
                ->orWhere('phone', 'like', "%$search%"));
        }

        return $q->paginate(25);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'customer_id'     => 'required|exists:customers,id',
            'occasion'        => 'nullable|string|max:150',
            'source'          => 'nullable|in:walk_in,referral,instagram,whatsapp,other',
            'notes'           => 'nullable|string',
            'follow_up_date'  => 'nullable|date',
            'assigned_to'     => 'nullable|exists:users,id',
            'budget_estimate' => 'nullable|numeric|min:0',
        ]);

        $data['status'] = 'new';
        $lead = Lead::create($data);
        AuditEvent::log('crm', 'create_lead', $lead, null, $request->user());

        return response()->json($lead->load('customer'), 201);
    }

    public function show(Lead $lead)
    {
        return $lead->load(['customer', 'assignedTo', 'convertedBill']);
    }

    public function update(Request $request, Lead $lead)
    {
        $data = $request->validate([
            'status'          => 'sometimes|in:new,contacted,quoted,won,lost',
            'occasion'        => 'nullable|string|max:150',
            'notes'           => 'nullable|string',
            'follow_up_date'  => 'nullable|date',
            'assigned_to'     => 'nullable|exists:users,id',
            'budget_estimate' => 'nullable|numeric|min:0',
        ]);

        $lead->update($data);
        AuditEvent::log('crm', 'update_lead', $lead, $data['status'] ?? null, $request->user());

        return $lead;
    }

    public function convert(Request $request, Lead $lead)
    {
        if ($lead->status === 'won') {
            return response()->json(['message' => 'Lead already converted.'], 422);
        }

        $lead->update(['status' => 'won']);
        AuditEvent::log('crm', 'convert_lead', $lead, null, $request->user());

        return response()->json(['message' => 'Lead marked as won. Create a bill from Sales.']);
    }
}
