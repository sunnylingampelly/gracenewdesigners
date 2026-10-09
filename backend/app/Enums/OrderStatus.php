<?php

namespace App\Enums;

enum OrderStatus: string
{
    case PendingConfirmation = 'pending_confirmation';
    case Confirmed = 'confirmed';
    case InProduction = 'in_production';
    case Ready = 'ready';
    case Dispatched = 'dispatched';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::PendingConfirmation => 'Pending Confirmation',
            self::Confirmed => 'Confirmed',
            self::InProduction => 'In Production',
            self::Ready => 'Ready',
            self::Dispatched => 'Dispatched',
            self::Delivered => 'Delivered',
            self::Cancelled => 'Cancelled',
        };
    }
}
