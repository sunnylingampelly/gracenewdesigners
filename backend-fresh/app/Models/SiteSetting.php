<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;

class SiteSetting extends Model {
    protected $fillable = ['key', 'value', 'type', 'label', 'group'];

    public static function get(string $key, $default = null) {
        return static::where('key', $key)->value('value') ?? $default;
    }

    public static function set(string $key, $value): void {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
    }

    public static function allGrouped(): array {
        return static::all()->groupBy('group')->map(fn($g) => $g->keyBy('key'))->toArray();
    }
}
