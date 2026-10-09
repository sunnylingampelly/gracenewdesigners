<?php

namespace App\Services\Orders;

use App\Enums\EnquiryStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\StockPolicy;
use App\Models\AnalyticsEvent;
use App\Models\Enquiry;
use App\Models\EnquiryStatusHistory;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\Catalog\ProductService;
use App\Support\ReferenceGenerator;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Manually recorded orders. Orders are created by staff after confirming details with the
 * customer over WhatsApp; nothing here infers payment or delivery automatically.
 */
class OrderService
{
    private const EDITABLE = [
        'customer_id', 'payment_note', 'currency', 'discount_amount', 'shipping_amount', 'tax_amount', 'amount_paid',
        'requires_shipping', 'shipping_name', 'shipping_phone', 'shipping_line1', 'shipping_line2', 'shipping_city',
        'shipping_state', 'shipping_postal_code', 'shipping_country', 'tracking_carrier', 'tracking_number',
        'expected_delivery_date', 'internal_notes',
    ];

    public function __construct(private readonly ActivityLogger $logger) {}

    public function create(array $data, User $actor): Order
    {
        return DB::transaction(function () use ($data, $actor) {
            $enquiry = isset($data['enquiry_id']) ? Enquiry::query()->lockForUpdate()->findOrFail($data['enquiry_id']) : null;
            if ($enquiry && $enquiry->order()->exists()) {
                throw ValidationException::withMessages(['enquiry_id' => "Enquiry {$enquiry->reference} already has an order."]);
            }

            $order = new Order(Arr::only($data, self::EDITABLE));
            $order->reference = ReferenceGenerator::pending();
            $order->enquiry_id = $enquiry?->id;
            $order->customer_id = $data['customer_id'] ?? $enquiry?->customer_id;
            $order->status = OrderStatus::PendingConfirmation;
            $order->payment_status = PaymentStatus::from($data['payment_status'] ?? PaymentStatus::Unpaid->value);
            $order->created_by = $actor->id;
            $order->save();
            $order->reference = ReferenceGenerator::assign('orders', 'ORD', $order->id);

            $this->syncItems($order, $data['items']);
            $this->recalculate($order);
            $this->history($order, 'status', null, $order->status->value, $actor, 'Order recorded');

            $this->logger->log('order.created', "Recorded order {$order->reference}".($enquiry ? " from {$enquiry->reference}" : ''), $order);

            if (($data['status'] ?? null) === OrderStatus::Confirmed->value) {
                $this->changeStatus($order, OrderStatus::Confirmed, $actor);
            }

            return $order->fresh(['items', 'history']);
        });
    }

    public function update(Order $order, array $data, User $actor): Order
    {
        return DB::transaction(function () use ($order, $data, $actor) {
            $order->fill(Arr::only($data, self::EDITABLE));
            if (array_key_exists('items', $data)) {
                if ($order->stock_committed) {
                    throw ValidationException::withMessages(['items' => 'Items cannot be changed after stock has been committed. Cancel and re-create the order instead.']);
                }
                $this->syncItems($order, $data['items']);
            }
            $changes = $this->logger->diff($order);
            $order->save();
            $this->recalculate($order);

            if (isset($data['payment_status']) && $data['payment_status'] !== $order->payment_status->value) {
                $from = $order->payment_status->value;
                $order->payment_status = PaymentStatus::from($data['payment_status']);
                $order->save();
                $this->history($order, 'payment_status', $from, $order->payment_status->value, $actor, $data['status_note'] ?? null);
            }
            if (isset($data['status']) && $data['status'] !== $order->status->value) {
                $this->changeStatus($order, OrderStatus::from($data['status']), $actor, $data['status_note'] ?? null);
            }

            $this->logger->log('order.updated', "Updated order {$order->reference}", $order, $changes ?: null);

            return $order->fresh(['items', 'history']);
        });
    }

    public function changeStatus(Order $order, OrderStatus $to, User $actor, ?string $note = null): void
    {
        $from = $order->status;
        if ($from === $to) {
            return;
        }
        if ($from === OrderStatus::Cancelled) {
            throw ValidationException::withMessages(['status' => 'A cancelled order cannot be reopened.']);
        }

        if ($to !== OrderStatus::Cancelled && $to !== OrderStatus::PendingConfirmation && ! $order->stock_committed) {
            $this->commitStock($order);
            $order->confirmed_at ??= now();
            $order->confirmed_by ??= $actor->id;
        }
        if ($to === OrderStatus::Cancelled && $order->stock_committed) {
            $this->releaseStock($order);
        }

        $order->status = $to;
        $order->save();
        $this->history($order, 'status', $from->value, $to->value, $actor, $note);

        if ($to === OrderStatus::Confirmed && $order->enquiry) {
            $this->markEnquiryConfirmed($order->enquiry, $actor, $order);
            AnalyticsEvent::query()->create([
                'event_name' => 'order_confirmed_manually',
                'payload' => ['order_reference' => $order->reference, 'value' => (float) $order->total, 'currency' => $order->currency],
                'occurred_at' => now(),
            ]);
        }

        $this->logger->log('order.status_changed', "Order {$order->reference}: {$from->label()} → {$to->label()}", $order);
    }

