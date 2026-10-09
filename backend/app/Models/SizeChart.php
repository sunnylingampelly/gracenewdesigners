<?php

namespace App\Models;

use App\Models\Concerns\HasSlug;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['name', 'slug', 'description', 'unit', 'chart', 'measurement_guide', 'guide_media_id'])]
class SizeChart extends Model
{
    use HasSlug;

    protected function casts(): array
    {
        return ['chart' => 'array'];
    }

    public function guide(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'guide_media_id');
    }
}
