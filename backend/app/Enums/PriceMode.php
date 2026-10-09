<?php

namespace App\Enums;

enum PriceMode: string
{
    case Fixed = 'fixed';
    case StartingFrom = 'starting_from';
    case OnRequest = 'on_request';

    public function label(): string
    {
        return match ($this) {
            self::Fixed => 'Fixed Price',
            self::StartingFrom => 'Starting From',
            self::OnRequest => 'Price on Request',
        };
    }

    /** The storefront call-to-action wording for this price mode. */
    public function ctaLabel(): string
    {
        return match ($this) {
            self::Fixed => 'Order on WhatsApp',
            self::StartingFrom => 'Enquire on WhatsApp',
            self::OnRequest => 'Request Price on WhatsApp',
        };
    }

    public function exposesPrice(): bool
    {
        return $this !== self::OnRequest;
    }
}
