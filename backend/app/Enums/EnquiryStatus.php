<?php

namespace App\Enums;

enum EnquiryStatus: string
{
    case New = 'new';
    case Contacted = 'contacted';
    case AwaitingResponse = 'awaiting_response';
    case Qualified = 'qualified';
    case OrderConfirmed = 'order_confirmed';
    case Completed = 'completed';
    case Lost = 'lost';
    case Spam = 'spam';

    public function label(): string
    {
        return match ($this) {
            self::New => 'New',
            self::Contacted => 'Contacted',
            self::AwaitingResponse => 'Awaiting Response',
            self::Qualified => 'Qualified',
            self::OrderConfirmed => 'Order Confirmed',
            self::Completed => 'Completed',
            self::Lost => 'Lost',
            self::Spam => 'Spam',
        };
    }

    /** Statuses that still need attention from the team. */
    public static function open(): array
    {
        return [self::New, self::Contacted, self::AwaitingResponse, self::Qualified];
    }
}
