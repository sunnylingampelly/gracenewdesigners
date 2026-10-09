<?php

namespace App\Services\Media;

use App\Enums\MediaKind;
use App\Jobs\ProcessMediaAsset;
use App\Models\MediaAsset;
use App\Services\ActivityLogger;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Secure media ingestion: MIME sniffing (not trusting the client), size and dimension limits,
 * random storage names, checksum de-duplication and queued rendition generation.
 */
class MediaService
{
    /** Allowed sniffed MIME types => [kind, extension, max bytes]. */
    public const ALLOWED = [
        'image/jpeg' => [MediaKind::Image, 'jpg', 25 * 1024 * 1024],
        'image/png' => [MediaKind::Image, 'png', 25 * 1024 * 1024],
        'image/webp' => [MediaKind::Image, 'webp', 25 * 1024 * 1024],
        'image/avif' => [MediaKind::Image, 'avif', 25 * 1024 * 1024],
        'video/mp4' => [MediaKind::Video, 'mp4', 150 * 1024 * 1024],
        'video/webm' => [MediaKind::Video, 'webm', 150 * 1024 * 1024],
        'application/pdf' => [MediaKind::Document, 'pdf', 10 * 1024 * 1024],
    ];

    public const MIN_IMAGE_EDGE = 300;

    public const MAX_IMAGE_EDGE = 12000;

    public function __construct(private readonly ActivityLogger $logger) {}

    public static function disk(): string
    {
        return config('media.disk', 'public');
    }

