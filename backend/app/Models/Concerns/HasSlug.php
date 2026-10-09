<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * Generates a unique slug from the model's name/title when none is provided.
 */
trait HasSlug
{
    protected static function bootHasSlug(): void
    {
        static::saving(function ($model) {
            if (blank($model->slug)) {
                $model->slug = static::uniqueSlug($model->{$model->slugSource()}, $model->getKey());
            } else {
                $model->slug = Str::slug($model->slug);
            }
        });
    }

    protected function slugSource(): string
    {
        return 'name';
    }

    public static function uniqueSlug(string $value, mixed $ignoreId = null): string
    {
        $base = Str::slug($value) ?: Str::lower(Str::random(8));
        $slug = $base;
        $i = 2;

        $query = fn (string $candidate) => static::query()
            ->when(in_array(SoftDeletes::class, class_uses_recursive(static::class)), fn ($q) => $q->withTrashed())
            ->where('slug', $candidate)
            ->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))
            ->exists();

        while ($query($slug)) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}
