<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'code', 'sort_order'])]
class ProductOption extends Model
{
    public const SIZE = 'size';

    public const COLOR = 'color';

    public function values(): HasMany
    {
        return $this->hasMany(ProductOptionValue::class)->orderBy('sort_order')->orderBy('id');
    }

    public static function idFor(string $code): int
    {
        return (int) static::query()->where('code', $code)->value('id');
    }
}
