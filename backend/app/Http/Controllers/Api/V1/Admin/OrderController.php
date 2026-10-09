<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\EnquiryStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\OrderRequest;
use App\Models\Enquiry;
use App\Models\Order;
use App\Services\Orders\OrderService;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(private readonly OrderService $orders) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Order::class);
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'max:30'],
            'payment_status' => ['nullable', 'string', 'max:30'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $page = Order::query()->with(['customer', 'items', 'enquiry:id,reference'])
            ->when($filters['q'] ?? null, fn ($q, $term) => $q->where(fn ($w) => $w
                ->where('reference', 'like', '%'.strtoupper($term).'%')
                ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$term}%")->orWhere('phone', 'like', "%{$term}%"))
                ->orWhereHas('items', fn ($i) => $i->where('product_name', 'like', "%{$term}%"))))
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($filters['payment_status'] ?? null, fn ($q, $s) => $q->where('payment_status', $s))
            ->latest('id')->paginate($filters['per_page'] ?? 25)->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn (Order $o) => [
                'id' => $o->id,
                'reference' => $o->reference,
                'enquiry_reference' => $o->enquiry?->reference,
                'customer' => $o->customer?->name ?? $o->shipping_name,
                'items' => $o->items->map(fn ($i) => $i->product_name.' × '.$i->quantity)->implode(', '),
                'total' => (float) $o->total,
                'total_label' => Money::format($o->total, $o->currency),
                'status' => $o->status->value,
                'status_label' => $o->status->label(),
                'payment_status' => $o->payment_status->value,
                'payment_status_label' => $o->payment_status->label(),
                'created_at' => $o->created_at->toIso8601String(),
                'expected_delivery_date' => $o->expected_delivery_date?->toDateString(),
            ]),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }

    public function show(Order $order): JsonResponse
    {
        $this->authorize('view', $order);
        $order->load(['items.variant', 'customer', 'enquiry:id,reference,status', 'history.user:id,name', 'creator:id,name', 'confirmer:id,name']);

        return response()->json(['data' => [
            ...$order->only([
                'id', 'reference', 'enquiry_id', 'customer_id', 'payment_note', 'currency', 'subtotal', 'discount_amount',
                'shipping_amount', 'tax_amount', 'total', 'amount_paid', 'requires_shipping', 'shipping_name', 'shipping_phone',
                'shipping_line1', 'shipping_line2', 'shipping_city', 'shipping_state', 'shipping_postal_code', 'shipping_country',
                'tracking_carrier', 'tracking_number', 'internal_notes', 'stock_committed',
            ]),
            'status' => $order->status->value,
            'payment_status' => $order->payment_status->value,
            'balance_due' => max(0, round((float) $order->total - (float) $order->amount_paid, 2)),
            'expected_delivery_date' => $order->expected_delivery_date?->toDateString(),
            'confirmed_at' => $order->confirmed_at?->toIso8601String(),
            'confirmed_by' => $order->confirmer?->name,
            'created_by' => $order->creator?->name,
            'created_at' => $order->created_at->toIso8601String(),
            'enquiry' => $order->enquiry?->only(['id', 'reference']),
            'customer' => $order->customer?->only(['id', 'name', 'phone', 'email', 'city', 'country']),
            'items' => $order->items->map(fn ($i) => $i->only([
                'id', 'product_id', 'product_variant_id', 'product_name', 'sku', 'size_label', 'color_label', 'is_custom_size',
                'quantity', 'unit_price', 'line_total', 'notes',
            ])),
            'history' => $order->history->map(fn ($h) => [
                'field' => $h->field, 'from' => $h->from_value, 'to' => $h->to_value, 'note' => $h->note,
                'user' => $h->user?->name, 'created_at' => $h->created_at?->toIso8601String(),
            ]),
        ]]);
    }

    public function store(OrderRequest $request): JsonResponse
    {
        $order = $this->orders->create($request->validated(), $request->user());

        return $this->show($order)->setStatusCode(201);
    }

    public function update(OrderRequest $request, Order $order): JsonResponse
    {
        $this->orders->update($order, $request->validated(), $request->user());

        return $this->show($order->fresh());
    }

    /** Prefill a new order from an enquiry's snapshots; staff then enter the agreed prices. */
    public function draftFromEnquiry(Enquiry $enquiry): JsonResponse
    {
        $this->authorize('create', Order::class);
        $enquiry->load(['items', 'customer']);

        return response()->json(['data' => [
            'enquiry_id' => $enquiry->id,
            'customer_id' => $enquiry->customer_id,
            'currency' => $enquiry->currency,
            'shipping_name' => $enquiry->customer?->name,
            'shipping_phone' => $enquiry->customer?->phone,
            'shipping_city' => $enquiry->customer?->city,
            'shipping_country' => $enquiry->customer?->country,
            'items' => $enquiry->items->map(fn ($i) => [
                'product_id' => $i->product_id,
                'product_variant_id' => $i->product_variant_id,
                'product_name' => $i->product_name,
                'size_label' => $i->size_label,
                'color_label' => $i->color_label,
                'is_custom_size' => $i->is_custom_size,
                'quantity' => $i->quantity,
                // Displayed price is a starting point only; the agreed price is confirmed by staff.
                'unit_price' => $i->unit_price,
            ]),
        ]]);
    }

    public function statuses(): JsonResponse
    {
        return response()->json(['data' => [
            'order' => collect(OrderStatus::cases())->map(fn ($s) => ['value' => $s->value, 'label' => $s->label()]),
            'payment' => collect(PaymentStatus::cases())->map(fn ($s) => ['value' => $s->value, 'label' => $s->label()]),
            'enquiry' => collect(EnquiryStatus::cases())->map(fn ($s) => ['value' => $s->value, 'label' => $s->label()]),
        ]]);
    }
}
