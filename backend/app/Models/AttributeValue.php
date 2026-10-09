<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

#[Fillable(['attribute_id', 'value', 'slug', 'sort_order'])]
class AttributeValue extends Model
{
    protected static function booted(): void
    {
        static::saving(function (AttributeValue $value) {
            $value->slug = Str::slug($value->slug ?: $value->value);
        });
    }

    public function attribute(): BelongsTo
    {
        return $this->belongsTo(Attribute::class);
    }
}
