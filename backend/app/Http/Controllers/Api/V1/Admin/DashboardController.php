<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\EnquiryStatus;
use App\Enums\OrderStatus;
use App\Enums\StockPolicy;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Enquiry;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Dashboard and reports. Responses separate "measured" signals (views, enquiry intents —
 * a WhatsApp redirect is not a conversation) from "confirmed" outcomes (orders recorded by staff).
 */
class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $tz = config('app.operations_timezone');
        $now = CarbonImmutable::now($tz);
        $todayStart = $now->startOfDay()->utc();
        $monthStart = $now->startOfMonth()->utc();
        $open = array_map(fn ($s) => $s->value, EnquiryStatus::open());
        $confirmedStatuses = array_map(fn ($s) => $s->value, array_filter(OrderStatus::cases(), fn ($s) => ! in_array($s, [OrderStatus::PendingConfirmation, OrderStatus::Cancelled], true)));

        $mostEnquired = DB::table('enquiry_items')
            ->join('enquiries', 'enquiries.id', '=', 'enquiry_items.enquiry_id')
            ->where('enquiries.created_at', '>=', $now->subDays(30)->utc())
            ->whereNull('enquiries.deleted_at')
            ->whereNotIn('enquiries.status', [EnquiryStatus::Spam->value])
            ->whereNotNull('enquiry_items.product_id')
            ->groupBy('enquiry_items.product_id', 'enquiry_items.product_name')
            ->selectRaw('enquiry_items.product_id as id, enquiry_items.product_name as name, COUNT(DISTINCT enquiries.id) as enquiries')
            ->orderByDesc('enquiries')->limit(5)->get();

        return response()->json(['data' => [
            'catalogue' => [
                'live_products' => Product::query()->publiclyVisible()->count(),
                'published_products' => Product::query()->where('status', 'published')->count(),
                'scheduled_products' => Product::query()->where('status', 'scheduled')->count(),
                'draft_products' => Product::query()->where('status', 'draft')->count(),
                'out_of_stock_variants' => ProductVariant::query()->where('is_active', true)
                    ->where('stock_policy', StockPolicy::Track->value)->where('stock_quantity', '<=', 0)
                    ->whereHas('product', fn ($q) => $q->whereIn('status', ['published', 'scheduled']))->count(),
                'low_stock_variants' => ProductVariant::query()->where('is_active', true)
                    ->where('stock_policy', StockPolicy::Track->value)->where('stock_quantity', '>', 0)
                    ->whereColumn('stock_quantity', '<=', 'low_stock_threshold')->count(),
            ],
            'measured' => [
                'note' => 'Enquiry intents count WhatsApp handoffs started on the website. They do not confirm a message was sent.',
                'enquiry_intents_today' => Enquiry::query()->where('created_at', '>=', $todayStart)->count(),
                'enquiry_intents_month' => Enquiry::query()->where('created_at', '>=', $monthStart)->count(),
                'most_viewed_products' => Product::query()->publiclyVisible()->where('view_count', '>', 0)
                    ->orderByDesc('view_count')->limit(5)->get(['id', 'name', 'view_count'])
                    ->map(fn ($p) => ['id' => $p->id, 'name' => $p->name, 'views' => $p->view_count]),
                'most_enquired_products' => $mostEnquired,
            ],
            'pipeline' => [
                'new_leads' => Enquiry::query()->where('status', EnquiryStatus::New->value)->count(),
                'awaiting_follow_up' => Enquiry::query()->whereIn('status', $open)
                    ->where(fn ($q) => $q->where('follow_up_at', '<=', now())->orWhere('status', EnquiryStatus::New->value))->count(),
                'overdue_follow_ups' => Enquiry::query()->whereIn('status', $open)->where('follow_up_at', '<', now())->count(),
            ],
            'confirmed' => [
                'note' => 'Orders recorded and confirmed manually by the team.',
                'orders_confirmed_month' => Order::query()->whereIn('status', $confirmedStatuses)->where('confirmed_at', '>=', $monthStart)->count(),
                'orders_in_progress' => Order::query()->whereIn('status', [OrderStatus::Confirmed->value, OrderStatus::InProduction->value, OrderStatus::Ready->value, OrderStatus::Dispatched->value])->count(),
                'confirmed_value_month' => Money::format(Order::query()->whereIn('status', $confirmedStatuses)->where('confirmed_at', '>=', $monthStart)->sum('total'), 'INR'),
                'payments_recorded_month' => Money::format(Order::query()->where('confirmed_at', '>=', $monthStart)->sum('amount_paid'), 'INR'),
            ],
            'recent_catalogue_changes' => ActivityLog::query()->with('user:id,name')
                ->whereIn('subject_type', ['Product', 'Category', 'Collection'])
                ->latest('id')->limit(8)->get()
                ->map(fn ($log) => ['description' => $log->description, 'user' => $log->user?->name, 'created_at' => $log->created_at?->toIso8601String()]),
            'generated_at' => now()->toIso8601String(),
        ]]);
    }

    public function reports(Request $request): JsonResponse
    {
        $days = (int) ($request->validate(['days' => ['nullable', 'integer', 'in:7,30,90,365']])['days'] ?? 30);
        $tz = config('app.operations_timezone');
        $from = CarbonImmutable::now($tz)->subDays($days - 1)->startOfDay();

        $enquiries = Enquiry::query()->where('created_at', '>=', $from->utc())->get(['id', 'created_at', 'status', 'type', 'utm_source', 'referrer_host']);
        $daily = collect(range(0, $days - 1))->mapWithKeys(fn ($i) => [$from->addDays($i)->toDateString() => 0])->all();
        foreach ($enquiries as $e) {
            $key = $e->created_at->timezone($tz)->toDateString();
            if (array_key_exists($key, $daily)) {
                $daily[$key]++;
            }
        }
        $daily = collect($daily);

        $orders = Order::query()->where('created_at', '>=', $from->utc())->get(['id', 'status', 'total', 'enquiry_id', 'confirmed_at']);
        $confirmed = $orders->filter(fn ($o) => $o->confirmed_at !== null && $o->status !== OrderStatus::Cancelled);
        $enquiryCount = $enquiries->whereNotIn('status', [EnquiryStatus::Spam])->count();

        return response()->json(['data' => [
            'range_days' => $days,
            'enquiries_by_day' => $daily->map(fn ($count, $date) => ['date' => $date, 'count' => $count])->values(),
            'enquiries_by_status' => $enquiries->groupBy(fn ($e) => $e->status->value)->map->count(),
            'enquiries_by_type' => $enquiries->groupBy(fn ($e) => $e->type->value)->map->count(),
            'enquiries_by_source' => $enquiries->groupBy(fn ($e) => $e->utm_source ?: ($e->referrer_host ?: 'direct / not consented'))->map->count()->sortDesc()->take(10),
            'orders' => [
                'recorded' => $orders->count(),
                'confirmed' => $confirmed->count(),
                'confirmed_value' => (float) $confirmed->sum('total'),
                'from_enquiries' => $confirmed->whereNotNull('enquiry_id')->count(),
            ],
            // Share of (non-spam) enquiry intents in the period that led to a confirmed order.
            'enquiry_to_order_rate' => $enquiryCount ? round($confirmed->whereNotNull('enquiry_id')->count() / $enquiryCount * 100, 1) : null,
        ]]);
    }
}
