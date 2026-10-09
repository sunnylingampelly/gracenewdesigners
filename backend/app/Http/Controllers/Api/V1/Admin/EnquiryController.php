<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\EnquiryStatus;
use App\Http\Controllers\Controller;
use App\Models\Enquiry;
use App\Services\ActivityLogger;
use App\Services\Enquiries\EnquiryService;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EnquiryController extends Controller
{
    public function __construct(private readonly EnquiryService $enquiries) {}

    private function filtered(Request $request)
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string'],
            'type' => ['nullable', Rule::in(['product', 'bag', 'consultation', 'contact'])],
            'assigned_to' => ['nullable'],
            'follow_up' => ['nullable', Rule::in(['overdue', 'today', 'upcoming'])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'product_id' => ['nullable', 'integer'],
            'source' => ['nullable', 'string', 'max:100'],
        ]);
        $now = now();

        return Enquiry::query()
            ->with(['customer', 'assignee:id,name', 'items'])
            ->when($filters['q'] ?? null, fn ($q, $term) => $q->where(fn ($w) => $w
                ->where('reference', 'like', '%'.strtoupper($term).'%')
                ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$term}%")->orWhere('phone', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%"))
                ->orWhereHas('items', fn ($i) => $i->where('product_name', 'like', "%{$term}%")->orWhere('product_sku', 'like', strtoupper($term).'%'))))
            ->when($filters['status'] ?? null, function ($q, $status) {
                $status === 'open' ? $q->whereIn('status', array_map(fn ($s) => $s->value, EnquiryStatus::open())) : $q->whereIn('status', explode(',', $status));
            })
            ->when($filters['type'] ?? null, fn ($q, $type) => $q->where('type', $type))
            ->when(isset($filters['assigned_to']), fn ($q) => $filters['assigned_to'] === 'unassigned'
                ? $q->whereNull('assigned_to') : $q->where('assigned_to', (int) $filters['assigned_to']))
            ->when(($filters['follow_up'] ?? null) === 'overdue', fn ($q) => $q->where('follow_up_at', '<', $now)
                ->whereIn('status', array_map(fn ($s) => $s->value, EnquiryStatus::open())))
            ->when(($filters['follow_up'] ?? null) === 'today', fn ($q) => $q->whereBetween('follow_up_at', [$now->copy()->startOfDay(), $now->copy()->endOfDay()]))
            ->when(($filters['follow_up'] ?? null) === 'upcoming', fn ($q) => $q->where('follow_up_at', '>', $now))
            ->when($filters['from'] ?? null, fn ($q, $d) => $q->where('created_at', '>=', $d))
            ->when($filters['to'] ?? null, fn ($q, $d) => $q->where('created_at', '<=', now()->parse($d)->endOfDay()))
            ->when($filters['product_id'] ?? null, fn ($q, $id) => $q->whereHas('items', fn ($i) => $i->where('product_id', $id)))
            ->when($filters['source'] ?? null, fn ($q, $s) => $q->where('utm_source', $s))
            ->latest('id');
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Enquiry::class);
        $page = $this->filtered($request)->paginate((int) $request->input('per_page', 25))->withQueryString();
        $openStatuses = array_map(fn ($s) => $s->value, EnquiryStatus::open());

        return response()->json([
            'data' => collect($page->items())->map(fn (Enquiry $e) => $this->row($e)),
            'meta' => [
                'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(), 'total' => $page->total(),
                'counts' => [
                    'new' => Enquiry::query()->where('status', 'new')->count(),
                    'open' => Enquiry::query()->whereIn('status', $openStatuses)->count(),
                    'overdue' => Enquiry::query()->whereIn('status', $openStatuses)->where('follow_up_at', '<', now())->count(),
                ],
            ],
        ]);
    }

    private function row(Enquiry $e): array
    {
        $first = $e->items->first();

        return [
            'id' => $e->id,
            'reference' => $e->reference,
            'type' => $e->type->value,
            'status' => $e->status->value,
            'status_label' => $e->status->label(),
            'created_at' => $e->created_at->toIso8601String(),
            'redirect_initiated_at' => $e->redirect_initiated_at?->toIso8601String(),
            'product' => $first?->product_name,
            'variant' => $first ? trim(implode(' / ', array_filter([$first->is_custom_size ? 'Custom size' : $first->size_label, $first->color_label]))) ?: null : null,
            'quantity' => $e->items->sum('quantity'),
            'item_count' => $e->items->count(),
            'display_total' => $e->display_total !== null ? Money::format($e->display_total, $e->currency) : null,
            'lead_source' => $e->utm_source ?: ($e->referrer_host ?: ($e->source_path ? 'Website' : null)),
            'source_path' => $e->source_path,
            'contact' => $e->customer ? array_filter(['name' => $e->customer->name, 'phone' => $e->customer->phone, 'email' => $e->customer->email]) : null,
            'assigned_to' => $e->assignee ? ['id' => $e->assignee->id, 'name' => $e->assignee->name] : null,
            'follow_up_at' => $e->follow_up_at?->toIso8601String(),
            'is_overdue' => $e->follow_up_at?->isPast() && in_array($e->status, EnquiryStatus::open(), true),
        ];
    }

    public function show(Enquiry $enquiry): JsonResponse
    {
        $this->authorize('view', $enquiry);
        $enquiry->load(['items.product', 'customer', 'assignee:id,name', 'statusHistory.user:id,name', 'notes.user:id,name', 'order']);

        return response()->json(['data' => [
            ...$this->row($enquiry),
            'customer_message' => $enquiry->customer_message,
            'measurements' => $enquiry->measurements,
            'fitting_consultation_requested' => $enquiry->fitting_consultation_requested,
            'preferred_date' => $enquiry->preferred_date?->toDateString(),
            'attribution' => $enquiry->attribution_consent ? array_filter([
                'referrer' => $enquiry->referrer_host, 'utm_source' => $enquiry->utm_source, 'utm_medium' => $enquiry->utm_medium,
                'utm_campaign' => $enquiry->utm_campaign, 'utm_content' => $enquiry->utm_content, 'utm_term' => $enquiry->utm_term,
            ]) : null,
            'customer' => $enquiry->customer?->only(['id', 'name', 'phone', 'email', 'city', 'country', 'marketing_consent']),
            'whatsapp_message' => $enquiry->whatsapp_message,
            'items' => $enquiry->items->map(fn ($i) => [
                ...$i->only(['id', 'product_id', 'product_variant_id', 'product_name', 'product_sku', 'variant_sku', 'size_label', 'color_label', 'is_custom_size', 'quantity', 'currency', 'product_url']),
                'price_mode' => $i->price_mode->value,
                'unit_price' => $i->unit_price,
                'price_label' => $i->unit_price !== null ? Money::format($i->unit_price, $i->currency) : ($i->price_mode->value === 'on_request' ? 'Price on request' : null),
                'product_exists' => $i->product !== null && ! $i->product->trashed(),
            ]),
            'history' => $enquiry->statusHistory->map(fn ($h) => [
                'from' => $h->from_status, 'to' => $h->to_status, 'note' => $h->note,
                'user' => $h->user?->name, 'created_at' => $h->created_at?->toIso8601String(),
            ]),
            'notes' => $enquiry->notes->map(fn ($n) => ['id' => $n->id, 'body' => $n->body, 'user' => $n->user?->name, 'created_at' => $n->created_at->toIso8601String()]),
            'order' => $enquiry->order ? ['id' => $enquiry->order->id, 'reference' => $enquiry->order->reference, 'status' => $enquiry->order->status->value] : null,
        ]]);
    }

    public function update(Request $request, Enquiry $enquiry): JsonResponse
    {
        $this->authorize('update', $enquiry);
        $data = $request->validate([
            'status' => ['sometimes', Rule::enum(EnquiryStatus::class)],
            'status_note' => ['nullable', 'string', 'max:1000'],
            'assigned_to' => ['sometimes', 'nullable', 'integer', Rule::exists('users', 'id')->where('is_active', true)->whereNull('deleted_at')],
            'follow_up_at' => ['sometimes', 'nullable', 'date'],
            'note' => ['nullable', 'string', 'max:5000'],
        ]);
        $this->enquiries->update($enquiry, $data, $request->user());

        return $this->show($enquiry->fresh());
    }

    public function addNote(Request $request, Enquiry $enquiry): JsonResponse
    {
        $this->authorize('update', $enquiry);
        $this->enquiries->addNote($enquiry, $request->validate(['body' => ['required', 'string', 'max:5000']])['body']);

        return response()->json(null, 201);
    }

    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'max:200'], 'ids.*' => ['integer'],
            'status' => ['sometimes', Rule::enum(EnquiryStatus::class)],
            'assigned_to' => ['sometimes', 'nullable', 'integer', 'exists:users,id'],
        ]);
        $this->authorize('update', new Enquiry);
        $count = 0;
        foreach (Enquiry::query()->whereIn('id', $data['ids'])->get() as $enquiry) {
            $this->enquiries->update($enquiry, collect($data)->except('ids')->all(), $request->user());
            $count++;
        }

        return response()->json(['data' => ['updated' => $count]]);
    }

    public function export(Request $request): StreamedResponse
    {
        $this->authorize('export', Enquiry::class);
        $query = $this->filtered($request);
        app(ActivityLogger::class)->log('enquiry.exported', 'Exported enquiries to CSV');

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['Reference', 'Date (IST)', 'Type', 'Status', 'Products', 'Variants', 'Quantity', 'Displayed total', 'Lead source', 'Contact name', 'Contact phone', 'Contact email', 'Assigned to', 'Follow-up'], escape: '\\');
            $query->chunk(200, function ($enquiries) use ($out) {
                foreach ($enquiries as $e) {
                    $row = [
                        $e->reference,
                        $e->created_at->timezone(config('app.operations_timezone'))->format('Y-m-d H:i'),
                        $e->type->value,
                        $e->status->label(),
                        $e->items->pluck('product_name')->implode('; '),
                        $e->items->map(fn ($i) => trim(($i->is_custom_size ? 'Custom' : $i->size_label).' '.$i->color_label))->implode('; '),
                        $e->items->sum('quantity'),
                        $e->display_total,
                        $e->utm_source ?: $e->referrer_host,
                        $e->customer?->name, $e->customer?->phone, $e->customer?->email,
                        $e->assignee?->name,
                        $e->follow_up_at?->timezone(config('app.operations_timezone'))->format('Y-m-d H:i'),
                    ];
                    fputcsv($out, array_map(fn ($v) => is_string($v) && $v !== '' && in_array($v[0], ['=', '+', '-', '@'], true) ? "'".$v : $v, $row), escape: '\\');
                }
            });
            fclose($out);
        }, 'enquiries-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function destroy(Enquiry $enquiry): JsonResponse
    {
        $this->authorize('delete', $enquiry);
        $enquiry->delete();
        app(ActivityLogger::class)->log('enquiry.deleted', "Deleted enquiry {$enquiry->reference}", $enquiry);

        return response()->json(null, 204);
    }
}
