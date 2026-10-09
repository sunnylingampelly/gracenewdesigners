# Unsplash Image Integration

This document describes the Unsplash fallback system for men's fashion imagery in the Grace New Designers storefront.

## Overview

When backend media assets aren't available, the system automatically serves high-quality men's fashion photography from Unsplash. This provides a polished visual experience during development, demos, and when products don't have uploaded images.

## Implementation

### Core Utility

**Location:** `src/lib/unsplash-fallback.ts`

Provides functions to generate Unsplash URLs based on:
- Product categories (suits, sherwani, kurta, casual, formal, etc.)
- Image dimensions
- Consistent seeds (product IDs) for stable images
- Fashion keywords and collections

### MediaImage Component Enhancement

**Location:** `src/components/media/media-image.tsx`

The `MediaImage` component now accepts additional props:
- `categorySlug`: Product category for intelligent image selection
- `productId`: Used as seed for consistent images per product
- `aspectRatio`: Desired aspect ratio (default: 0.8 for 4:5)

When `media` is null or has no URL, the component automatically serves an Unsplash image.

## Usage Examples

### Product Cards

```tsx
<MediaImage
  media={product.image}
  sizes="(min-width: 1024px) 25vw, 50vw"
  fill
  categorySlug={product.category}
  productId={product.id}
  aspectRatio={0.8}
  alt={product.name}
/>
```

### Hero Sections

```tsx
import { getHeroImage } from '@/lib/unsplash-fallback';

const heroSrc = getHeroImage("editorial", 1920, 1080);
```

### Category-Specific Images

```tsx
import { getCategoryImage } from '@/lib/unsplash-fallback';

const imageSrc = getCategoryImage("suits", 800, 1000, productId);
```

## Unsplash Collections

The system uses curated Unsplash collections for different categories:

| Category | Collection ID | Description |
|----------|---------------|-------------|
| menswear | 1142976 | General men's fashion |
| suits | 1163637 | Formal suits |
| formal-wear | 2823080 | Formal attire |
| casual-wear | 3657445 | Casual menswear |
| accessories | 2184317 | Men's accessories |
| shoes | 136148 | Footwear |
| watches | 932387 | Watches |
| bags | 1368530 | Bags & leather goods |
| model-portrait | 2203635 | Fashion portraits |
| fashion-editorial | 1121429 | Editorial fashion |

## Category Mapping

Product categories are automatically mapped to Unsplash collections:

- **Suits/Blazers** → Suits collection
- **Formal/Tuxedo/Sherwani** → Formal wear
- **Casual/Shirts/Trousers** → Casual wear
- **Shoes/Footwear** → Shoes
- **Watches/Timepieces** → Watches
- **Bags/Wallets/Leather** → Bags
- **Accessories/Ties/Cufflinks** → Accessories
- **Default** → General menswear

## Image Consistency

Images remain consistent per product by using the product ID as a seed:

```typescript
// Same product ID always returns the same image
getCategoryImage("suits", 800, 1000, 123); // Always same image
getCategoryImage("suits", 800, 1000, 124); // Different image
```

## Fashion Keywords

Pre-defined keyword sets for search-based image fetching:

```typescript
MENS_FASHION_KEYWORDS = {
  suits: ["men's suit", "formal suit", "business suit", "tailored suit"],
  sherwani: ["indian groom", "sherwani", "indo-western", "ethnic wear"],
  kurta: ["mens kurta", "kurta pajama", "ethnic kurta", "designer kurta"],
  blazer: ["mens blazer", "sport coat", "tailored jacket"],
  // ... more categories
}
```

## Hero Image Themes

Four hero themes for different section types:

```typescript
getHeroImage("editorial", 1920, 1080);  // Fashion editorial
getHeroImage("formal", 1920, 1080);     // Formal wear
getHeroImage("casual", 1920, 1080);     // Casual lifestyle
getHeroImage("lifestyle", 1920, 1080);  // Model portraits
```

## Responsive Images

Generate responsive srcsets for different screen sizes:

```typescript
const { src, srcSet, sizes } = getUnsplashSrcSet("menswear", 0.8, productId);
// Returns images at: 400w, 600w, 800w, 1200w, 1600w, 2000w
```

## Configuration

### Next.js Config

Unsplash domains are allowed in `next.config.ts`:

```typescript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'source.unsplash.com',
    },
    {
      protocol: 'https',
      hostname: 'images.unsplash.com',
    },
  ],
}
```

## Demo Component

**Location:** `src/components/store/unsplash-demo.tsx`

A demonstration component showing:
- Hero banners with different themes
- Product grid with category-specific images
- Available keywords reference

## Aspect Ratios

Common aspect ratios used:

| Ratio | Value | Use Case |
|-------|-------|----------|
| 4:5 | 0.8 | Product cards (portrait) |
| 16:9 | 1.78 | Hero banners (landscape) |
| 3:4 | 0.75 | Collection tiles |
| 1:1 | 1.0 | Square thumbnails |

## Best Practices

1. **Always pass category**: More accurate image selection
   ```tsx
   <MediaImage media={null} categorySlug="suits" productId={1} />
   ```

2. **Use product ID as seed**: Ensures consistent images
   ```tsx
   getCategoryImage("formal", 800, 1000, product.id)
   ```

3. **Match aspect ratios**: Request images at the display aspect ratio
   ```tsx
   <MediaImage aspectRatio={0.8} /> // For 4:5 containers
   ```

4. **Provide meaningful alt text**: Even for fallback images
   ```tsx
   <MediaImage media={null} alt="Men's formal suit" />
   ```

## Performance Considerations

1. **Caching**: Unsplash images are cached by browsers and CDNs
2. **Consistent URLs**: Same parameters = same URL = better caching
3. **Lazy Loading**: Images below fold are lazy-loaded automatically
4. **Appropriate Sizes**: Request only needed dimensions

## Unsplash API Guidelines

When using Unsplash images:

1. **Source**: We use Unsplash Source (source.unsplash.com)
2. **Attribution**: Not required for Unsplash Source
3. **Rate Limits**: Generally unlimited for source.unsplash.com
4. **Production**: Consider using Unsplash API with attribution for production

## Future Enhancements

Potential improvements:

- [ ] Cache Unsplash URLs in database for consistency
- [ ] Download and host popular images locally
- [ ] Implement Unsplash API for better control
- [ ] Add image quality parameter
- [ ] Support for video fallbacks
- [ ] Seasonal/trend-based image selection

## Troubleshooting

### Images not loading

1. Check network tab for Unsplash domain blocks
2. Verify `next.config.ts` remote patterns
3. Check for ad blockers blocking Unsplash

### Images changing on reload

- Ensure product ID is passed as seed
- Verify seed parameter is consistent

### Wrong category images

- Check category slug mapping in `getCategoryImage`
- Verify category names match mapping logic

## Testing

Test the integration:

```bash
# 1. Start dev server
npm run dev

# 2. Navigate to any product listing page
# 3. Products without backend images will show Unsplash photos

# 4. Test demo component (create route if needed)
# Visit: /unsplash-demo
```

## Related Files

- `src/lib/unsplash-fallback.ts` - Core utility functions
- `src/components/media/media-image.tsx` - Enhanced MediaImage component  
- `src/components/store/product-card.tsx` - Product card with Unsplash support
- `src/components/store/unsplash-demo.tsx` - Demo component
- `next.config.ts` - Remote image configuration
- `UNSPLASH_INTEGRATION.md` - This documentation
