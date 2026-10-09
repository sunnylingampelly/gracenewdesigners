<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

#[Fillable(['product_option_id', 'label', 'code', 'hex', 'size_group', 'is_custom', 'sort_order'])]
class ProductOptionValue extends Model
{
    protected function casts(): array
    {
        return ['is_custom' => 'boolean', 'sort_order' => 'integer'];
    }

    protected static function booted(): void
    {
        static::saving(function (ProductOptionValue $value) {
            $value->code = Str::slug($value->code ?: $value->label);
        });
    }

    public function option(): BelongsTo
    {
        return $this->belongsTo(ProductOption::class, 'product_option_id');
    }
}
