<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['from_path', 'to_path', 'status_code'])]
class Redirect extends Model
{
    protected function casts(): array
    {
        return ['status_code' => 'integer', 'hits' => 'integer'];
    }

    public static function normalize(string $path): string
    {
        return '/'.trim(parse_url($path, PHP_URL_PATH) ?? $path, '/');
    }

    /** Record a 301 from an old path, collapsing chains and removing loops. */
    public static function record(string $from, string $to): void
    {
        $from = self::normalize($from);
        $to = self::normalize($to);
        if ($from === $to) {
            return;
        }
        static::query()->where('from_path', $to)->delete();
        static::query()->where('to_path', $from)->update(['to_path' => $to]);
        static::query()->updateOrCreate(['from_path' => $from], ['to_path' => $to, 'status_code' => 301]);
    }
}
