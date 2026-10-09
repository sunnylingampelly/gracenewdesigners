<?php

namespace App\Services\Content;

use App\Enums\SectionType;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Typed configuration schema for each homepage section type. Configs are validated server-side
 * and stored as JSON; arbitrary HTML is never accepted — all copy is plain text.
 */
class SectionSchema
{
    private const LINK = ['nullable', 'string', 'max:300', 'regex:/^(\/[^\s]*|https:\/\/[^\s]+)$/'];

    private const MEDIA = ['nullable', 'integer', 'exists:media_assets,id'];

    public static function rules(SectionType $type): array
    {
        $cta = ['cta_label' => ['nullable', 'string', 'max:60'], 'cta_url' => self::LINK];
        $heading = [
            'eyebrow' => ['nullable', 'string', 'max:80'],
            'title' => ['nullable', 'string', 'max:140'],
            'subtitle' => ['nullable', 'string', 'max:300'],
        ];
        $imagePosition = ['image_position' => ['nullable', Rule::in(['left', 'right'])]];

        return match ($type) {
            SectionType::HeroImage, SectionType::HeroVideo => [
                'eyebrow' => ['nullable', 'string', 'max:80'],
                'headline' => ['required', 'string', 'max:120'],
                'subtitle' => ['nullable', 'string', 'max:300'],
                ...$cta,
                'desktop_media_id' => $type === SectionType::HeroImage ? ['required', ...array_slice(self::MEDIA, 1)] : self::MEDIA,
                'mobile_media_id' => self::MEDIA,
                'video_media_id' => $type === SectionType::HeroVideo ? ['required', ...array_slice(self::MEDIA, 1)] : ['prohibited'],
                'align' => ['nullable', Rule::in(['left', 'center', 'right'])],
                'overlay_opacity' => ['nullable', 'numeric', 'min:0', 'max:0.8'],
                'height' => ['nullable', Rule::in(['full', 'large', 'medium'])],
            ],
            SectionType::SplitEditorial, SectionType::TextImage, SectionType::BrandStory => [
                ...$heading,
                'body' => ['nullable', 'string', 'max:3000'],
                'media_id' => self::MEDIA,
                ...$imagePosition,
                ...$cta,
                'theme' => ['nullable', Rule::in(['ivory', 'white', 'navy', 'ice'])],
            ],
            SectionType::CategoryGrid => [
                ...$heading,
                'items' => ['required', 'array', 'min:1', 'max:8'],
                'items.*.category_id' => ['required', 'integer', 'exists:categories,id'],
                'items.*.label' => ['nullable', 'string', 'max:60'],
                'items.*.media_id' => self::MEDIA,
                'layout' => ['nullable', Rule::in(['grid', 'carousel'])],
            ],
            SectionType::CollectionFeature => [
                'collection_id' => ['required', 'integer', 'exists:collections,id'],
                ...$heading,
                'body' => ['nullable', 'string', 'max:2000'],
                'media_id' => self::MEDIA,
                ...$imagePosition,
                ...$cta,
                'theme' => ['nullable', Rule::in(['ivory', 'white', 'navy', 'ice'])],
            ],
            SectionType::FeaturedProducts => [
                ...$heading,
                'source' => ['required', Rule::in(['new_arrivals', 'bestsellers', 'featured', 'collection', 'manual'])],
                'collection_id' => ['required_if:source,collection', 'nullable', 'integer', 'exists:collections,id'],
                'product_ids' => ['required_if:source,manual', 'array', 'max:24'],
                'product_ids.*' => ['integer', 'exists:products,id'],
                'limit' => ['nullable', 'integer', 'min:2', 'max:16'],
                'layout' => ['nullable', Rule::in(['grid', 'carousel'])],
                ...$cta,
            ],
            SectionType::OccasionGrid => [
                ...$heading,
                'occasion_ids' => ['nullable', 'array', 'max:12'],
                'occasion_ids.*' => ['integer', 'exists:occasions,id'],
            ],
            SectionType::LookbookGallery => [
                ...$heading,
                'lookbook_id' => ['nullable', 'integer', 'exists:lookbooks,id'],
                'items' => ['nullable', 'array', 'max:12'],
                'items.*.media_id' => ['required', 'integer', 'exists:media_assets,id'],
                'items.*.caption' => ['nullable', 'string', 'max:120'],
                'items.*.link_url' => self::LINK,
                ...$cta,
            ],
            SectionType::Craftsmanship => [
                ...$heading,
                'body' => ['nullable', 'string', 'max:2000'],
                'media_id' => self::MEDIA,
                'pillars' => ['nullable', 'array', 'max:4'],
                'pillars.*.title' => ['required', 'string', 'max:80'],
                'pillars.*.body' => ['nullable', 'string', 'max:500'],
                'pillars.*.media_id' => self::MEDIA,
                ...$cta,
            ],
            SectionType::Testimonials => [
                ...$heading,
                'limit' => ['nullable', 'integer', 'min:1', 'max:12'],
            ],
            SectionType::Newsletter => [
                ...$heading,
                'body' => ['nullable', 'string', 'max:500'],
                'consent_text' => ['nullable', 'string', 'max:300'],
            ],
            SectionType::AppointmentCta => [
                ...$heading,
                'body' => ['nullable', 'string', 'max:1000'],
                'media_id' => self::MEDIA,
                'consultation_label' => ['nullable', 'string', 'max:60'],
                'whatsapp_label' => ['nullable', 'string', 'max:60'],
            ],
            SectionType::SocialGallery => [
                ...$heading,
                'handle' => ['nullable', 'string', 'max:60'],
                'profile_url' => ['nullable', 'url', 'max:300'],
                'items' => ['nullable', 'array', 'max:12'],
                'items.*.media_id' => ['required', 'integer', 'exists:media_assets,id'],
                'items.*.link_url' => ['nullable', 'url', 'max:300'],
                'items.*.alt' => ['nullable', 'string', 'max:200'],
            ],
        };
    }

    /**
     * Validate and return only known keys for the section type.
     *
     * @throws ValidationException
     */
    public static function validate(SectionType $type, array $config): array
    {
        $rules = self::rules($type);
        $validated = Validator::make($config, $rules)->validate();

        // Strip any HTML that slipped into plain-text fields.
        array_walk_recursive($validated, function (&$value, $key) {
            if (is_string($value) && ! str_ends_with((string) $key, 'url')) {
                $value = trim(strip_tags($value));
            }
        });

        return $validated;
    }

    /** Sensible starting config for a newly added section. */
    public static function defaults(SectionType $type): array
    {
        return match ($type) {
            SectionType::HeroImage, SectionType::HeroVideo => [
                'headline' => 'Elegance, Reimagined.',
                'subtitle' => 'Discover thoughtfully crafted fashion for your most memorable moments.',
                'cta_label' => 'Explore the Collection',
                'cta_url' => '/collections',
                'align' => 'center', 'overlay_opacity' => 0.35, 'height' => 'full',
            ],
            SectionType::FeaturedProducts => ['title' => 'New Arrivals', 'source' => 'new_arrivals', 'limit' => 8, 'layout' => 'carousel'],
            SectionType::Testimonials => ['title' => 'Kind Words', 'limit' => 6],
            SectionType::AppointmentCta => [
                'title' => 'Your Perfect Look Begins Here',
                'consultation_label' => 'Book a Consultation',
                'whatsapp_label' => 'Chat on WhatsApp',
            ],
            SectionType::Newsletter => ['title' => 'The Grace Letter'],
            default => [],
        };
    }
}
