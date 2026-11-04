import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { productsApi, siteSettingsApi } from '../../api/client';
import { Phone } from 'lucide-react';

const WA_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function Home() {
  const { data: featured } = useQuery({
    queryKey: ['public-products-featured'],
    queryFn:  () => productsApi.publicList({ per_page: 8 }).then(r => r.data.data),
  });

  const { data: gallery } = useQuery({
    queryKey: ['public-products-gallery'],
    queryFn:  () => productsApi.publicList({ per_page: 12 }).then(r => r.data.data),
  });

  const { data: settingsMap = {} } = useQuery({
    queryKey: ['public-settings'],
    queryFn:  () => siteSettingsApi.publicGet().then(r => r.data ?? {}),
    staleTime: 60000,
  });

  const s = key => settingsMap[key] ?? '';

  const wa    = s('contact_whatsapp')      || '918181816202';
  const phone = s('contact_phone')         || '918181816202';
  const phoneDsp = s('contact_phone_display') || '+91 81818 16202';
  const waLink = text => `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
  const telHref = `tel:+${phone}`;

  const categories = s('categories_strip')
    ? s('categories_strip').split(',').map(x => x.trim()).filter(Boolean)
    : ['Indian Wear', 'Sherwanis', 'Western Suits', 'Wedding', 'Festive', 'Made to Measure'];

  // IntersectionObserver for scroll animations
  const pageRef = useRef(null);
  useEffect(() => {
    const els = document.querySelectorAll('.fade-in');
    if (!els.length) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [rawSettings, featured, gallery]);

  return (
    <>
      <style>{`
        .fade-in { opacity: 0; transform: translateY(24px); transition: opacity 0.65s ease, transform 0.65s ease; }
        .fade-in.visible { opacity: 1; transform: translateY(0); }
        .fade-in-delay-1 { transition-delay: 0.1s; }
        .fade-in-delay-2 { transition-delay: 0.2s; }
        .fade-in-delay-3 { transition-delay: 0.3s; }
        .scrollbar-none { scrollbar-width: none; -ms-overflow-style: none; }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .product-card-img { transition: transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94); }
        .product-card:hover .product-card-img { transform: scale(1.06); }
        .product-card { transition: box-shadow 0.3s ease; }
        .product-card:hover { box-shadow: 0 8px 32px rgba(21,101,192,0.1); }
      `}</style>

      {/* ── Hero ── */}
      <section className="relative min-h-[80vh] md:h-screen flex items-center overflow-hidden pt-16 md:pt-[73px]">
        {s('hero_image') ? (
          <img
            src={`/storage/${s('hero_image')}`}
            alt="Hero"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#F5F8FF] via-white to-[#EEF4FF]">
            <div className="absolute top-20 right-0 w-[500px] h-[500px] rounded-full bg-[#29ABE2]/8 blur-[120px]" />
            <div className="absolute bottom-0 left-1/4 w-80 h-80 rounded-full bg-[#1565C0]/6 blur-[100px]" />
          </div>
        )}
        {s('hero_image') && <div className="absolute inset-0 bg-[#0A1628]/55" />}

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center w-full">
          <div>
            <p className={`text-xs tracking-widest uppercase mb-4 font-medium ${s('hero_image') ? 'text-[#29ABE2]' : 'text-[#1565C0]'}`}>
              {s('hero_badge') || 'Designer Menswear · Made to Measure'}
            </p>
            <h1 className={`font-display text-5xl md:text-7xl font-bold leading-[1.05] mb-6 ${s('hero_image') ? 'text-white' : 'text-[#0A1628]'}`}>
              {s('hero_title') || 'Dressed for'}<br/>
              <em className={`not-italic ${s('hero_image') ? 'text-[#29ABE2]' : 'text-[#1565C0]'}`}>
                {s('hero_title_accent') || 'every occasion'}
              </em>
            </h1>
            <p className={`max-w-sm leading-relaxed mb-8 text-base ${s('hero_image') ? 'text-white/80' : 'text-[#6B82A8]'}`}>
              {s('hero_subtitle') || 'Bespoke suits, sherwanis and occasion wear — crafted to your measurements and personality.'}
            </p>
            <div className="flex gap-4 flex-wrap">
              <Link to="/collections"
                className="bg-gradient-to-r from-[#1565C0] to-[#29ABE2] text-white px-7 py-3.5 text-xs font-semibold tracking-widest uppercase hover:from-[#1976D2] hover:to-[#4FC3F7] transition-all shadow-md hover:shadow-lg">
                {s('hero_cta') || 'View Collections'}
              </Link>
              <a href={telHref}
                className={`flex items-center gap-2 border px-5 py-3.5 text-xs tracking-widest uppercase transition-colors shadow-sm
                  ${s('hero_image')
                    ? 'border-white/40 bg-white/10 text-white hover:bg-white/20'
                    : 'border-[#D4E2F4] bg-white text-[#1565C0] hover:border-[#1565C0]'}`}>
                <Phone size={13} /> {s('hero_cta_secondary') || 'Call Us'}
              </a>
            </div>
          </div>
          <div className="hidden md:flex flex-col justify-end items-end">
            <div className="text-right">
              <p className={`text-xs tracking-widest uppercase mb-2 ${s('hero_image') ? 'text-[#29ABE2]/70' : 'text-[#29ABE2]'}`}>Current Season</p>
              <p className={`font-display text-3xl font-light italic leading-tight ${s('hero_image') ? 'text-white/20' : 'text-[#0A1628]/25'}`}>
                Wedding &amp;<br/>Occasion Wear
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Category strip ── */}
      <div className="overflow-x-auto bg-white border-y border-[#D4E2F4] scrollbar-none shadow-sm">
        <div className="flex min-w-max">
          {categories.map((c, i) => (
            <Link key={c} to={`/collections`}
              className="px-6 py-4 text-xs tracking-widest uppercase text-[#6B82A8] border-r border-[#D4E2F4] hover:text-[#1565C0] hover:bg-[#F5F8FF] transition-colors whitespace-nowrap font-medium">
              {c}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Featured products ── */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-end justify-between mb-12 fade-in">
            <div>
              <p className="text-xs tracking-widest uppercase text-[#1565C0] mb-3 font-semibold">
                {s('featured_tagline') || 'Curated for him'}
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-[#0A1628] leading-tight">
                {s('featured_title') || 'The '}<em className="text-[#1565C0] not-italic">{s('featured_title') ? '' : 'Collection'}</em>
              </h2>
            </div>
            <Link to="/collections" className="text-xs tracking-widest uppercase text-[#1565C0] hover:text-[#0A1628] transition-colors font-medium">
              {s('featured_cta') || 'View all →'}
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 border border-[#D4E2F4] divide-x divide-y divide-[#D4E2F4]">
            {featured?.map((p, i) => <ProductCard key={p.id} product={p} wa={wa} index={i} />)}
            {(!featured || featured.length === 0) && [...Array(8)].map((_, i) => (
              <div key={i} className="bg-white p-4">
                <div className="aspect-[3/4] bg-[#EEF4FF] mb-3 animate-pulse" />
                <div className="h-2 bg-[#EEF4FF] w-1/2 mb-2 animate-pulse" />
                <div className="h-3 bg-[#EEF4FF] w-3/4 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Gallery ── */}
      <section id="gallery" className="py-16 md:py-24 bg-[#F5F8FF]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-end justify-between mb-12 fade-in">
            <div>
              <p className="text-xs tracking-widest uppercase text-[#1565C0] mb-3 font-semibold">
                {s('gallery_tagline') || 'Our work'}
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-[#0A1628]">
                {s('gallery_title') || 'Gallery'}
              </h2>
            </div>
            <Link to="/collections" className="text-xs tracking-widest uppercase text-[#1565C0] hover:text-[#0A1628] transition-colors font-medium">
              {s('gallery_cta') || 'Browse all →'}
            </Link>
          </div>

          <div className="columns-2 md:columns-3 lg:columns-4 gap-2 space-y-2">
            {gallery?.filter(p => p.primary_image?.path).map((p, idx) => (
              <div key={p.id} className="break-inside-avoid relative group overflow-hidden shadow-sm fade-in">
                <Link to={`/product/${p.id}`}>
                  <img
                    src={`/storage/${p.primary_image.path}`}
                    alt={p.name}
                    className={`w-full object-cover block transition-transform duration-500 group-hover:scale-105 ${
                      idx % 5 === 0 ? 'aspect-[3/4]' : idx % 5 === 2 ? 'aspect-square' : 'aspect-[3/4]'
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A1628]/65 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                    <p className="text-xs text-white font-display leading-tight">{p.name}</p>
                  </div>
                </Link>
              </div>
            ))}
            {(!gallery || gallery.filter(p => p.primary_image?.path).length === 0) && [...Array(8)].map((_, i) => (
              <div key={i} className={`break-inside-avoid bg-[#EEF4FF] animate-pulse ${i % 3 === 0 ? 'aspect-[3/4]' : 'aspect-square'}`} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Craft / Process ── */}
      <section id="craft" className="bg-white py-16 md:py-24 border-y border-[#D4E2F4]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="hidden md:block fade-in">
              {s('craft_image') ? (
                <img src={`/storage/${s('craft_image')}`} alt="Our craft"
                  className="w-full aspect-[4/5] object-cover border border-[#D4E2F4]" />
              ) : (
                <div className="aspect-[4/5] bg-gradient-to-br from-[#EEF4FF] to-[#F5F8FF] flex items-end p-8 relative overflow-hidden border border-[#D4E2F4]">
                  <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-[#29ABE2]/10 blur-[60px]" />
                  <p className="font-display text-5xl font-light italic text-[#0A1628]/12 leading-tight">
                    Made to<br/>your measure
                  </p>
                </div>
              )}
            </div>
            <div className="fade-in fade-in-delay-1">
              <p className="text-xs tracking-widest uppercase text-[#1565C0] mb-6 font-semibold">
                {s('craft_tagline') || 'Our Process'}
              </p>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-[#0A1628] mb-6 leading-tight">
                {s('craft_title') || 'Every garment made for you'}
              </h2>
              <p className="text-[#6B82A8] leading-relaxed mb-8 max-w-prose text-base">
                {s('craft_body') || "We don't sell off the rack. Every piece is custom-fitted to your body and tailored to your occasion."}
              </p>
              <div className="divide-y divide-[#D4E2F4]">
                {[
                  ['I',   'Consultation',       'We understand your occasion, style preference, fabric and timeline.'],
                  ['II',  'Measurements',       'Precise measurements taken at our studio for a fit that is entirely yours.'],
                  ['III', 'Craft',              'Skilled artisans handcraft each piece with selected fabrics and embellishments.'],
                  ['IV',  'Fitting & Delivery', 'Trial fittings ensure the garment sits perfectly before you collect it.'],
                ].map(([n, title, desc]) => (
                  <div key={n} className="py-5 flex gap-5 group">
                    <span className="font-display text-sm text-[#1565C0] min-w-[28px] pt-0.5 font-bold">{n}</span>
                    <div>
                      <p className="text-sm font-semibold text-[#0A1628] mb-1 group-hover:text-[#1565C0] transition-colors">{title}</p>
                      <p className="text-sm text-[#6B82A8]">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Shop by Occasion ── */}
      <section className="py-16 md:py-24 bg-[#F5F8FF]">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs tracking-widest uppercase text-[#1565C0] mb-3 font-semibold fade-in">Dress for the moment</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-[#0A1628] mb-10 fade-in fade-in-delay-1">
            Shop by <em className="text-[#1565C0] not-italic">Occasion</em>
          </h2>
          <div className="grid md:grid-cols-3 border border-[#D4E2F4] divide-x divide-y divide-[#D4E2F4]">
            {[
              ['W', 'Wedding & Baraat',    'Sherwanis, achkans and groom ensembles for the baraat to the reception.',  'a custom wedding outfit for the groom'],
              ['F', 'Formal & Corporate',  'Power suits and three-piece ensembles for meetings, galas and black-tie.', 'a formal suit or three-piece'],
              ['S', 'Festive & Sangeet',   'Kurta sets and Indo-western looks for mehendi, sangeet and Diwali.',       'festive Indian menswear'],
            ].map(([letter, title, desc, query]) => (
              <a key={letter} href={waLink(`Hello, I'm looking for ${query}. Please guide me.`)}
                className="bg-white p-10 flex flex-col gap-4 hover:bg-[#F5F8FF] transition-all group cursor-pointer fade-in">
                <div className="w-11 h-11 border border-[#D4E2F4] bg-[#EEF4FF] flex items-center justify-center font-display text-[#1565C0] italic text-lg font-bold group-hover:bg-[#1565C0] group-hover:text-white group-hover:border-[#1565C0] transition-all">
                  {letter}
                </div>
                <h3 className="font-display text-xl font-bold text-[#0A1628] group-hover:text-[#1565C0] transition-colors">{title}</h3>
                <p className="text-sm text-[#6B82A8] leading-relaxed">{desc}</p>
                <span className="text-xs tracking-widest uppercase text-[#1565C0] flex items-center gap-2 mt-auto font-medium group-hover:gap-3 transition-all">Enquire now →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="bg-[#0A1628] py-16 md:py-24 text-center px-6">
        <div className="max-w-2xl mx-auto fade-in">
          <p className="text-xs tracking-widest uppercase text-[#29ABE2] mb-4 font-semibold">Personal service, always</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            {s('cta_title') || 'Ready for your perfect fit?'}
          </h2>
          <p className="text-white/60 max-w-md mx-auto mb-10 text-base leading-relaxed">
            {s('cta_body') || 'Send us a message on WhatsApp or call us directly. Tell us your occasion and style — we respond within hours.'}
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <a href={waLink("Hello Grace New Designers! I'd like to discuss a custom outfit.")}
              className="inline-flex items-center gap-3 bg-[#25D366] text-black px-8 py-4 text-xs font-bold tracking-widest uppercase hover:bg-[#1dc856] transition-colors shadow-lg shadow-[#25D366]/20">
              {WA_SVG} {s('cta_wa_button') || 'Chat on WhatsApp'}
            </a>
            <a href={telHref}
              className="inline-flex items-center gap-2 border border-white/20 text-white px-8 py-4 text-xs tracking-widest uppercase hover:border-white/50 hover:bg-white/5 transition-colors font-medium">
              <Phone size={15} /> {s('cta_phone_button') || phoneDsp}
            </a>
          </div>
          <p className="text-white/30 text-xs mt-6">{s('cta_footnote') || 'Mon–Sat, 10am–7pm · Hyderabad'}</p>
        </div>
      </section>
    </>
  );
}

function ProductCard({ product, wa, index }) {
  const img    = product.primary_image?.path;
  const waText = encodeURIComponent(`Hello, I'd like to enquire about the ${product.name} (${product.variants?.[0]?.sku ?? product.id})`);
  const waHref = `https://wa.me/${wa || '918181816202'}?text=${waText}`;

  return (
    <div className="bg-white flex flex-col product-card group fade-in" style={{ transitionDelay: `${(index % 4) * 0.08}s` }}>
      <div className="aspect-[3/4] relative overflow-hidden bg-[#F5F8FF]">
        {img ? (
          <img src={`/storage/${img}`} alt={product.name}
            className="w-full h-full object-cover product-card-img" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#EEF4FF] to-[#F5F8FF]" />
        )}
        <div className="absolute inset-0 flex items-end justify-center p-4 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-[#0A1628]/55 to-transparent">
          <a href={waHref} className="w-full bg-gradient-to-r from-[#1565C0] to-[#29ABE2] text-white text-xs font-semibold tracking-widest uppercase py-3 text-center hover:from-[#1976D2] hover:to-[#4FC3F7] transition-all">
            Ask for Price
          </a>
        </div>
      </div>
      <div className="p-4 border-t border-[#D4E2F4]">
        <p className="text-xs tracking-widest uppercase text-[#1565C0] mb-1 font-medium">{product.category?.name}</p>
        <p className="font-display text-base text-[#0A1628] leading-tight font-semibold">{product.name}</p>
        {product.fabric && <p className="text-xs text-[#6B82A8] mt-1">{product.fabric}</p>}
      </div>
    </div>
  );
}
