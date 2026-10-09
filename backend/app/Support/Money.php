<?php

namespace App\Support;

use NumberFormatter;

final class Money
{
    /** Format an amount for display, e.g. ₹24,999 (Indian digit grouping for INR). */
    public static function format(string|int|float|null $amount, string $currency = 'INR'): ?string
    {
        if ($amount === null || $amount === '') {
            return null;
        }
        $locale = $currency === 'INR' ? 'en_IN' : 'en';
        $formatter = new NumberFormatter($locale, NumberFormatter::CURRENCY);
        $value = (float) $amount;
        $formatter->setAttribute(NumberFormatter::FRACTION_DIGITS, fmod($value, 1.0) === 0.0 ? 0 : 2);

        return $formatter->formatCurrency($value, $currency);
    }
}
