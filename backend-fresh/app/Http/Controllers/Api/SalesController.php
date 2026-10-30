<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BillLineItem;
use App\Models\ProductVariant;
use App\Models\SalesBill;
use App\Services\BillingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SalesController extends Controller
{
    public function __construct(private BillingService $billing) {}

    public function index(Request $request)
    {
        $q = SalesBill::with(['customer', 'creator', 'lineItems.variant.product'])
            ->when($request->status, fn($q, $v) => $q->where('status', $v))
            ->when($request->customer_id, fn($q, $v) => $q->where('customer_id', $v))
            ->when($request->created_by, fn($q, $v) => $q->where('created_by', $v))
            ->when($request->date_from, fn($q, $v) => $q->where('bill_date', '>=', $v))
            ->when($request->date_to, fn($q, $v) => $q->where('bill_date', '<=', $v))
            ->when($request->search, fn($q, $v) => $q->where('bill_number', 'like', "%$v%"))
            ->latest('bill_date');

        return response()->json($q->paginate($request->per_page ?? 20));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'customer_id'     => 'nullable|exists:customers,id',
            'is_walk_in'      => 'boolean',
            'walk_in_name'    => 'nullable|string',
            'bill_date'       => 'required|date',
            'discount_amount' => 'numeric|min:0',
            'discount_reason' => 'nullable|string',
            'notes'           => 'nullable|string',
            'items'           => 'required|array|min:1',
            'items.*.variant_id'      => 'required|exists:product_variants,id',
            'items.*.quantity'        => 'required|integer|min:1',
            'items.*.unit_price'      => 'required|numeric|min:0',
            'items.*.discount_percent'=> 'numeric|min:0|max:100',
            'items.*.tax_rate'        => 'numeric|min:0',
        ]);

        $bill = DB::transaction(function () use ($data, $request) {
            $billNumber = $this->billing->generateBillNumber();

            $bill = SalesBill::create([
                'customer_id'     => $data['customer_id'] ?? null,
                'created_by'      => $request->user()->id,
                'bill_number'     => $billNumber,
                'bill_date'       => $data['bill_date'],
                'discount_amount' => $data['discount_amount'] ?? 0,
                'discount_reason' => $data['discount_reason'] ?? null,
                'notes'           => $data['notes'] ?? null,
                'is_walk_in'      => $data['is_walk_in'] ?? false,
                'walk_in_name'    => $data['walk_in_name'] ?? null,
                'status'          => 'draft',
            ]);

            $subtotal = 0;
            $taxTotal = 0;

            foreach ($data['items'] as $item) {
                $discAmt  = $item['unit_price'] * $item['quantity'] * (($item['discount_percent'] ?? 0) / 100);
                $lineBase = ($item['unit_price'] * $item['quantity']) - $discAmt;
                $taxAmt   = $lineBase * (($item['tax_rate'] ?? 0) / 100);
                $lineTotal = $lineBase + $taxAmt;

                BillLineItem::create([
                    'bill_id'          => $bill->id,
                    'variant_id'       => $item['variant_id'],
                    'quantity'         => $item['quantity'],
                    'unit_price'       => $item['unit_price'],
                    'discount_percent' => $item['discount_percent'] ?? 0,
                    'discount_amount'  => $discAmt,
                    'tax_rate'         => $item['tax_rate'] ?? 0,
                    'tax_amount'       => $taxAmt,
                    'line_total'       => $lineTotal,
                ]);

                $subtotal += $lineBase;
                $taxTotal += $taxAmt;
            }

            $total = $subtotal + $taxTotal - ($data['discount_amount'] ?? 0);
            $bill->update(['subtotal' => $subtotal, 'tax_amount' => $taxTotal, 'total_amount' => $total]);

            return $bill;
        });

        return response()->json($bill->load(['customer', 'lineItems.variant.product', 'payments']), 201);
    }

    public function show(SalesBill $salesBill)
    {
        return response()->json(
            $salesBill->load(['customer', 'creator', 'lineItems.variant.product', 'payments', 'returns', 'refunds'])
        );
    }

    public function post(SalesBill $salesBill)
    {
        $bill = $this->billing->postBill($salesBill);
        return response()->json($bill->load(['lineItems.variant', 'payments']));
    }

    public function void(Request $request, SalesBill $salesBill)
    {
        $request->validate(['reason' => 'required|string']);
        $this->billing->voidBill($salesBill, $request->reason);
        return response()->json(['message' => 'Bill voided.']);
    }

    public function addPayment(Request $request, SalesBill $salesBill)
    {
        $data = $request->validate([
            'mode'         => 'required|in:cash,upi,card,bank_transfer,cheque,other',
            'amount'       => 'required|numeric|min:0.01',
            'reference'    => 'nullable|string',
            'payment_date' => 'required|date',
            'notes'        => 'nullable|string',
        ]);

        if ($data['amount'] > $salesBill->amount_due) {
            return response()->json(['message' => 'Payment exceeds amount due.'], 422);
        }

        $payment = $this->billing->recordPayment($salesBill, $data);
        return response()->json($payment, 201);
    }
}
