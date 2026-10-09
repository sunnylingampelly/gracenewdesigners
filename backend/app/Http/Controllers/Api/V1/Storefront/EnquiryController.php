<?php

namespace App\Http\Controllers\Api\V1\Storefront;

use App\Http\Controllers\Controller;
use App\Http\Requests\Storefront\StoreEnquiryRequest;
use App\Models\Enquiry;
use App\Services\Enquiries\EnquiryService;
use App\Services\Enquiries\WhatsAppMessageBuilder;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EnquiryController extends Controller
{
    public function __construct(private readonly EnquiryService $enquiries) {}

    /**
     * Persist the enquiry intent first, then hand the browser a wa.me URL.
     * The response wording is deliberately "initiated": a redirect is not proof a message was sent.
     */
    public function store(StoreEnquiryRequest $request): JsonResponse
    {
        $result = $this->enquiries->create($request->validated(), $request->ip());
        $enquiry = $result['enquiry'];

        return response()->json(['data' => [
            'reference' => $enquiry->reference,
            'status' => 'initiated',
            'whatsapp_url' => $result['whatsapp_url'],
            'message' => $result['message'],
            'summary_url' => $result['summary_url'],
            'summary_token' => $enquiry->summary_token,
        ]], 201);
    }

    /** Called by the storefront just before navigating to WhatsApp. */
    public function redirected(Request $request, string $reference): JsonResponse
    {
        $token = (string) $request->validate(['token' => ['required', 'string', 'size:40']])['token'];
        $enquiry = Enquiry::query()->where('reference', $reference)->where('summary_token', $token)->firstOrFail();
        $this->enquiries->markRedirected($enquiry);

        return response()->json(['data' => ['reference' => $enquiry->reference, 'redirect_initiated' => true]]);
    }

    /**
     * Shareable enquiry summary (used when a bag is too long for a WhatsApp link).
     * Contains catalogue details only — never customer data.
     */
    public function summary(string $token, WhatsAppMessageBuilder $whatsApp): JsonResponse
    {
        abort_unless(strlen($token) === 40, 404);
        $enquiry = Enquiry::query()->where('summary_token', $token)->with('items.product')->firstOrFail();

        return response()->json(['data' => [
            'reference' => $enquiry->reference,
            'created_at' => $enquiry->created_at->toIso8601String(),
            'items' => $enquiry->items->map(fn ($item) => [
                'product_name' => $item->product_name,
                'reference' => $item->product_sku,
                'size' => $item->is_custom_size ? 'Custom size' : $item->size_label,
                'color' => $item->color_label,
                'quantity' => $item->quantity,
                'price_label' => $item->unit_price !== null ? Money::format($item->unit_price, $item->currency) : ($item->price_mode->value === 'on_request' ? 'Price on Request' : null),
                'url' => $item->product && $item->product->isPubliclyVisible() ? '/products/'.$item->product->slug : null,
            ]),
            'display_total' => $enquiry->display_total !== null ? Money::format($enquiry->display_total, $enquiry->currency) : null,
            'whatsapp_url' => $enquiry->whatsapp_message ? $whatsApp->url($enquiry->whatsapp_message) : null,
        ]]);
    }
}
