<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\NewsletterSubscriber;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerController extends Controller
{
    public function __construct(private readonly ActivityLogger $logger) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Customer::class);
        $term = $request->query('q');
        $page = Customer::query()->withCount(['enquiries', 'orders'])
            ->whereNull('anonymized_at')
            ->when($term, fn ($q) => $q->where(fn ($w) => $w->where('name', 'like', "%{$term}%")
                ->orWhere('phone', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%")))
            ->latest('id')->paginate((int) $request->query('per_page', 25))->withQueryString();

        return response()->json([
            'data' => collect($page->items())->map(fn (Customer $c) => [
                ...$c->only(['id', 'name', 'phone', 'email', 'city', 'country', 'marketing_consent']),
                'enquiries_count' => $c->enquiries_count,
                'orders_count' => $c->orders_count,
                'created_at' => $c->created_at->toIso8601String(),
            ]),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }

    public function show(Customer $customer): JsonResponse
    {
        $this->authorize('view', $customer);
        $customer->load(['enquiries' => fn ($q) => $q->latest('id')->limit(50), 'orders' => fn ($q) => $q->latest('id')->limit(50)]);

        return response()->json(['data' => [
            ...$customer->only(['id', 'name', 'phone', 'email', 'city', 'country', 'notes', 'marketing_consent']),
            'marketing_consent_at' => $customer->marketing_consent_at?->toIso8601String(),
            'created_at' => $customer->created_at->toIso8601String(),
            'enquiries' => $customer->enquiries->map(fn ($e) => ['id' => $e->id, 'reference' => $e->reference, 'status' => $e->status->value, 'created_at' => $e->created_at->toIso8601String()]),
            'orders' => $customer->orders->map(fn ($o) => ['id' => $o->id, 'reference' => $o->reference, 'status' => $o->status->value, 'total' => $o->total, 'created_at' => $o->created_at->toIso8601String()]),
        ]]);
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $this->authorize('update', $customer);
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:150'],
            'phone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'email', 'max:190'],
            'city' => ['nullable', 'string', 'max:120'],
            'country' => ['nullable', 'string', 'max:80'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'marketing_consent' => ['sometimes', 'boolean'],
        ]);
        if (array_key_exists('marketing_consent', $data) && $data['marketing_consent'] !== $customer->marketing_consent) {
            $customer->marketing_consent_at = $data['marketing_consent'] ? now() : null;
        }
        $customer->fill($data)->save();
        $this->logger->log('customer.updated', "Updated customer #{$customer->id}", $customer);

        return $this->show($customer);
    }

    /** Privacy request: erase personal data but keep anonymous operational records. */
    public function anonymize(Customer $customer): JsonResponse
    {
        $this->authorize('anonymize', $customer);
        DB::transaction(function () use ($customer) {
            if ($customer->email) {
                NewsletterSubscriber::query()->where('email', $customer->email)->delete();
            }
            $customer->anonymize();
        });
        $this->logger->log('customer.anonymized', "Anonymized customer #{$customer->id} (privacy request)", $customer);

        return response()->json(null, 204);
    }

    public function subscribers(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission('customers.view'), 403);
        $page = NewsletterSubscriber::query()->whereNull('unsubscribed_at')->latest('id')->paginate(50);

        return response()->json([
            'data' => collect($page->items())->map(fn ($s) => ['id' => $s->id, 'email' => $s->email, 'source' => $s->source, 'consented_at' => $s->consented_at->toIso8601String()]),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ]);
    }
}
