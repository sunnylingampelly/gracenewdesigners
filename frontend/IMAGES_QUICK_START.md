# Images Quick Start Guide

## ✅ Images Are Now Working!

All images in your application will now display automatically using high-quality Unsplash photography when backend images aren't available.

## How to Use

### 1. No Changes Needed for Existing Code

All existing product cards, listings, and galleries will automatically show Unsplash images:

```tsx
// This now works even when product.image is null!
<MediaImage 
  media={product.image}
  sizes="(min-width: 1024px) 25vw, 50vw"
  fill
/>
```

### 2. For Better Category Matching (Recommended)

Pass the category slug for more relevant images:

```tsx
<MediaImage 
  media={product.image}
  categorySlug={product.category} // "suits", "sherwani", "casual", etc.
  productId={product.id}           // Keeps same image per product
  sizes="(min-width: 1024px) 25vw, 50vw"
  fill
/>
```

### 3. For Hero/Banner Images

```tsx
import { getHeroImage } from '@/lib/unsplash-fallback';

<img 
  src={getHeroImage("editorial", 1920, 1080)} 
  alt="Fashion editorial"
/>
```

## Image Categories

Your images automatically match these categories:

| Product Type | Shows |
|-------------|-------|
| Suits, Blazers | Formal suits & tailored jackets |
| Sherwani, Formal Wear | Indian formal & ethnic wear |
| Casual, Shirts | Casual menswear & street style |
| Kurta, Ethnic | Traditional Indian menswear |
| Shoes, Footwear | Formal & casual footwear |
| Watches | Luxury watches & timepieces |
| Bags, Wallets | Leather goods & accessories |
| Accessories | Ties, cufflinks, etc. |

## Test It Now

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Navigate to any page with products:
   - `/shop`
   - `/collections/any-collection`
   - `/products/any-product`

3. You should see beautiful men's fashion images! 🎉

## Customization

### Change Image for a Specific Category

Edit `src/lib/unsplash-fallback.ts` → `getCategoryImage()` function

### Use Different Collections

Edit collection IDs in `UNSPLASH_COLLECTIONS` constant

### Add New Categories

Add mappings in `getCategoryImage()` function

## Need Help?

- **Full Documentation**: See `UNSPLASH_INTEGRATION.md`
- **Implementation Details**: See `IMAGE_INTEGRATION_SUMMARY.md`
- **Demo Component**: Check `src/components/store/unsplash-demo.tsx`

## Status

✅ **READY TO USE** - All images will display automatically!

No additional configuration needed. Just run your application and images will appear.
