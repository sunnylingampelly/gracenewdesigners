<?php

namespace App\Enums;

enum SectionType: string
{
    case HeroImage = 'hero_image';
    case HeroVideo = 'hero_video';
    case SplitEditorial = 'split_editorial';
    case CategoryGrid = 'category_grid';
    case CollectionFeature = 'collection_feature';
    case FeaturedProducts = 'featured_products';
    case OccasionGrid = 'occasion_grid';
    case LookbookGallery = 'lookbook_gallery';
    case TextImage = 'text_image';
    case BrandStory = 'brand_story';
    case Craftsmanship = 'craftsmanship';
    case Testimonials = 'testimonials';
    case Newsletter = 'newsletter';
    case AppointmentCta = 'appointment_cta';
    case SocialGallery = 'social_gallery';

    public function label(): string
    {
        return ucwords(str_replace('_', ' ', $this->value));
    }
}
