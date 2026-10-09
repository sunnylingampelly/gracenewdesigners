<?php

namespace App\Models;

use App\Enums\MediaKind;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

#[Fillable([
    'uuid', 'disk', 'path', 'original_name', 'mime_type', 'extension', 'kind', 'size_bytes', 'width', 'height',
    'duration_seconds', 'checksum', 'alt_text', 'title', 'folder', 'renditions', 'processing_status',
    'processing_error', 'focal_x', 'focal_y', 'uploaded_by',
])]
class MediaAsset extends Model
{
    use HasFactory, SoftDeletes;

    /** Rendition widths generated for every image (name => max width). */
    public const RENDITIONS = ['thumb' => 320, 'sm' => 640, 'md' => 1080, 'lg' => 1600, 'xl' => 2400];

    protected function casts(): array
    {
        return [
            'kind' => MediaKind::class,
            'renditions' => 'array',
            'size_bytes' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'focal_x' => 'float',
            'focal_y' => 'float',
        ];
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function url(?string $rendition = null): string
    {
        $path = $rendition && isset($this->renditions[$rendition]['path'])
            ? $this->renditions[$rendition]['path']
            : $this->path;

        return Storage::disk($this->disk)->url($path);
    }

    /**
     * Public representation used by storefront and admin resources.
     *
     * @return array<string, mixed>
     */
    public function toPublicArray(?string $altOverride = null): array
    {
        $sources = [];
        foreach ($this->renditions ?? [] as $name => $rendition) {
            $sources[] = [
                'name' => $name,
                'url' => Storage::disk($this->disk)->url($rendition['path']),
                'width' => $rendition['width'] ?? null,
                'height' => $rendition['height'] ?? null,
                'format' => $rendition['format'] ?? null,
            ];
        }

        return [
            'id' => $this->id,
            'kind' => $this->kind->value,
            'url' => $this->url(),
            'width' => $this->width,
            'height' => $this->height,
            'alt' => $altOverride ?: ($this->alt_text ?? ''),
            'mime_type' => $this->mime_type,
            'focal_point' => $this->focal_x !== null ? ['x' => $this->focal_x, 'y' => $this->focal_y] : null,
            'sources' => $sources,
        ];
    }
}
