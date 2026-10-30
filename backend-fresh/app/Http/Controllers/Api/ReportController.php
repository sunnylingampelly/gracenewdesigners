<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\ProductVariant;
use App\Models\Purchase;
use App\Models\SalesBill;
use App\Models\StockMovement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function dashboard(Request $request)
    {
        $date  = $request->date ?? today()->toDateString();
        $month = $request->month ?? now()->format('Y-m');

        $todayBills = SalesBill::whereDate('bill_date', $date)->where('status', '!=', 'void');
        $monthBills = SalesBill::whereBetween('bill_date', ["{$month}-01", now()->endOfMonth()->toDateString()])
                               ->where('status', '!=', 'void');

        return response()->json([
            'today' => [
                'sales'       => $todayBills->sum('total_amount'),
                'count'       => $todayBills->count(),
                'avg_bill'    => $todayBills->avg('total_amount') ?? 0,
                'collected'   => Payment::whereHas('bill', fn($q) => $q->whereDate('bill_date', $date))->sum('amount'),
                'outstanding' => SalesBill::whereDate('bill_date', $date)->where('status', 'partial')->sum('amount_due'),
            ],
            'month' => [
                'sales'     => $monthBills->sum('total_amount'),
                'count'     => $monthBills->count(),
                'discounts' => $monthBills->sum('discount_amount'),
                'returns'   => $monthBills->where('status', 'refunded')->count(),
            ],
            'low_stock' => ProductVariant::whereColumn('qty_on_hand', '<=', 'reorder_threshold')
                ->where('is_active', true)
                ->with('product')
                ->count(),
        ]);
    }

    public function dailySales(Request $request)
    {
        $request->validate(['date' => 'required|date']);
        $date = $request->date;

        $bills = SalesBill::with(['customer', 'creator', 'lineItems', 'payments'])
            ->whereDate('bill_date', $date)
            ->where('status', '!=', 'void')
            ->get();

        $paymentModes = Payment::whereHas('bill', fn($q) => $q->whereDate('bill_date', $date))
            ->selectRaw('mode, SUM(amount) as total')
            ->groupBy('mode')
            ->pluck('total', 'mode');

        return response()->json([
            'date'          => $date,
            'gross_sales'   => $bills->sum('total_amount'),
            'discounts'     => $bills->sum('discount_amount'),
            'net_sales'     => $bills->sum('total_amount') - $bills->sum('discount_amount'),
            'bill_count'    => $bills->count(),
            'avg_bill'      => $bills->avg('total_amount') ?? 0,
            'payment_modes' => $paymentModes,
            'bills'         => $bills->values(),
        ]);
    }

    public function stockOnHand(Request $request)
    {
        $q = ProductVariant::with(['product.category'])
            ->where('is_active', true)
            ->when($request->category_id, fn($q, $v) => $q->whereHas('product', fn($pq) => $pq->where('category_id', $v)))
            ->when($request->low_stock, fn($q) => $q->whereColumn('qty_on_hand', '<=', 'reorder_threshold'))
            ->when($request->search, fn($q, $v) => $q->where('sku', 'like', "%$v%"));

        return response()->json($q->paginate($request->per_page ?? 50));
    }

    public function stockValuation(Request $request)
    {
        $variants = ProductVariant::with('product')
            ->where('is_active', true)
            ->get()
            ->map(fn($v) => [
                'sku'           => $v->sku,
                'product_name'  => $v->product->name,
                'qty_on_hand'   => $v->qty_on_hand,
                'cost_price'    => $v->cost_price,
                'stock_value'   => $v->qty_on_hand * ($v->cost_price ?? 0),
                'selling_price' => $v->selling_price,
                'retail_value'  => $v->qty_on_hand * ($v->selling_price ?? 0),
            ]);

        return response()->json([
            'items'              => $variants,
            'total_stock_value'  => $variants->sum('stock_value'),
            'total_retail_value' => $variants->sum('retail_value'),
        ]);
    }

    public function outstandingReceivables(Request $request)
    {
        $bills = SalesBill::with(['customer', 'creator'])
            ->whereIn('status', ['partial', 'posted'])
            ->where('amount_due', '>', 0)
            ->when($request->staff_id, fn($q, $v) => $q->where('created_by', $v))
            ->orderBy('bill_date')
            ->get()
            ->map(fn($b) => [
                'bill_number'  => $b->bill_number,
                'customer'     => $b->customer?->name ?? $b->walk_in_name,
                'bill_date'    => $b->bill_date->toDateString(),
                'days_overdue' => now()->diffInDays($b->bill_date),
                'total'        => $b->total_amount,
                'paid'         => $b->amount_paid,
                'due'          => $b->amount_due,
                'staff'        => $b->creator->name,
            ]);

        return response()->json(['bills' => $bills, 'total_due' => $bills->sum('due')]);
    }

    public function purchaseRegister(Request $request)
    {
        return response()->json(
            Purchase::with(['supplier', 'creator', 'items.variant.product'])
                ->when($request->supplier_id, fn($q, $v) => $q->where('supplier_id', $v))
                ->when($request->date_from, fn($q, $v) => $q->where('order_date', '>=', $v))
                ->when($request->date_to, fn($q, $v) => $q->where('order_date', '<=', $v))
                ->latest('order_date')
                ->paginate($request->per_page ?? 25)
        );
    }

    public function auditLog(Request $request)
    {
        $q = \App\Models\AuditEvent::with('user')
            ->when($request->module, fn($q, $v) => $q->where('module', $v))
            ->when($request->action, fn($q, $v) => $q->where('action', $v))
            ->when($request->user_id, fn($q, $v) => $q->where('user_id', $v))
            ->when($request->date_from, fn($q, $v) => $q->where('created_at', '>=', $v))
            ->when($request->date_to, fn($q, $v) => $q->where('created_at', '<=', $v . ' 23:59:59'))
            ->latest('created_at');

        return response()->json($q->paginate($request->per_page ?? 50));
    }

    public function staffActivity(Request $request)
    {
        $dateFrom = $request->date_from ?? now()->startOfMonth()->toDateString();
        $dateTo   = $request->date_to   ?? today()->toDateString();

        $data = DB::table('users')
            ->join('roles', 'users.role_id', '=', 'roles.id')
            ->leftJoin('sales_bills', function ($j) use ($dateFrom, $dateTo) {
                $j->on('sales_bills.created_by', '=', 'users.id')
                  ->whereBetween('sales_bills.bill_date', [$dateFrom, $dateTo])
                  ->whereNotIn('sales_bills.status', ['void']);
            })
            ->selectRaw('users.id, users.name, roles.display_name as role, COUNT(DISTINCT sales_bills.id) as bill_count, COALESCE(SUM(sales_bills.total_amount), 0) as total_sales, COALESCE(SUM(sales_bills.discount_amount), 0) as total_discounts')
            ->groupBy('users.id', 'users.name', 'roles.display_name')
            ->where('users.is_active', true)
            ->get();

        return response()->json($data);
    }
}
