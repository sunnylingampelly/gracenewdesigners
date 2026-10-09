<?php

namespace App\Services\Enquiries;

use App\Enums\EnquiryStatus;
use App\Enums\EnquiryType;
use App\Models\AnalyticsEvent;
use App\Models\Customer;
use App\Models\Enquiry;
use App\Models\EnquiryStatusHistory;
use App\Models\Product;
use App\Models\ProductOptionValue;
use App\Models\ProductVariant;
use App\Models\User;
use App\Notifications\NewEnquiryNotification;
use App\Services\ActivityLogger;
use App\Services\Settings\SettingsService;
use App\Support\ReferenceGenerator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class EnquiryService
{
    public function __construct(
        private readonly WhatsAppMessageBuilder $whatsApp,
        private readonly SettingsService $settings,
        private readonly ActivityLogger $logger,
    ) {}

    /**
     * Validate items against the live catalogue, persist the enquiry intent and build the WhatsApp handoff.
     *
     * @param  array<string, mixed>  $data  validated StoreEnquiryRequest payload
     * @return array{enquiry: Enquiry, message: string, whatsapp_url: ?string, summary_url: string}
     */
    public function create(array $data, ?string $ip = null): array
    {
        $type = EnquiryType::from($data['type']);
        $resolvedItems = $this->resolveItems($data['items'] ?? [], $type);

        $enquiry = DB::transaction(function () use ($data, $type, $resolvedItems, $ip) {
            $customer = $this->resolveCustomer($data['customer'] ?? null);
            $consented = (bool) ($data['attribution_consent'] ?? false);
            $utm = $consented ? ($data['utm'] ?? []) : [];

            $enquiry = Enquiry::query()->create([
                'reference' => ReferenceGenerator::pending(),
                'type' => $type,
                'status' => EnquiryStatus::New,
                'customer_id' => $customer?->id,
                'customer_message' => $data['customer']['message'] ?? null,
                'measurements' => $data['measurements'] ?? null,
                'fitting_consultation_requested' => (bool) ($data['fitting_consultation'] ?? false)
                    || collect($resolvedItems)->contains('is_custom_size', true),
                'preferred_date' => $data['preferred_date'] ?? null,
                'currency' => $this->settings->get('currency', 'INR'),
                'source_path' => isset($data['source_path']) ? Str::limit(parse_url($data['source_path'], PHP_URL_PATH) ?: '/', 490, '') : null,
                'referrer_host' => $consented && isset($data['referrer']) ? parse_url($data['referrer'], PHP_URL_HOST) : null,
                'utm_source' => $utm['source'] ?? null,
                'utm_medium' => $utm['medium'] ?? null,
                'utm_campaign' => $utm['campaign'] ?? null,
                'utm_content' => $utm['content'] ?? null,
                'utm_term' => $utm['term'] ?? null,
                'attribution_consent' => $consented,
                'summary_token' => Str::random(40),
                'whatsapp_number' => $this->settings->get('whatsapp_business_number'),
                'status_changed_at' => now(),
                'ip_hash' => $ip ? hash('sha256', $ip.config('app.key')) : null,
            ]);
            $enquiry->reference = ReferenceGenerator::assign('enquiries', 'ENQ', $enquiry->id);

            $total = null;
            foreach ($resolvedItems as $item) {
                $enquiry->items()->create($item);
                if ($item['unit_price'] !== null) {
                    $total = ($total ?? 0) + $item['unit_price'] * $item['quantity'];
                }
            }

            $message = $this->whatsApp->build($enquiry);
            $enquiry->forceFill(['display_total' => $total, 'whatsapp_message' => $message])->save();

            EnquiryStatusHistory::query()->create([
                'enquiry_id' => $enquiry->id,
                'from_status' => null,
                'to_status' => EnquiryStatus::New->value,
                'note' => 'Enquiry initiated from storefront',
            ]);

            $productIds = collect($resolvedItems)->pluck('product_id')->filter()->unique();
            Product::query()->whereIn('id', $productIds)->increment('enquiry_count');

            foreach ($productIds as $productId) {
                AnalyticsEvent::query()->create([
                    'event_name' => 'whatsapp_enquiry_initiated',
                    'product_id' => $productId,
                    'path' => $enquiry->source_path,
                    'payload' => ['enquiry_type' => $type->value],
                    'occurred_at' => now(),
                ]);
            }

            return $enquiry;
        });

        if ($email = $this->settings->get('notify_new_enquiry_email')) {
            Notification::route('mail', $email)->notify(new NewEnquiryNotification($enquiry));
        }

        return [
            'enquiry' => $enquiry,
            'message' => $enquiry->whatsapp_message,
            'whatsapp_url' => $this->whatsApp->url($enquiry->whatsapp_message),
            'summary_url' => $this->settings->siteUrl().'/enquiry/'.$enquiry->summary_token,
        ];
    }

    /**
     * Resolve requested items to catalogue snapshots, rejecting anything not publicly enquirable.
     *
     * @return list<array<string, mixed>>
     */
    private function resolveItems(array $items, EnquiryType $type): array
    {
        if (in_array($type, [EnquiryType::Product, EnquiryType::Bag], true) && $items === []) {
            throw ValidationException::withMessages(['items' => 'Select at least one design.']);
        }
        if ($type === EnquiryType::Product && count($items) > 1) {
            throw ValidationException::withMessages(['items' => 'A product enquiry covers a single design.']);
        }

        $products = Product::query()->publiclyVisible()
            ->whereIn('id', array_column($items, 'product_id'))
            ->with(['variants' => fn ($q) => $q->where('is_active', true)->with(['size', 'color'])])
            ->get()->keyBy('id');
        $siteUrl = $this->settings->siteUrl();

        $resolved = [];
        foreach ($items as $i => $item) {
            $product = $products->get($item['product_id']);
            if (! $product) {
                throw ValidationException::withMessages(["items.$i.product_id" => 'This design is no longer available for enquiry.']);
            }

            $variant = null;
            $sizeLabel = null;
            $colorLabel = null;
            $isCustom = (bool) ($item['custom_size'] ?? false);

            if ($isCustom) {
                if (! $product->allows_custom_size) {
                    throw ValidationException::withMessages(["items.$i.custom_size" => 'Custom sizing is not offered for this design.']);
                }
                if ($colorId = $item['color_value_id'] ?? null) {
                    if (! $product->variants->contains('color_value_id', (int) $colorId)) {
                        throw ValidationException::withMessages(["items.$i.color_value_id" => 'This colour is not offered for this design.']);
                    }
                    $colorLabel = ProductOptionValue::query()->whereKey($colorId)->value('label');
                } elseif ($product->variants->pluck('color_value_id')->filter()->unique()->count() > 1) {
                    throw ValidationException::withMessages(["items.$i.color_value_id" => 'Please choose a colour.']);
                } else {
                    $colorLabel = $product->variants->first()?->color?->label;
                }
                $sizeLabel = 'Custom';
            } elseif ($product->variants->isNotEmpty()) {
                /** @var ProductVariant|null $variant */
                $variant = $product->variants->firstWhere('id', (int) ($item['variant_id'] ?? 0));
                if (! $variant) {
                    throw ValidationException::withMessages(["items.$i.variant_id" => 'Please choose an available size and colour.']);
                }
                if (! $variant->availability()->isEnquirable()) {
                    throw ValidationException::withMessages(["items.$i.variant_id" => 'This size and colour combination is currently unavailable.']);
                }
                $sizeLabel = $variant->size?->label;
                $colorLabel = $variant->color?->label;
            } elseif (! empty($item['variant_id'])) {
                throw ValidationException::withMessages(["items.$i.variant_id" => 'This design has no size or colour options.']);
            }

            $unitPrice = null;
            if ($product->publicPrice() !== null) {
                $unitPrice = $variant ? $variant->effectivePrice($product) : ($product->min_price ?? $product->price);
            }

            $resolved[] = [
                'product_id' => $product->id,
                'product_variant_id' => $variant?->id,
                'product_name' => $product->name,
                'product_sku' => $product->sku,
                'variant_sku' => $variant?->sku,
                'size_label' => $sizeLabel,
                'color_label' => $colorLabel,
                'is_custom_size' => $isCustom,
                'quantity' => (int) ($item['quantity'] ?? 1),
                'price_mode' => $product->price_mode,
                'unit_price' => $unitPrice !== null ? (float) $unitPrice : null,
                'currency' => $product->currency,
                'product_url' => $siteUrl.'/products/'.$product->slug,
            ];
        }

        return $resolved;
    }

    private function resolveCustomer(?array $input): ?Customer
    {
        $phone = isset($input['phone']) ? preg_replace('/[^\d+]/', '', $input['phone']) : null;
        $email = isset($input['email']) ? Str::lower(trim($input['email'])) : null;
        if (blank($phone) && blank($email)) {
            return null;
        }

        $customer = Customer::query()
            ->when($phone, fn ($q) => $q->where('phone', $phone))
            ->when(! $phone && $email, fn ($q) => $q->where('email', $email))
            ->first() ?? new Customer;

        $customer->fill(array_filter([
            'name' => $input['name'] ?? null,
            'phone' => $phone,
            'email' => $email,
            'city' => $input['city'] ?? null,
            'country' => $input['country'] ?? null,
        ]));
        if (! empty($input['marketing_consent'])) {
            $customer->marketing_consent = true;
            $customer->marketing_consent_at = now();
        }
        $customer->save();

        return $customer;
    }

    public function markRedirected(Enquiry $enquiry): void
    {
        if ($enquiry->redirect_initiated_at === null) {
            $enquiry->forceFill(['redirect_initiated_at' => now()])->save();
        }
    }

    /** Staff-facing update: status, assignment, follow-up. Every status change is recorded. */
    public function update(Enquiry $enquiry, array $data, User $actor): Enquiry
    {
        return DB::transaction(function () use ($enquiry, $data, $actor) {
            $from = $enquiry->status;
            $enquiry->fill(array_intersect_key($data, array_flip(['assigned_to', 'follow_up_at'])));

            if (isset($data['status']) && $data['status'] !== $from->value) {
                $enquiry->status = EnquiryStatus::from($data['status']);
                $enquiry->status_changed_at = now();
                EnquiryStatusHistory::query()->create([
                    'enquiry_id' => $enquiry->id,
                    'from_status' => $from->value,
                    'to_status' => $enquiry->status->value,
                    'user_id' => $actor->id,
                    'note' => $data['status_note'] ?? null,
                ]);
                $this->logger->log('enquiry.status_changed', "Enquiry {$enquiry->reference}: {$from->label()} → {$enquiry->status->label()}", $enquiry);
            }
            if (array_key_exists('assigned_to', $data) && $enquiry->isDirty('assigned_to')) {
                $this->logger->log('enquiry.assigned', "Enquiry {$enquiry->reference} assigned", $enquiry, ['assigned_to' => $data['assigned_to']]);
            }
            $enquiry->save();

            if (filled($data['note'] ?? null)) {
                $enquiry->notes()->create(['user_id' => $actor->id, 'body' => $data['note']]);
            }

            return $enquiry;
        });
    }

    public function addNote(Enquiry $enquiry, string $body): void
    {
        $enquiry->notes()->create(['user_id' => Auth::id(), 'body' => $body]);
    }
}
