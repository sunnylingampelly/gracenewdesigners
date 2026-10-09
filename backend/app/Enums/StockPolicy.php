<?php

namespace App\Enums;

enum StockPolicy: string
{
    /** Quantity is tracked; zero means out of stock. */
    case Track = 'track';
    /** Crafted on order; always available for enquiry regardless of quantity. */
    case MadeToOrder = 'made_to_order';
    /** Quantity is not tracked; treated as available. */
    case Untracked = 'untracked';
}
