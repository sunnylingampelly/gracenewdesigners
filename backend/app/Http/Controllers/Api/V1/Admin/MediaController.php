<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\Admin\MediaAssetResource;
use App\Jobs\ProcessMediaAsset;
use App\Models\MediaAsset;
use App\Services\Media\MediaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MediaController extends Controller
{
    public function __construct(private readonly MediaService $media) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', MediaAsset::class);
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'kind' => ['nullable', Rule::in(['image', 'video', 'document'])],
            'folder' => ['nullable', 'string', 'max:100'],
            'orphaned' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:100'],
        ]);

        $query = MediaAsset::query()
            ->when($filters['q'] ?? null, fn ($q, $term) => $q->where(fn ($w) => $w
                ->where('original_name', 'like', '%'.$term.'%')->orWhere('alt_text', 'like', '%'.$term.'%')->orWhere('title', 'like', '%'.$term.'%')))
            ->when($filters['kind'] ?? null, fn ($q, $kind) => $q->where('kind', $kind))
            ->when($filters['folder'] ?? null, fn ($q, $folder) => $q->where('folder', $folder))
            ->latest('id');

        if (! empty($filters['orphaned'])) {
            // Candidate orphans: not referenced by the main relational tables (JSON references are checked on delete).
            foreach ([['product_media', 'media_asset_id'], ['product_variants', 'media_asset_id'], ['lookbook_media', 'media_asset_id'],
                ['categories', 'image_media_id'], ['categories', 'banner_media_id'], ['collections', 'cover_media_id'],
                ['collections', 'banner_media_id'], ['occasions', 'image_media_id'], ['pages', 'hero_media_id'],
                ['lookbooks', 'cover_media_id'], ['testimonials', 'media_asset_id'], ['products', 'og_media_id']] as [$table, $column]) {
                $query->whereNotIn('id', DB::table($table)->whereNotNull($column)->select($column));
            }
        }

        return MediaAssetResource::collection($query->paginate($filters['per_page'] ?? 40)->withQueryString());
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', MediaAsset::class);
        $data = $request->validate([
            // Mime is re-checked by content sniffing in MediaService; this is the first gate.
            'file' => ['required', 'file', 'max:153600', 'mimes:jpg,jpeg,png,webp,avif,mp4,webm,pdf'],
            'alt_text' => ['nullable', 'string', 'max:300'],
            'title' => ['nullable', 'string', 'max:255'],
            'folder' => ['nullable', 'string', 'max:100', 'regex:/^[a-z0-9\-]+$/'],
        ]);
        $asset = $this->media->store($data['file'], $data);

        return (new MediaAssetResource($asset))->response()->setStatusCode($asset->wasRecentlyCreated ? 201 : 200);
    }

    public function show(MediaAsset $medium): JsonResponse
    {
        $this->authorize('view', $medium);

        return response()->json(['data' => [...(new MediaAssetResource($medium))->resolve(), 'usages' => $this->media->usages($medium)]]);
    }

    public function update(Request $request, MediaAsset $medium): MediaAssetResource
    {
        $this->authorize('update', $medium);
        $medium->update($request->validate([
            'alt_text' => ['nullable', 'string', 'max:300'],
            'title' => ['nullable', 'string', 'max:255'],
            'folder' => ['nullable', 'string', 'max:100', 'regex:/^[a-z0-9\-]+$/'],
            'focal_x' => ['nullable', 'numeric', 'between:0,1'],
            'focal_y' => ['nullable', 'numeric', 'between:0,1'],
        ]));

        return new MediaAssetResource($medium);
    }

    public function destroy(MediaAsset $medium): JsonResponse
    {
        $this->authorize('delete', $medium);
        $this->media->delete($medium);

        return response()->json(null, 204);
    }

    public function reprocess(MediaAsset $medium): MediaAssetResource
    {
        $this->authorize('update', $medium);
        $medium->update(['processing_status' => 'pending', 'processing_error' => null]);
        ProcessMediaAsset::dispatch($medium->id);

        return new MediaAssetResource($medium->fresh());
    }
}
