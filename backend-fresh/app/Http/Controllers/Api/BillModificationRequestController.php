<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BillModificationRequest;
use App\Models\SalesBill;
use Illuminate\Http\Request;

class BillModificationRequestController extends Controller {

    private function isAdmin($user): bool {
        return $user->role?->name === 'super_admin' ||
               (is_array($user->role?->permissions) && in_array('users', $user->role->permissions));
    }

    // GET /modification-requests — admin: all; staff: own requests
    public function index(Request $request) {
        $user    = $request->user();
        $isAdmin = $this->isAdmin($user);
        $q = BillModificationRequest::with(['bill','requester','reviewer'])
               ->orderBy('created_at', 'desc');
        if (!$isAdmin) {
            $q->where('requested_by', $user->id);
        }
        if ($request->status) {
            $q->where('status', $request->status);
        }
        return response()->json($q->paginate(25));
    }

    // GET /sales/{salesBill}/modification-requests
    public function forBill(Request $request, SalesBill $salesBill) {
        $user    = $request->user();
        $isAdmin = $this->isAdmin($user);
        if (!$isAdmin && $salesBill->created_by !== $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $requests = BillModificationRequest::with(['requester','reviewer'])
                      ->where('bill_id', $salesBill->id)
                      ->orderBy('created_at', 'desc')
                      ->get();
        return response()->json($requests);
    }

    // POST /sales/{salesBill}/modification-requests
    public function store(Request $request, SalesBill $salesBill) {
        $user    = $request->user();
        $isAdmin = $this->isAdmin($user);

        if ($salesBill->created_by !== $user->id && !$isAdmin) {
            return response()->json(['message' => 'You can only request modification on your own bills.'], 403);
        }
        if (in_array($salesBill->status, ['void', 'refunded'])) {
            return response()->json(['message' => 'Cannot request modification on a voided or refunded bill.'], 422);
        }
        $hasPending = BillModificationRequest::where('bill_id', $salesBill->id)
                        ->where('status', 'pending')->exists();
        if ($hasPending) {
            return response()->json(['message' => 'A pending modification request already exists for this bill.'], 422);
        }

        $data = $request->validate(['reason' => 'required|string|min:5|max:1000']);

        $req = BillModificationRequest::create([
            'bill_id'      => $salesBill->id,
            'requested_by' => $user->id,
            'reason'       => $data['reason'],
            'status'       => 'pending',
        ]);

        // Log to audit trail if service exists
        if (class_exists(\App\Services\AuditService::class)) {
            try {
                \App\Services\AuditService::log('sale', 'modification_request', $salesBill->id,
                    'Modification requested: ' . $data['reason']);
            } catch (\Throwable) {}
        }

        return response()->json($req->load(['requester', 'reviewer']), 201);
    }

    // PUT /modification-requests/{modRequest} — admin only
    public function update(Request $request, BillModificationRequest $modRequest) {
        $user = $request->user();
        if (!$this->isAdmin($user)) {
            return response()->json(['message' => 'Only administrators can review modification requests.'], 403);
        }
        $data = $request->validate([
            'status'      => 'required|in:approved,rejected,completed',
            'admin_notes' => 'nullable|string|max:1000',
        ]);
        $modRequest->update([
            'status'      => $data['status'],
            'admin_notes' => $data['admin_notes'] ?? null,
            'reviewed_by' => $user->id,
        ]);

        if (class_exists(\App\Services\AuditService::class)) {
            try {
                \App\Services\AuditService::log('sale', 'modification_' . $data['status'], $modRequest->bill_id,
                    'Admin notes: ' . ($data['admin_notes'] ?? ''));
            } catch (\Throwable) {}
        }

        return response()->json($modRequest->load(['requester', 'reviewer']));
    }
}
