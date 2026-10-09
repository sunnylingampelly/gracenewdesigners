<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id', 'original_name', 'path', 'dry_run', 'status', 'total_rows', 'created_count', 'updated_count',
    'skipped_count', 'error_count', 'row_errors', 'preview', 'started_at', 'finished_at',
])]
class ProductImport extends Model
{
    protected function casts(): array
    {
        return [
            'dry_run' => 'boolean',
            'row_errors' => 'array',
            'preview' => 'array',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
