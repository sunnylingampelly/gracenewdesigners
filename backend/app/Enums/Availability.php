<?php

namespace App\Enums;

enum Availability: string
{
    case InStock = 'in_stock';
    case LowStock = 'low_stock';
    case MadeToOrder = 'made_to_order';
    case OutOfStock = 'out_of_stock';

    public function label(): string
    {
        return match ($this) {
            self::InStock => 'In stock',
            self::LowStock => 'Only a few left',
            self::MadeToOrder => 'Made to order',
            self::OutOfStock => 'Currently unavailable',
        };
    }

    public function isEnquirable(): bool
    {
        return $this !== self::OutOfStock;
    }
}
