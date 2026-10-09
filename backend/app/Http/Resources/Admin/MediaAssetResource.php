<?php

namespace App\Http\Resources\Admin;

use App\Models\MediaAsset;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin MediaAsset
 */
class MediaAssetResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind->value,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'size_bytes' => $this->size_bytes,
            'width' => $this->width,
            'height' => $this->height,
            'alt_text' => $this->alt_text,
            'title' => $this->title,
            'folder' => $this->folder,
            'url' => $this->url(),
            'thumb_url' => $this->kind->value === 'image' ? $this->url('thumb') : null,
            'preview_url' => $this->kind->value === 'image' ? $this->url('md') : null,
            'processing_status' => $this->processing_status,
            'processing_error' => $this->processing_error,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
