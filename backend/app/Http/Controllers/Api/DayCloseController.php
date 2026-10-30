<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DayClose;
use App\Models\SalesBill;
use App\Models\Payment;
use App\Models\AuditEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DayCloseController extends Controller
{
    public function index()
    {
        return DayClose::with('closedBy')->orderByDesc('close_date')->paginate(30);
    }

    public function summary(Request $request)
    {
        $date = $request->query('date', today()->toDateString());

        $bills = SalesBill::whereDate('bill_date', $date)
            ->where('status', 'posted')
            ->get();

        $payments = Payment::whereDate('created_at', $date)->get();

        $byMode = $payments->groupBy('mode')->map->sum('amount');

        return [
            'date'         => $date,
            'bill_count'   => $bills->count(),
            'gross_sales'  => $bills->sum('subtotal'),
            'discounts'    => $bills->sum('discount_amount'),
            'tax'          => $bills->sum('tax_amount'),
            'net_sales'    => $bills->sum('grand_total'),
            'collected'    => $payments->sum('amount'),
            'by_mode'      => $byMode,
            'outstanding'  => $bills->sum('amount_due'),
            'already_closed' => DayClose::where('close_date', $date)->exists(),
        ];
    }

    public function close(Request $request)
    {
        $data = $request->validate([
            'close_date' => 'required|date',
            'notes'      => 'nullable|string',
        ]);

        if (DayClose::where('close_date', $data['close_date'])->exists()) {
            return response()->json(['message' => 'Day already closed for this date.'], 422);
        }

        $dayClose = DB::transaction(function () use ($data, $request) {
            $date = $data['close_date'];

            $bills = SalesBill::whereDate('bill_date', $date)->where('status', 'posted')->get();
            $payments = Payment::whereDate('created_at', $date)->get();

            $dayClose = DayClose::create([
                'close_date'   => $date,
                'closed_by'    => $request->user()->id,
                'notes'        => $data['notes'] ?? null,
                'bill_count'   => $bills->count(),
                'gross_sales'  => $bills->sum('subtotal'),
                'net_sales'    => $bills->sum('grand_total'),
                'collected'    => $payments->sum('amount'),
                'summary_json' => [
                    'by_mode' => $payments->groupBy('mode')->map->sum('amount'),
                ],
            ]);

            AuditEvent::log('system', 'day_close', $dayClose, null, $request->user());

            return $dayClose;
        });

        return response()->json($dayClose, 201);
    }
}
