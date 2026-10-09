<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Human-friendly, unique public references such as GND-ENQ-000123 and GND-ORD-000045.
 * The numeric part follows the row id, so it is assigned after insert inside the same transaction.
 */
final class ReferenceGenerator
{
    public static function format(string $prefix, int $id): string
    {
        return sprintf('GND-%s-%06d', $prefix, $id);
    }

    /** Temporary placeholder used until the real id-based reference is written. */
    public static function pending(): string
    {
        return 'PENDING-'.bin2hex(random_bytes(8));
    }

    public static function assign(string $table, string $prefix, int $id): string
    {
        $reference = self::format($prefix, $id);
        DB::table($table)->where('id', $id)->update(['reference' => $reference]);

        return $reference;
    }
}
