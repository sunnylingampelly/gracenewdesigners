<?php

namespace Database\Seeders;

use App\Enums\SectionType;
use App\Models\Category;
use App\Models\Collection;
use App\Models\HomepageSection;
use App\Models\Lookbook;
use App\Services\Content\HomepageService;
use Database\Seeders\Support\PlaceholderMedia;
use Illuminate\Database\Seeder;

/**
 * The fourteen-section editorial homepage, seeded as draft and then published.
 * Sections whose content does not exist yet (e.g. no collections) are skipped,
 * and the Testimonials section stays hidden until genuine testimonials are approved.
 */
class HomepageSeeder extends Seeder
{
    public function run(HomepageService $homepage): void
    {
        if (HomepageSection::query()->exists()) {
            return;
        }

        $hero = PlaceholderMedia::make('Hero campaign', '#081B33', '#285A87', 2400, 1350, 'Placeholder campaign image — replace with the season’s hero photograph');
        $heroMobile = PlaceholderMedia::make('Hero mobile', '#102E55', '#081B33', 1080, 1600, 'Placeholder campaign image (mobile crop)');
        $bridal = PlaceholderMedia::make('Bridal feature', '#5E1A2E', '#9B1B30', 1600, 2000, 'Placeholder bridal editorial image');
        $story = PlaceholderMedia::make('Brand story', '#EAF5FB', '#79B7DF', 1600, 2000, 'Placeholder studio image');
        $craft = PlaceholderMedia::make('Craftsmanship', '#C9A54C', '#102E55', 1600, 2000, 'Placeholder craftsmanship close-up');
        $appointment = PlaceholderMedia::make('Consultation', '#102E55', '#79B7DF', 1600, 2000, 'Placeholder consultation image');

        $categoryItems = collect(['women/sarees', 'women/lehengas', 'women/gowns', 'women/kurta-sets', 'bridal/bridal-lehengas', 'men/sherwanis'])
            ->map(fn ($path) => Category::query()->where('path', $path)->first())->filter()
            ->map(fn (Category $c) => ['category_id' => $c->id, 'label' => match ($c->path) {
                'bridal/bridal-lehengas' => 'Bridal Wear', 'men/sherwanis' => 'Menswear', default => $c->name,
            }])->values()->all();

        $signature = Collection::query()->where('is_featured', true)->orderBy('sort_order')->first() ?? Collection::query()->first();
        $lookbook = Lookbook::query()->first();
        $social = collect(range(1, 6))->map(fn ($i) => ['media_id' => PlaceholderMedia::make("Social post {$i}", ['#102E55', '#79B7DF', '#EAF5FB', '#285A87', '#5E1A2E', '#C9A54C'][$i - 1], '#081B33', 1080, 1080)->id, 'alt' => "Placeholder social image {$i}"])->all();

        $sections = [
            [SectionType::HeroImage, 'Hero', [
                'eyebrow' => 'The New Season', 'headline' => 'Elegance, Reimagined.',
                'subtitle' => 'Discover thoughtfully crafted fashion for your most memorable moments.',
                'cta_label' => 'Explore the Collection', 'cta_url' => $signature ? '/collections/'.$signature->slug : '/collections',
                'desktop_media_id' => $hero->id, 'mobile_media_id' => $heroMobile->id,
                'align' => 'center', 'overlay_opacity' => 0.35, 'height' => 'full',
            ]],
            [SectionType::CategoryGrid, 'Shop by Category', ['eyebrow' => 'Discover', 'title' => 'Shop by Category', 'items' => $categoryItems, 'layout' => 'grid']],
            $signature ? [SectionType::CollectionFeature, 'Signature Collection', [
                'collection_id' => $signature->id, 'eyebrow' => 'Signature Collection', 'image_position' => 'left', 'theme' => 'ivory',
            ]] : null,
            [SectionType::FeaturedProducts, 'New Arrivals', ['eyebrow' => 'Just In', 'title' => 'New Arrivals', 'source' => 'new_arrivals', 'limit' => 8, 'layout' => 'carousel', 'cta_label' => 'View all new arrivals', 'cta_url' => '/new-arrivals']],
            [SectionType::OccasionGrid, 'Shop by Occasion', ['eyebrow' => 'Dressed for the Moment', 'title' => 'Shop by Occasion']],
            [SectionType::SplitEditorial, 'Bridal Feature', [
                'eyebrow' => 'Bridal', 'title' => 'For the Bride, Made by Hand',
                'body' => "Bridal lehengas, sarees and reception looks, shaped around you.\nBegin with a consultation and we will guide you through fabric, colour and fit.",
                'media_id' => $bridal->id, 'image_position' => 'right', 'theme' => 'navy',
                'cta_label' => 'Explore Bridal', 'cta_url' => '/shop/bridal',
            ]],
            [SectionType::FeaturedProducts, 'Bestsellers', ['eyebrow' => 'Most Loved', 'title' => 'Bestsellers', 'source' => 'bestsellers', 'limit' => 4, 'layout' => 'grid']],
            [SectionType::BrandStory, 'Brand Story', [
                'eyebrow' => 'Grace New Designers', 'title' => 'Modern Indian Couture, Timeless Grace',
                'body' => "We design bridal couture, occasionwear and ethnic luxury for women and men — pieces that honour Indian craft while feeling entirely of today.\nEditor’s note: replace this paragraph with the studio’s own story.",
                'media_id' => $story->id, 'image_position' => 'left', 'theme' => 'white',
                'cta_label' => 'Our Story', 'cta_url' => '/pages/our-story',
            ]],
            $lookbook ? [SectionType::LookbookGallery, 'Lookbook', ['eyebrow' => 'Lookbook', 'title' => $lookbook->title, 'lookbook_id' => $lookbook->id, 'cta_label' => 'View the Lookbook']] : null,
            [SectionType::Craftsmanship, 'Craftsmanship', [
                'eyebrow' => 'The Atelier', 'title' => 'Crafted with Intention',
                'body' => 'Every design is shaped by fabric, hand and fit.',
                'media_id' => $craft->id,
                'pillars' => [
                    ['title' => 'Fabrics', 'body' => 'Silks, organzas, velvets and handloom textiles chosen for drape and longevity.'],
                    ['title' => 'Embroidery', 'body' => 'Hand-finished zardozi, resham, gota and pearl work.'],
                    ['title' => 'Design Philosophy', 'body' => 'Heritage techniques interpreted with a contemporary eye.'],
                    ['title' => 'Made to Measure', 'body' => 'Many designs can be tailored to your measurements after a fitting consultation.'],
                ],
            ]],
            [SectionType::Testimonials, 'Client Testimonials', ['eyebrow' => 'Kind Words', 'title' => 'From Our Clients', 'limit' => 6]],
            [SectionType::AppointmentCta, 'Appointment', [
                'title' => 'Your Perfect Look Begins Here',
                'body' => 'Book a personal consultation, or start a conversation with our team on WhatsApp.',
                'media_id' => $appointment->id, 'consultation_label' => 'Book a Consultation', 'whatsapp_label' => 'Chat on WhatsApp',
            ]],
            [SectionType::SocialGallery, 'Social Gallery', ['eyebrow' => 'Follow the Studio', 'title' => 'On Instagram', 'items' => $social]],
            [SectionType::Newsletter, 'Newsletter', ['title' => 'The Grace Letter', 'body' => 'New collections, lookbooks and studio news — occasionally, never in excess.', 'consent_text' => 'I agree to receive emails from Grace New Designers. I can unsubscribe at any time.']],
        ];

        foreach (array_filter($sections) as [$type, $name, $config]) {
            $homepage->create($type, $name, $config);
        }
        $homepage->publish();
    }
}
