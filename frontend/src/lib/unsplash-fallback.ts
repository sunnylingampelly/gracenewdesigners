/**
 * Unsplash fallback utility for development and placeholder images.
 * Provides high-quality fashion imagery when backend media isn't available.
 */

type UnsplashCategory = 
  | "menswear" 
  | "suits" 
  | "formal-wear" 
  | "casual-wear" 
  | "accessories"
  | "shoes"
  | "watches"
  | "bags"
  | "model-portrait"
  | "fashion-editorial";

const UNSPLASH_COLLECTIONS = {
  menswear: "1142976", // Men's fashion collection
  suits: "1163637", // Formal suits
  "formal-wear": "2823080", // Formal attire
  "casual-wear": "3657445", // Casual menswear
  accessories: "2184317", // Men's accessories
  shoes: "136148", // Footwear
  watches: "932387", // Watches
  bags: "1368530", // Bags & leather goods
  "model-portrait": "2203635", // Fashion portraits
  "fashion-editorial": "1121429", // Editorial fashion
};

/**
 * Generate Unsplash URL with specific parameters for optimal image quality
 */
export function getUnsplashImage(
  category: UnsplashCategory = "menswear",
  width: number = 800,
  height: number = 1000,
  seed?: string | number
): string {
  const collectionId = UNSPLASH_COLLECTIONS[category];
  const baseUrl = "https://source.unsplash.com";
  
  // Use seed for consistent images
  const seedParam = seed ? `?${encodeURIComponent(seed)}` : "";
  
  return `${baseUrl}/collection/${collectionId}/${width}x${height}${seedParam}`;
}

/**
 * Generate Unsplash URL by keyword search
 */
export function getUnsplashByKeyword(
  keywords: string[],
  width: number = 800,
  height: number = 1000
): string {
  const query = keywords.join(",");
  return `https://source.unsplash.com/featured/${width}x${height}/?${encodeURIComponent(query)}`;
}

/**
 * Get category-specific Unsplash image based on product category
 */
export function getCategoryImage(
  categorySlug: string | null | undefined,
  width: number = 800,
  height: number = 1000,
  productId?: number
): string {
  if (!categorySlug) {
    return getUnsplashImage("menswear", width, height, productId);
  }

  const slug = categorySlug.toLowerCase();
  
  // Map category slugs to Unsplash categories
  if (slug.includes("suit") || slug.includes("blazer")) {
    return getUnsplashImage("suits", width, height, productId);
  }
  if (slug.includes("formal") || slug.includes("tuxedo") || slug.includes("sherwani")) {
    return getUnsplashImage("formal-wear", width, height, productId);
  }
  if (slug.includes("casual") || slug.includes("shirt") || slug.includes("trouser")) {
    return getUnsplashImage("casual-wear", width, height, productId);
  }
  if (slug.includes("shoe") || slug.includes("footwear")) {
    return getUnsplashImage("shoes", width, height, productId);
  }
  if (slug.includes("watch") || slug.includes("timepiece")) {
    return getUnsplashImage("watches", width, height, productId);
  }
  if (slug.includes("bag") || slug.includes("leather") || slug.includes("wallet")) {
    return getUnsplashImage("bags", width, height, productId);
  }
  if (slug.includes("accessory") || slug.includes("tie") || slug.includes("cufflink")) {
    return getUnsplashImage("accessories", width, height, productId);
  }
  
  // Default to general menswear
  return getUnsplashImage("menswear", width, height, productId);
}

/**
 * Generate responsive Unsplash srcset for different screen sizes
 */
export function getUnsplashSrcSet(
  category: UnsplashCategory = "menswear",
  aspectRatio: number = 0.8, // width/height (e.g., 0.8 = 4:5)
  seed?: string | number
): { src: string; srcSet: string; sizes: string } {
  const widths = [400, 600, 800, 1200, 1600, 2000];
  const srcSetArray = widths.map(w => {
    const h = Math.round(w / aspectRatio);
    return `${getUnsplashImage(category, w, h, seed)} ${w}w`;
  });

  return {
    src: getUnsplashImage(category, 800, Math.round(800 / aspectRatio), seed),
    srcSet: srcSetArray.join(", "),
    sizes: "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw",
  };
}

/**
 * Men's fashion keywords for various product types
 */
export const MENS_FASHION_KEYWORDS = {
  suits: ["men's suit", "formal suit", "business suit", "tailored suit"],
  sherwani: ["indian groom", "sherwani", "indo-western", "ethnic wear"],
  kurta: ["mens kurta", "kurta pajama", "ethnic kurta", "designer kurta"],
  blazer: ["mens blazer", "sport coat", "tailored jacket"],
  shirt: ["mens shirt", "formal shirt", "dress shirt", "business shirt"],
  trouser: ["mens trousers", "formal pants", "dress pants"],
  casual: ["mens casual", "casual outfit", "street style men"],
  accessories: ["mens accessories", "tie", "pocket square", "cufflinks"],
  shoes: ["mens shoes", "dress shoes", "formal footwear", "leather shoes"],
  watches: ["luxury watch", "mens watch", "timepiece"],
  bags: ["leather bag", "mens bag", "briefcase", "messenger bag"],
  wedding: ["groom", "wedding suit", "formal wedding", "marriage ceremony"],
};

/**
 * Get hero/banner image for sections
 */
export function getHeroImage(
  theme: "formal" | "casual" | "editorial" | "lifestyle" = "editorial",
  width: number = 1920,
  height: number = 1080
): string {
  const categories: Record<typeof theme, UnsplashCategory> = {
    formal: "formal-wear",
    casual: "casual-wear",
    editorial: "fashion-editorial",
    lifestyle: "model-portrait",
  };
  
  return getUnsplashImage(categories[theme], width, height);
}