    private function markEnquiryConfirmed(Enquiry $enquiry, User $actor, Order $order): void
    {
        if (in_array($enquiry->status, [EnquiryStatus::OrderConfirmed, EnquiryStatus::Completed], true)) {
            return;
        }
        EnquiryStatusHistory::query()->create([
            'enquiry_id' => $enquiry->id,
            'from_status' => $enquiry->status->value,
            'to_status' => EnquiryStatus::OrderConfirmed->value,
            'user_id' => $actor->id,
            'note' => "Order {$order->reference} confirmed",
        ]);
        $enquiry->forceFill(['status' => EnquiryStatus::OrderConfirmed, 'status_changed_at' => now()])->save();
    }

    private function syncItems(Order $order, array $items): void
    {
        if ($items === []) {
            throw ValidationException::withMessages(['items' => 'An order needs at least one item.']);
        }
        $order->items()->delete();
        foreach ($items as $item) {
            $variant = isset($item['product_variant_id']) ? ProductVariant::query()->with(['size', 'color'])->find($item['product_variant_id']) : null;
            $product = isset($item['product_id']) ? Product::withTrashed()->find($item['product_id']) : $variant?->product;
            if ($variant && $product && $variant->product_id !== $product->id) {
                throw ValidationException::withMessages(['items' => 'A selected variant does not belong to its product.']);
            }
            $quantity = (int) $item['quantity'];
            $unitPrice = round((float) $item['unit_price'], 2);

            $order->items()->create([
                'product_id' => $product?->id,
                'product_variant_id' => $variant?->id,
                'product_name' => $item['product_name'] ?? $product?->name ?? 'Custom item',
                'sku' => $variant?->sku ?? $product?->sku ?? ($item['sku'] ?? null),
                'size_label' => $item['size_label'] ?? $variant?->size?->label,
                'color_label' => $item['color_label'] ?? $variant?->color?->label,
                'is_custom_size' => (bool) ($item['is_custom_size'] ?? false),
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'line_total' => round($unitPrice * $quantity, 2),
                'notes' => $item['notes'] ?? null,
            ]);
        }
    }

    private function recalculate(Order $order): void
    {
        $subtotal = (float) $order->items()->sum('line_total');
        $total = $subtotal - (float) $order->discount_amount + (float) $order->shipping_amount + (float) $order->tax_amount;
        $order->forceFill(['subtotal' => $subtotal, 'total' => max(0, round($total, 2))])->save();
    }

    /** Decrement tracked stock once, when an order is first confirmed. */
    private function commitStock(Order $order): void
    {
        foreach ($order->items()->whereNotNull('product_variant_id')->get() as $item) {
            $variant = ProductVariant::query()->lockForUpdate()->find($item->product_variant_id);
            if (! $variant || $variant->stock_policy !== StockPolicy::Track) {
                continue;
            }
            if ($variant->stock_quantity < $item->quantity) {
                throw ValidationException::withMessages([
                    'status' => "Only {$variant->stock_quantity} left of {$variant->sku}. Adjust stock or the order before confirming.",
                ]);
            }
            $variant->decrement('stock_quantity', $item->quantity);
        }
        $order->stock_committed = true;
        $this->refreshProducts($order);
    }

    private function releaseStock(Order $order): void
    {
        foreach ($order->items()->whereNotNull('product_variant_id')->get() as $item) {
            ProductVariant::query()->whereKey($item->product_variant_id)
                ->where('stock_policy', StockPolicy::Track->value)
                ->increment('stock_quantity', $item->quantity);
        }
        $order->stock_committed = false;
        $this->refreshProducts($order);
    }

    private function refreshProducts(Order $order): void
    {
        $service = app(ProductService::class);
        Product::query()->whereIn('id', $order->items()->pluck('product_id')->filter())->get()
            ->each(fn (Product $p) => $service->refreshDerivedFields($p));
    }

    private function history(Order $order, string $field, ?string $from, string $to, User $actor, ?string $note): void
    {
        OrderStatusHistory::query()->create([
            'order_id' => $order->id, 'field' => $field, 'from_value' => $from, 'to_value' => $to,
            'user_id' => $actor->id, 'note' => $note,
        ]);
    }
}
