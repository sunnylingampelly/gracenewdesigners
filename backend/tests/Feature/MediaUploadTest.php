<?php

namespace Tests\Feature;

use App\Models\MediaAsset;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaUploadTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    public function test_valid_image_is_stored_with_renditions(): void
    {
        $this->actingAsRole('catalog-manager');

        $response = $this->postJson('/api/v1/admin/media', [
            'file' => UploadedFile::fake()->image('Bridal Look.JPG', 1200, 1600),
            'alt_text' => 'Bride in ivory lehenga',
        ])->assertCreated();

        $asset = MediaAsset::query()->find($response->json('data.id'));
        $this->assertSame('processed', $asset->processing_status);
        $this->assertSame('bridal-look.jpg', $asset->original_name);
        $this->assertStringEndsWith('/original.jpg', $asset->path);
        Storage::disk('public')->assertExists($asset->path);
        foreach (['thumb', 'sm', 'md'] as $rendition) {
            Storage::disk('public')->assertExists($asset->renditions[$rendition]['path']);
            $this->assertSame('webp', $asset->renditions[$rendition]['format']);
        }
        $this->assertArrayNotHasKey('lg', $asset->renditions); // never upscaled
    }

    public function test_duplicate_uploads_reuse_the_existing_asset(): void
    {
        $this->actingAsRole('catalog-manager');
        $file = UploadedFile::fake()->image('a.jpg', 800, 800);

        $first = $this->postJson('/api/v1/admin/media', ['file' => $file])->assertCreated()->json('data.id');
        $second = $this->postJson('/api/v1/admin/media', ['file' => $file])->assertOk()->json('data.id');

        $this->assertSame($first, $second);
    }

    public function test_executable_disguised_as_image_is_rejected(): void
    {
        $this->actingAsRole('catalog-manager');
        $path = tempnam(sys_get_temp_dir(), 'gnd');
        // Non-image content with an image extension (a PHP webshell payload works too, but local
        // antivirus software may lock such files mid-test on developer machines).
        file_put_contents($path, '<html><body>not an image</body></html>');
        $fake = new UploadedFile($path, 'shell.jpg', 'image/jpeg', null, true);

        $this->postJson('/api/v1/admin/media', ['file' => $fake])->assertStatus(422)->assertJsonValidationErrors('file');
        $this->postJson('/api/v1/admin/media', ['file' => UploadedFile::fake()->create('run.php', 2, 'application/x-php')])->assertStatus(422);
        $this->assertSame(0, MediaAsset::query()->count());
    }

    public function test_images_below_minimum_dimensions_are_rejected(): void
    {
        $this->actingAsRole('catalog-manager');

        $this->postJson('/api/v1/admin/media', ['file' => UploadedFile::fake()->image('tiny.png', 120, 120)])
            ->assertStatus(422)->assertJsonValidationErrors('file');
    }

    public function test_media_in_use_cannot_be_deleted(): void
    {
        $product = $this->product();
        $asset = $product->media()->first()->asset;
        $this->actingAsRole('catalog-manager');

        $this->deleteJson("/api/v1/admin/media/{$asset->id}")->assertStatus(422)->assertJsonValidationErrors('media');
        $this->getJson("/api/v1/admin/media/{$asset->id}")->assertOk()->assertJsonPath('data.usages.products', 1);
    }

    public function test_media_upload_requires_permission(): void
    {
        $this->actingAsRole('enquiry-manager');

        $this->postJson('/api/v1/admin/media', ['file' => UploadedFile::fake()->image('a.jpg', 800, 800)])->assertForbidden();
    }
}
