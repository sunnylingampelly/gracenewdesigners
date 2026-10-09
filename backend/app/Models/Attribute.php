<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'code', 'type', 'group', 'is_filterable', 'is_visible', 'sort_order'])]
class Attribute extends Model
{
    public const TYPES = ['text', 'textarea', 'select', 'multiselect', 'boolean'];

    public const GROUPS = ['details', 'craft', 'care'];

    protected function casts(): array
    {
        return ['is_filterable' => 'boolean', 'is_visible' => 'boolean', 'sort_order' => 'integer'];
    }

    public function values(): HasMany
    {
        return $this->hasMany(AttributeValue::class)->orderBy('sort_order')->orderBy('value');
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class)->withPivot('is_required');
    }

    public function usesOptions(): bool
    {
        return in_array($this->type, ['select', 'multiselect'], true);
    }
}
