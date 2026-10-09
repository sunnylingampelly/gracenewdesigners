/**
 * Demo component showing Unsplash integration for men's fashion imagery.
 * This demonstrates how images will appear when backend media isn't available.
 */

import { MediaImage } from "@/components/media/media-image";
import { getCategoryImage, getHeroImage, MENS_FASHION_KEYWORDS } from "@/lib/unsplash-fallback";

export function UnsplashDemo() {
  const categories = [
    { slug: "suits", name: "Suits", id: 1 },
    { slug: "sherwani", name: "Sherwani", id: 2 },
    { slug: "kurta", name: "Kurta Sets", id: 3 },
    { slug: "formal-shirts", name: "Formal Shirts", id: 4 },
    { slug: "blazers", name: "Blazers", id: 5 },
    { slug: "casual-wear", name: "Casual Wear", id: 6 },
    { slug: "accessories", name: "Accessories", id: 7 },
    { slug: "footwear", name: "Footwear", id: 8 },
  ];

  return (
    <div className="container-editorial py-12">
      <div className="mb-12 text-center">
        <h1 className="display text-display mb-4">Men's Fashion Collection</h1>
        <p className="text-muted">High-quality imagery powered by Unsplash</p>
      </div>

      {/* Hero Section */}
      <section className="mb-16">
        <h2 className="display text-display-sm mb-6">Hero Banners</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="relative aspect-[16/9] overflow-hidden rounded-lg">
            <img 
              src={getHeroImage("editorial", 1200, 675)} 
              alt="Editorial fashion"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-midnight/70 to-transparent" />
            <div className="absolute bottom-6 left-6 text-ivory">
              <p className="eyebrow mb-2">Editorial</p>
              <h3 className="display text-2xl">Fashion Forward</h3>
            </div>
          </div>
          <div className="relative aspect-[16/9] overflow-hidden rounded-lg">
            <img 
              src={getHeroImage("formal", 1200, 675)} 
              alt="Formal wear"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-midnight/70 to-transparent" />
            <div className="absolute bottom-6 left-6 text-ivory">
              <p className="eyebrow mb-2">Formal</p>
              <h3 className="display text-2xl">Tailored Perfection</h3>
            </div>
          </div>
        </div>
      </section>

      {/* Product Grid */}
      <section>
        <h2 className="display text-display-sm mb-6">Product Categories</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6">
          {categories.map((category) => (
            <div key={category.id} className="group">
              <div className="relative aspect-[4/5] overflow-hidden bg-ice">
                <MediaImage
                  media={null}
                  sizes="(min-width: 1024px) 25vw, (min-width: 768px) 25vw, 50vw"
                  fill
                  categorySlug={category.slug}
                  productId={category.id}
                  aspectRatio={0.8}
                  alt={category.name}
                  className="transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="mt-3">
                <p className="eyebrow text-muted">{category.slug}</p>
                <h3 className="display text-xl">{category.name}</h3>
                <p className="mt-1 text-sm text-muted">From ₹2,999</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Keywords Reference */}
      <section className="mt-16 rounded-lg bg-ice p-8">
        <h2 className="display text-display-sm mb-4">Available Keywords</h2>
        <p className="mb-6 text-muted">Images are categorized using these fashion keywords:</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(MENS_FASHION_KEYWORDS).map(([key, keywords]) => (
            <div key={key} className="rounded border border-line bg-ivory p-4">
              <p className="eyebrow mb-2 text-royal">{key}</p>
              <ul className="space-y-1 text-sm text-muted">
                {keywords.slice(0, 3).map((kw, i) => (
                  <li key={i}>• {kw}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
