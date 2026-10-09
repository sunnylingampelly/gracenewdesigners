<?php

namespace App\Support;

use Mews\Purifier\Facades\Purifier;

/**
 * Restricts rich text (product descriptions, CMS pages) to a safe editorial subset of HTML.
 */
class HtmlSanitizer
{
    public function clean(?string $html): ?string
    {
        if ($html === null || trim($html) === '') {
            return null;
        }

        return Purifier::clean($html, 'editorial');
    }
}
