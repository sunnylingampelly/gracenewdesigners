<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BillLineItem;
use App\Models\Customer;
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
        $from = $request->date_from ?? today()->toDateString();
        $to   = $request->date_to   ?? today()->toDateString();

        // Previous period (same length)
        $days    = max(1, \Carbon\Carbon::parse($from)->diffInDays(\Carbon\Carbon::parse($to)) + 1);
        $prevTo  = \Carbon\Carbon::parse($from)->subDay()->toDateString();
        $prevFrom= \Carbon\Carbon::parse($prevTo)->subDays($days - 1)->toDateString();

        $bills     = SalesBill::whereBetween('bill_date', [$from, $to])->where('status', '!=', 'void');
        $prevBills = SalesBill::whereBetween('bill_date', [$prevFrom, $prevTo])->where('status', '!=', 'void');

        $sales     = (clone $bills)->sum('total_amount');
        $prevSales = (clone $prevBills)->sum('total_amount');
        $count     = (clone $bills)->count();
        $prevCount = (clone $prevBills)->count();
        $collected = Payment::whereHas('bill', fn($q) => $q->whereBetween('bill_date', [$from, $to]))->sum('amount');
        $outstanding = SalesBill::whereBetween('bill_date', [$from, $to])->whereIn('status', ['partial','posted'])->sum('amount_due');

        // Payment mode breakdown
        $paymentModes = Payment::whereHas('bill', fn($q) => $q->whereBetween('bill_date', [$from, $to]))
            ->selectRaw('mode, SUM(amount) as total')
            ->groupBy('mode')
            ->pluck('total', 'mode');

        // Daily trend within period (for chart)
        $trend = SalesBill::selectRaw('DATE(bill_date) as date, COUNT(*) as count, SUM(total_amount) as sales')
            ->whereBetween('bill_date', [$from, $to])
            ->where('status', '!=', 'void')
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Top products
        $topProducts = \App\Models\BillLineItem::join('sales_bills', 'bill_line_items.bill_id', '=', 'sales_bills.id')
            ->join('product_variants', 'bill_line_items.variant_id', '=', 'product_variants.id')
            ->join('products', 'product_variants.product_id', '=', 'products.id')
            ->whereBetween('sales_bills.bill_date', [$from, $to])
            ->where('sales_bills.status', '!=', 'void')
            ->selectRaw('products.name, SUM(bill_line_items.quantity) as qty_sold, SUM(bill_line_items.quantity * bill_line_items.unit_price) as revenue')
            ->groupBy('products.id', 'products.name')
            ->orderByDesc('revenue')
            ->limit(5)
            ->get();

        // Low stock items
        $lowStock = ProductVariant::with('product')
            ->where('is_active', true)
            ->whereColumn('qty_on_hand', '<=', 'reorder_threshold')
            ->orderBy('qty_on_hand')
            ->limit(10)
            ->get()
            ->map(fn($v) => [
                'sku'        => $v->sku,
                'product'    => $v->product->name,
                'on_hand'    => $v->qty_on_hand,
                'reorder_at' => $v->reorder_threshold,
            ]);

        // New customers in period
        $newCustomers = \App\Models\Customer::whereBetween('created_at', [$from . ' 00:00:00', $to . ' 23:59:59'])->count();

        // Top staff
        $topStaff = DB::table('users')
            ->join('sales_bills', 'sales_bills.created_by', '=', 'users.id')
            ->whereBetween('sales_bills.bill_date', [$from, $to])
            ->where('sales_bills.status', '!=', 'void')
            ->selectRaw('users.name, COUNT(*) as bills, SUM(sales_bills.total_amount) as revenue')
            ->groupBy('users.id', 'users.name')
            ->orderByDesc('revenue')
            ->limit(5)
            ->get();

        return response()->json([
            'period'        => compact('from', 'to', 'prevFrom', 'prevTo'),
            'sales'         => $sales,
            'prev_sales'    => $prevSales,
            'count'         => $count,
            'prev_count'    => $prevCount,
            'avg_bill'      => $count > 0 ? round($sales / $count, 0) : 0,
            'collected'     => $collected,
            'outstanding'   => $outstanding,
            'discounts'     => (clone $bills)->sum('discount_amount'),
            'refunds'       => (clone $bills)->where('status', 'refunded')->count(),
            'new_customers' => $newCustomers,
            'payment_modes' => $paymentModes,
            'trend'         => $trend,
            'top_products'  => $topProducts,
            'top_staff'     => $topStaff,
            'low_stock'     => $lowStock,
            'low_stock_count' => $lowStock->count(),
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
