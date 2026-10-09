<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * First-party, consent-aware measurement events. Never contains personal data.
 */
#[Fillable(['event_name', 'product_id', 'session_hash', 'path', 'payload', 'occurred_at'])]
class AnalyticsEvent extends Model
{
    public $timestamps = false;

    /** Events the storefront may record; purchase events are deliberately absent. */
    public const ALLOWED = [
        'page_view', 'view_item_list', 'select_item', 'view_item', 'search', 'select_size', 'select_color',
        'add_to_wishlist', 'add_to_bag', 'whatsapp_enquiry_initiated',
    ];

    protected function casts(): array
    {
        return ['payload' => 'array', 'occurred_at' => 'datetime'];
    }
}
