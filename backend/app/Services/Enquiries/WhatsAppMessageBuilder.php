<?php

namespace App\Services\Enquiries;

use App\Enums\EnquiryType;
use App\Enums\PriceMode;
use App\Models\Enquiry;
use App\Models\EnquiryItem;
use App\Services\Settings\SettingsService;
use App\Support\Money;

/**
 * Builds the standardized WhatsApp message and wa.me link for an enquiry.
 *
 * The message only contains catalogue details and public references — never customer
 * contact details, measurements or attribution data.
 */
class WhatsAppMessageBuilder
{
    /** Keep the encoded wa.me URL comfortably inside what WhatsApp clients accept. */
    public const MAX_ENCODED_LENGTH = 1800;

    public function __construct(private readonly SettingsService $settings) {}

    public function build(Enquiry $enquiry): string
    {
        $enquiry->loadMissing('items');
        $brand = $this->settings->get('brand_name', 'Grace New Designers');
        $closing = $this->settings->get('whatsapp_closing_line')
            ?: 'Could you please confirm availability, delivery details, and how to place the order?';

        $message = match ($enquiry->type) {
            EnquiryType::Product => $this->single($enquiry, $brand, $closing),
            EnquiryType::Bag => $this->bag($enquiry, $brand, $closing),
            EnquiryType::Consultation => $this->consultation($enquiry, $brand),
            EnquiryType::Contact => "Hello {$brand},\n\nI have a question for your team.\n\nEnquiry Ref: {$enquiry->reference}\n\nThank you.",
        };

        return $message;
    }

    public function url(string $message): ?string
    {
        $number = $this->settings->get('whatsapp_business_number');
        if (! $this->settings->get('whatsapp_enabled') || blank($number)) {
            return null;
        }

        return 'https://wa.me/'.ltrim($number, '+').'?text='.rawurlencode($message);
    }

    private function single(Enquiry $enquiry, string $brand, string $closing): string
    {
        /** @var EnquiryItem $item */
        $item = $enquiry->items->first();
        $lines = [
            "Hello {$brand},",
            '',
            "I'm interested in the following design:",
            '',
            "Product: {$item->product_name}",
            "Reference: {$item->product_sku}",
        ];
        if ($item->is_custom_size) {
            $lines[] = 'Size: Custom size (fitting consultation requested)';
        } elseif ($item->size_label) {
            $lines[] = "Size: {$item->size_label}";
        }
        if ($item->color_label) {
            $lines[] = "Color: {$item->color_label}";
        }
        $lines[] = "Quantity: {$item->quantity}";
        if ($price = $this->priceLine($item)) {
            $lines[] = $price;
        }
        if ($item->product_url) {
            $lines[] = "Product Link: {$item->product_url}";
        }
        $lines[] = "Enquiry Ref: {$enquiry->reference}";
        $lines[] = '';
        $lines[] = $item->price_mode === PriceMode::OnRequest
            ? 'Could you please share the price, availability and delivery details?'
            : $closing;
        $lines[] = '';
        $lines[] = 'Thank you.';

        return implode("\n", $lines);
    }

    private function bag(Enquiry $enquiry, string $brand, string $closing): string
    {
        $summaryUrl = $this->settings->siteUrl().'/enquiry/'.$enquiry->summary_token;
        $header = ["Hello {$brand},", '', "I'm interested in the following designs:", ''];
        $footer = [
            '',
            "Full list: {$summaryUrl}",
            "Enquiry Ref: {$enquiry->reference}",
            '',
            $closing,
            '',
            'Thank you.',
        ];

        $itemLines = $enquiry->items->values()->map(fn (EnquiryItem $item, int $i) => $this->compactItem($item, $i + 1))->all();

        // Drop trailing items (they remain on the summary page) until the encoded URL fits.
        $shown = count($itemLines);
        do {
            $body = array_slice($itemLines, 0, $shown);
            if ($shown < count($itemLines)) {
                $body[] = sprintf('…and %d more item(s) in the full list below.', count($itemLines) - $shown);
            }
            $message = implode("\n", [...$header, ...$body, ...$footer]);
            $shown--;
        } while ($shown > 0 && strlen(rawurlencode($message)) > self::MAX_ENCODED_LENGTH);

        return $message;
    }

    private function consultation(Enquiry $enquiry, string $brand): string
    {
        $lines = ["Hello {$brand},", '', "I'd like to book a consultation."];
        if ($enquiry->preferred_date) {
            $lines[] = 'Preferred date: '.$enquiry->preferred_date->format('j M Y');
        }
        $item = $enquiry->items->first();
        if ($item) {
            $lines[] = "Design of interest: {$item->product_name} ({$item->product_sku})";
        }
        $lines[] = "Enquiry Ref: {$enquiry->reference}";
        $lines[] = '';
        $lines[] = 'Could you please let me know the available slots?';
        $lines[] = '';
        $lines[] = 'Thank you.';

        return implode("\n", $lines);
    }

    private function compactItem(EnquiryItem $item, int $n): string
    {
        $variant = array_filter([
            $item->is_custom_size ? 'Custom size' : $item->size_label,
            $item->color_label,
        ]);
        $parts = [
            "{$n}. {$item->product_name}",
            $item->product_sku,
            $variant ? implode(' / ', $variant) : null,
            "Qty {$item->quantity}",
            $this->priceValue($item),
        ];

        return implode(' — ', array_filter($parts));
    }

    private function priceLine(EnquiryItem $item): ?string
    {
        if ($item->price_mode === PriceMode::OnRequest) {
            return null; // the closing line asks for the price instead
        }
        $value = $this->priceValue($item);

        return $value ? "Displayed Price: {$value}" : null;
    }

    private function priceValue(EnquiryItem $item): ?string
    {
        if ($item->price_mode === PriceMode::OnRequest || $item->unit_price === null) {
            return $item->price_mode === PriceMode::OnRequest ? 'Price on request' : null;
        }
        $formatted = Money::format($item->unit_price, $item->currency);

        return $item->price_mode === PriceMode::StartingFrom ? "From {$formatted}" : $formatted;
    }
}
