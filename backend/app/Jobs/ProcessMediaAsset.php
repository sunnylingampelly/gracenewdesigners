<?php

namespace App\Jobs;

use App\Models\MediaAsset;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\Encoders\AvifEncoder;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\ImageManager;
use Throwable;

/**
 * Generates responsive WebP (and optionally AVIF) renditions. Decoding applies EXIF orientation,
 * and re-encoding strips EXIF metadata (including GPS) from every derived file. Originals are retained.
 */
class ProcessMediaAsset implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 300;

    public function __construct(public int $mediaAssetId) {}

    public function handle(): void
    {
        $asset = MediaAsset::query()->find($this->mediaAssetId);
        if (! $asset || $asset->kind->value !== 'image') {
            return;
        }

        $disk = Storage::disk($asset->disk);
        $manager = ImageManager::usingDriver(Driver::class, autoOrientation: true, strip: true);
        $source = $manager->decodeBinary($disk->get($asset->path));

        // Dimensions after orientation correction (portrait phone photos report swapped sizes in EXIF).
        $width = $source->width();
        $height = $source->height();
        $directory = dirname($asset->path);
        $renditions = [];

        foreach (MediaAsset::RENDITIONS as $name => $maxWidth) {
            if ($maxWidth > $width && $name !== 'thumb' && $renditions !== []) {
                continue; // never upscale beyond the original, but always produce at least one rendition
            }
            $image = $manager->decodeBinary($disk->get($asset->path));
            $image->scaleDown(width: $maxWidth);
            $path = "{$directory}/{$name}.webp";
            $disk->put($path, $image->encode(new WebpEncoder(quality: 80, strip: true))->toString(), ['visibility' => 'public']);
            $renditions[$name] = ['path' => $path, 'width' => $image->width(), 'height' => $image->height(), 'format' => 'webp'];

            if (config('media.avif') && in_array($name, ['md', 'lg'], true)) {
                $avifPath = "{$directory}/{$name}.avif";
                $disk->put($avifPath, $image->encode(new AvifEncoder(quality: 60, strip: true))->toString(), ['visibility' => 'public']);
                $renditions[$name.'_avif'] = ['path' => $avifPath, 'width' => $image->width(), 'height' => $image->height(), 'format' => 'avif'];
            }
        }

        $asset->forceFill([
            'width' => $width,
            'height' => $height,
            'renditions' => $renditions,
            'processing_status' => 'processed',
            'processing_error' => null,
        ])->save();
    }

    public function failed(Throwable $e): void
    {
        MediaAsset::query()->whereKey($this->mediaAssetId)->update([
            'processing_status' => 'failed',
            'processing_error' => mb_substr($e->getMessage(), 0, 1000),
        ]);
    }
}
