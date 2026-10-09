<?php

namespace Database\Seeders\Support;

use App\Enums\MediaKind;
use App\Jobs\ProcessMediaAsset;
use App\Models\MediaAsset;
use App\Services\Media\MediaService;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Generates clearly-labelled placeholder images locally with GD (no third-party or scraped imagery).
 * Each image is an abstract arch motif on a tonal gradient, stamped "PLACEHOLDER". Every placeholder is
 * stored in the "placeholders" media folder so the team can find and replace them from the admin.
 */
class PlaceholderMedia
{
    public static function make(string $label, string $hexA, string $hexB, int $width = 1000, int $height = 1250, ?string $alt = null): MediaAsset
    {
        $img = imagecreatetruecolor($width, $height);
        [$r1, $g1, $b1] = self::rgb($hexA);
        [$r2, $g2, $b2] = self::rgb($hexB);

        for ($y = 0; $y < $height; $y++) {
            $t = $y / max(1, $height - 1);
            $color = imagecolorallocate($img, (int) ($r1 + ($r2 - $r1) * $t), (int) ($g1 + ($g2 - $g1) * $t), (int) ($b1 + ($b2 - $b1) * $t));
            imageline($img, 0, $y, $width, $y, $color);
        }

        // Jharokha-style arch outline.
        imagesetthickness($img, max(2, (int) ($width / 400)));
        $line = imagecolorallocatealpha($img, 250, 249, 246, 70);
        $archW = (int) ($width * 0.56);
        $archH = (int) ($height * 0.62);
        $cx = (int) ($width / 2);
        $top = (int) (($height - $archH) / 2);
        foreach ([0, (int) ($width * 0.03)] as $inset) {
            $w = $archW - $inset * 2;
            imagearc($img, $cx, $top + (int) ($w / 2) + $inset, $w, $w, 180, 360, $line);
            imageline($img, $cx - (int) ($w / 2), $top + (int) ($w / 2) + $inset, $cx - (int) ($w / 2), $top + $archH - $inset, $line);
            imageline($img, $cx + (int) ($w / 2), $top + (int) ($w / 2) + $inset, $cx + (int) ($w / 2), $top + $archH - $inset, $line);
            imageline($img, $cx - (int) ($w / 2), $top + $archH - $inset, $cx + (int) ($w / 2), $top + $archH - $inset, $line);
        }

        // "PLACEHOLDER" + label, rendered small and scaled up for legibility without bundled fonts.
        self::stamp($img, 'PLACEHOLDER IMAGE', (int) ($height * 0.86), max(2, (int) ($width / 330)));
        self::stamp($img, Str::upper(Str::limit($label, 34, '')), (int) ($height * 0.91), max(2, (int) ($width / 500)));

        ob_start();
        imagejpeg($img, null, 86);
        $binary = ob_get_clean();
        imagedestroy($img);

        $uuid = (string) Str::uuid();
        $path = 'media/placeholders/'.$uuid.'/original.jpg';
        $disk = MediaService::disk();
        Storage::disk($disk)->put($path, $binary, ['visibility' => 'public']);

        $asset = MediaAsset::query()->create([
            'uuid' => $uuid,
            'disk' => $disk,
            'path' => $path,
            'original_name' => Str::slug($label).'-placeholder.jpg',
            'mime_type' => 'image/jpeg',
            'extension' => 'jpg',
            'kind' => MediaKind::Image,
            'size_bytes' => strlen($binary),
            'width' => $width,
            'height' => $height,
            'checksum' => hash('sha256', $binary),
            'alt_text' => $alt ?? "Placeholder image — {$label}",
            'title' => "Placeholder: {$label}",
            'folder' => 'placeholders',
            'processing_status' => 'pending',
        ]);
        (new ProcessMediaAsset($asset->id))->handle();

        return $asset->fresh();
    }

    private static function stamp(\GdImage $img, string $text, int $y, int $scale): void
    {
        $font = 3;
        $w = imagefontwidth($font) * strlen($text);
        $h = imagefontheight($font);
        $small = imagecreatetruecolor($w, $h);
        imagesavealpha($small, true);
        imagefill($small, 0, 0, imagecolorallocatealpha($small, 0, 0, 0, 127));
        imagestring($small, $font, 0, 0, $text, imagecolorallocate($small, 250, 249, 246));
        $dw = $w * $scale;
        $dh = $h * $scale;
        imagecopyresampled($img, $small, (int) ((imagesx($img) - $dw) / 2), $y, 0, 0, $dw, $dh, $w, $h);
        imagedestroy($small);
    }

    /** @return array{int, int, int} */
    private static function rgb(string $hex): array
    {
        $hex = ltrim($hex, '#');

        return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
    }
}
