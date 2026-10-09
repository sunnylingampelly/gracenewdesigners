<?php

namespace Tests\Feature;

use App\Models\HomepageSection;
use Tests\TestCase;

class HomepageBuilderTest extends TestCase
{
    private function createSection(string $type, string $name, array $config): int
    {
        return $this->postJson('/api/v1/admin/homepage/sections', ['type' => $type, 'name' => $name, 'config' => $config])
            ->assertCreated()->json('data.id');
    }

    public function test_drafts_only_go_live_when_published_and_reordering_applies_on_publish(): void
    {
        $this->product(['is_new_arrival' => true]);
        $this->actingAsRole('content-editor');
        $hero = $this->createSection('hero_image', 'Hero', ['headline' => 'Elegance, Reimagined.', 'desktop_media_id' => $this->mediaAsset()->id]);
        $products = $this->createSection('featured_products', 'New Arrivals', ['title' => 'New Arrivals', 'source' => 'new_arrivals']);

        $this->getJson('/api/v1/homepage')->assertOk()->assertJsonCount(0, 'data');

        $this->postJson('/api/v1/admin/homepage/publish')->assertOk();
        $this->assertSame(['hero_image', 'featured_products'], array_column($this->getJson('/api/v1/homepage')->json('data'), 'type'));

        $this->postJson('/api/v1/admin/homepage/sections/reorder', ['ids' => [$products, $hero]])->assertNoContent();
        $this->patchJson("/api/v1/admin/homepage/sections/{$hero}", ['config' => ['headline' => 'A New Headline', 'desktop_media_id' => $this->mediaAsset()->id]])->assertOk();

        // Live homepage is unchanged until publish.
        $live = $this->getJson('/api/v1/homepage')->json('data');
        $this->assertSame('hero_image', $live[0]['type']);
        $this->assertSame('Elegance, Reimagined.', $live[0]['data']['headline']);
        $this->getJson('/api/v1/admin/homepage/sections')->assertJsonPath('meta.has_unpublished_changes', true);

        $this->postJson('/api/v1/admin/homepage/publish')->assertOk();
        $live = $this->getJson('/api/v1/homepage')->json('data');
        $this->assertSame(['featured_products', 'hero_image'], array_column($live, 'type'));
        $this->assertSame('A New Headline', $live[1]['data']['headline']);
    }

    public function test_preview_token_exposes_drafts_only_with_valid_signature(): void
    {
        $this->actingAsRole('content-editor');
        $this->createSection('hero_image', 'Hero', ['headline' => 'Draft headline', 'desktop_media_id' => $this->mediaAsset()->id]);
        $token = $this->getJson('/api/v1/admin/homepage/preview-token')->json('data.token');

        $this->getJson('/api/v1/homepage?preview_token='.urlencode($token))->assertJsonPath('data.0.data.headline', 'Draft headline')->assertJsonPath('meta.preview', true);
        $this->getJson('/api/v1/homepage?preview_token='.urlencode($token.'x'))->assertJsonCount(0, 'data')->assertJsonPath('meta.preview', false);

        $this->travel(2)->hours();
        $this->getJson('/api/v1/homepage?preview_token='.urlencode($token))->assertJsonPath('meta.preview', false);
    }

    public function test_section_config_is_typed_and_sanitized(): void
    {
        $this->actingAsRole('content-editor');

        $this->postJson('/api/v1/admin/homepage/sections', ['type' => 'hero_image', 'name' => 'Bad', 'config' => ['headline' => 'X']])
            ->assertStatus(422)->assertJsonValidationErrors('desktop_media_id');
        $this->postJson('/api/v1/admin/homepage/sections', ['type' => 'hero_image', 'name' => 'Bad link', 'config' => [
            'headline' => 'X', 'desktop_media_id' => $this->mediaAsset()->id, 'cta_url' => 'javascript:alert(1)',
        ]])->assertStatus(422)->assertJsonValidationErrors('cta_url');

        $id = $this->createSection('text_image', 'Story', ['title' => '<b>Bold</b> <script>x</script>Title', 'unknown_key' => 'dropped']);
        $config = HomepageSection::find($id)->draft_config;
        $this->assertSame('Bold xTitle', $config['title']);
        $this->assertArrayNotHasKey('unknown_key', $config);
    }

    public function test_testimonials_section_only_shows_approved_consented_entries(): void
    {
        $this->actingAsRole('content-editor');
        $this->createSection('testimonials', 'Testimonials', ['title' => 'Kind Words']);
        $this->postJson('/api/v1/admin/homepage/publish');
        $this->getJson('/api/v1/homepage')->assertJsonCount(0, 'data'); // hidden with no testimonials

        $id = $this->postJson('/api/v1/admin/testimonials', ['author_name' => 'A. Client', 'quote' => 'Beautiful work.', 'consent_confirmed' => false])->json('data.id');
        $this->postJson("/api/v1/admin/testimonials/{$id}/approval", ['approved' => true])->assertStatus(422);

        $this->patchJson("/api/v1/admin/testimonials/{$id}", ['author_name' => 'A. Client', 'quote' => 'Beautiful work.', 'consent_confirmed' => true])->assertOk();
        $this->postJson("/api/v1/admin/testimonials/{$id}/approval", ['approved' => true])->assertOk();
        $this->getJson('/api/v1/homepage')->assertJsonPath('data.0.data.items.0.quote', 'Beautiful work.');
    }

    public function test_removing_a_live_section_waits_for_publish(): void
    {
        $this->actingAsRole('content-editor');
        $id = $this->createSection('newsletter', 'Newsletter', ['title' => 'Letters']);
        $this->postJson('/api/v1/admin/homepage/publish');

        $this->deleteJson("/api/v1/admin/homepage/sections/{$id}")->assertNoContent();
        $this->getJson('/api/v1/homepage')->assertJsonCount(1, 'data');

        $this->postJson('/api/v1/admin/homepage/publish');
        $this->getJson('/api/v1/homepage')->assertJsonCount(0, 'data');
        $this->assertDatabaseMissing('homepage_sections', ['id' => $id]);
    }
}