    public function store(UploadedFile $file, array $meta = []): MediaAsset
    {
        $localPath = $file->getRealPath() ?: $file->getPathname();
        // Sniff the real type from the leading bytes; the client-supplied MIME type is never trusted.
        $head = @file_get_contents($localPath, false, null, 0, 8192);
        if ($head === false || $head === '') {
            throw ValidationException::withMessages(['file' => 'The uploaded file could not be read. Please try again.']);
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($head) ?: 'application/octet-stream';
        if (! isset(self::ALLOWED[$mime])) {
            throw ValidationException::withMessages(['file' => 'Unsupported file type. Upload JPEG, PNG, WebP or AVIF images, MP4/WebM video, or PDF guides.']);
        }
        [$kind, $extension, $maxBytes] = self::ALLOWED[$mime];

        if ($file->getSize() > $maxBytes) {
            throw ValidationException::withMessages(['file' => sprintf('File is too large (max %d MB).', $maxBytes / 1024 / 1024)]);
        }

        $width = $height = null;
        if ($kind === MediaKind::Image) {
            $info = @getimagesize($localPath);
            if ($info === false) {
                throw ValidationException::withMessages(['file' => 'The image could not be read. It may be corrupted.']);
            }
            [$width, $height] = $info;
            if (min($width, $height) < self::MIN_IMAGE_EDGE) {
                throw ValidationException::withMessages(['file' => 'Image is too small. The shortest edge must be at least '.self::MIN_IMAGE_EDGE.'px.']);
            }
            if (max($width, $height) > self::MAX_IMAGE_EDGE) {
                throw ValidationException::withMessages(['file' => 'Image is too large. The longest edge must be at most '.self::MAX_IMAGE_EDGE.'px.']);
            }
        }

        $checksum = hash_file('sha256', $localPath);
        if ($existing = MediaAsset::query()->where('checksum', $checksum)->where('size_bytes', $file->getSize())->first()) {
            return $existing;
        }

        $uuid = (string) Str::uuid();
        $directory = 'media/'.now()->format('Y/m').'/'.$uuid;
        $path = Storage::disk(self::disk())->putFileAs($directory, $file, 'original.'.$extension, ['visibility' => 'public']);
        if ($path === false) {
            throw ValidationException::withMessages(['file' => 'The file could not be stored. Please try again.']);
        }

        $asset = DB::transaction(fn () => MediaAsset::query()->create([
            'uuid' => $uuid,
            'disk' => self::disk(),
            'path' => $path,
            'original_name' => Str::limit($this->safeName($file->getClientOriginalName()), 250, ''),
            'mime_type' => $mime,
            'extension' => $extension,
            'kind' => $kind,
            'size_bytes' => $file->getSize(),
            'width' => $width,
            'height' => $height,
            'checksum' => $checksum,
            'alt_text' => $meta['alt_text'] ?? null,
            'title' => $meta['title'] ?? null,
            'folder' => $meta['folder'] ?? null,
            'processing_status' => $kind === MediaKind::Image ? 'pending' : 'processed',
            'uploaded_by' => Auth::id(),
        ]));

        if ($kind === MediaKind::Image) {
            ProcessMediaAsset::dispatch($asset->id);
        }
        $this->logger->log('media.uploaded', "Uploaded {$asset->original_name}", $asset);

        $fresh = $asset->fresh();
        $fresh->wasRecentlyCreated = true;

        return $fresh;
    }

    /** Places where a media asset is referenced; used to block unsafe deletion and find orphans. */
    public function usages(MediaAsset $asset): array
    {
        $id = $asset->id;
        $checks = [
            'products' => fn () => DB::table('product_media')->where('media_asset_id', $id)->count()
                + DB::table('product_variants')->where('media_asset_id', $id)->count()
                + DB::table('products')->where('og_media_id', $id)->count(),
            'lookbooks' => fn () => DB::table('lookbook_media')->where('media_asset_id', $id)->count()
                + DB::table('lookbooks')->where('cover_media_id', $id)->count(),
            'taxonomy' => fn () => DB::table('categories')->where('banner_media_id', $id)->orWhere('image_media_id', $id)->count()
                + DB::table('collections')->where('cover_media_id', $id)->orWhere('banner_media_id', $id)->count()
                + DB::table('occasions')->where('image_media_id', $id)->count()
                + DB::table('departments')->where('banner_media_id', $id)->count(),
            'content' => fn () => DB::table('pages')->where('hero_media_id', $id)->count()
                + DB::table('navigation_items')->where('image_media_id', $id)->count()
                + DB::table('testimonials')->where('media_asset_id', $id)->count()
                + DB::table('size_charts')->where('guide_media_id', $id)->count()
                + $this->homepageReferences($id),
            'settings' => fn () => DB::table('settings')->where('key', 'like', '%_media_id')->get()
                ->filter(fn ($row) => (int) json_decode($row->value ?? 'null') === $id)->count(),
        ];

        return array_filter(array_map(fn ($check) => $check(), $checks));
    }

    private function homepageReferences(int $id): int
    {
        // Section configs are JSON; media ids appear under keys ending in "media_id" or in "media_ids" lists.
        return DB::table('homepage_sections')->get(['draft_config', 'config'])->filter(function ($row) use ($id) {
            $haystack = ($row->draft_config ?? '').($row->config ?? '');

            return preg_match('/"[a-z_]*media_id"\s*:\s*'.$id.'\b/', $haystack)
                || preg_match('/"[a-z_]*media_ids"\s*:\s*\[[^\]]*\b'.$id.'\b/', $haystack);
        })->count();
    }

    public function delete(MediaAsset $asset): void
    {
        if ($usages = $this->usages($asset)) {
            throw ValidationException::withMessages([
                'media' => 'This file is still in use ('.implode(', ', array_keys($usages)).'). Remove it from those places first.',
            ]);
        }
        $disk = Storage::disk($asset->disk);
        $disk->delete(array_filter([$asset->path, ...array_column($asset->renditions ?? [], 'path')]));
        $asset->forceDelete();
        $this->logger->log('media.deleted', "Deleted {$asset->original_name}");
    }

    private function safeName(string $name): string
    {
        $base = pathinfo($name, PATHINFO_FILENAME);
        $ext = pathinfo($name, PATHINFO_EXTENSION);

        return Str::slug($base).($ext ? '.'.Str::lower(preg_replace('/[^a-zA-Z0-9]/', '', $ext)) : '');
    }
}
