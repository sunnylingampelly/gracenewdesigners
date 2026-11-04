import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { productsApi, categoriesApi, siteSettingsApi } from '../../api/client';
import { Phone } from 'lucide-react';

const WA_SVG = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function Collections() {
  const [params, setParams]     = useSearchParams();
  const [search, setSearch]     = useState(params.get('q') || '');
  const [category, setCategory] = useState(params.get('category') || '');
  const [page, setPage]         = useState(1);

  const { data: settingsMap = {} } = useQuery({
    queryKey: ['public-settings'],
    queryFn:  () => siteSettingsApi.publicGet().then(r => r.data ?? {}),
    staleTime: 60000,
  });

  const s = key => settingsMap[key] ?? '';

  const wa    = s('contact_whatsapp')      || '918181816202';
  const phone = s('contact_phone')         || '918181816202';
  const phoneDsp = s('contact_phone_display') || '+91 81818 16202';
  const telHref = `tel:+${phone}`;
  const waHref  = `https://wa.me/${wa}?text=${encodeURIComponent("Hello, I'm looking for something specific. Can you help?")}`;

  const { data: categories } = useQuery({
    queryKey: ['public-categories'],
    queryFn:  () => categoriesApi.list().then(r => r.data),
  });

  const filters = { per_page: 12, page, search: search || undefined, category_id: category || undefined };

  const { data, isLoading } = useQuery({
    queryKey: ['public-products', filters],
    queryFn:  () => productsApi.publicList(filters).then(r => r.data),
  });

  useEffect(() => {
    const p = {};
    if (search)   p.q        = search;
    if (category) p.category = category;
    setParams(p, { replace: true });
  }, [search, category]);

  const pageTitle    = s('collections_title')    || 'Our Catalogue';
  const pageBadge    = s('collections_badge')    || 'Handcrafted · Made to Measure';
  const pageSubtitle = s('collections_subtitle') || 'Every piece crafted for your occasion and personality.';
  const ctaTitle     = s('collections_cta_title')|| "Can't find what you're looking for?";
  const ctaBody      = s('collections_cta_body') || 'Tell us your occasion. We\'ll put together options just for you.';
  const bannerImg    = s('collections_banner');

  return (
    <div className="min-h-screen bg-white">
      {/* Page header */}
      <div className="relative pt-24 md:pt-32 pb-12 overflow-hidden">
        {bannerImg ? (
          <>
            <img src={`/storage/${bannerImg}`} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-[#0A1628]/55" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#F5F8FF] to-white" />
        )}
        <div className="relative z-10 max-w-6xl mx-auto px-6">
          <p className={`text-xs tracking-widest uppercase mb-3 font-semibold ${bannerImg ? 'text-[#29ABE2]' : 'text-[#1565C0]'}`}>
            {pageBadge}
          </p>
          <h1 className={`font-display text-5xl md:text-6xl font-bold leading-tight mb-4 ${bannerImg ? 'text-white' : 'text-[#0A1628]'}`}>
            {pageTitle}
          </h1>
          {pageSubtitle && (
            <p className={`text-base max-w-lg leading-relaxed ${bannerImg ? 'text-white/70' : 'text-[#6B82A8]'}`}>
              {pageSubtitle}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-[64px] z-20 bg-white/95 backdrop-blur border-b border-[#D4E2F4] py-4 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 flex gap-3 flex-wrap items-center">
          <input
            type="search"
            placeholder="Search pieces…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="bg-[#F5F8FF] border border-[#D4E2F4] text-[#0A1628] placeholder-[#9BB0CC] px-4 py-2 text-sm focus:outline-none focus:border-[#1565C0] w-52 transition-colors"
          />
          <select
            value={category}
            onChange={e => { setCategory(e.target.value); setPage(1); }}
            className="bg-[#F5F8FF] border border-[#D4E2F4] text-[#0A1628] px-4 py-2 text-sm focus:outline-none focus:border-[#1565C0] transition-colors"
          >
            <option value="">All Categories</option>
            {categories?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {(search || category) && (
            <button onClick={() => { setSearch(''); setCategory(''); setPage(1); }}
              className="text-xs tracking-widest uppercase text-[#6B82A8] hover:text-[#1565C0] transition-colors font-medium">
              Clear ×
            </button>
          )}
          <span className="ml-auto text-xs text-[#6B82A8] font-medium">{data?.total ?? '—'} pieces</span>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 border border-[#D4E2F4] divide-x divide-y divide-[#D4E2F4]">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white p-4 animate-pulse">
                <div className="aspect-[3/4] bg-[#EEF4FF] mb-3" />
                <div className="h-2 bg-[#EEF4FF] w-1/2 mb-2" />
                <div className="h-3 bg-[#EEF4FF] w-3/4" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && data?.data?.length === 0 && (
          <div className="py-24 text-center">
            <p className="font-display text-2xl font-light text-[#6B82A8] mb-4">No pieces found</p>
            <p className="text-sm text-[#6B82A8]">Try a different search or browse all categories.</p>
          </div>
        )}

        {!isLoading && data?.data?.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 border border-[#D4E2F4] divide-x divide-y divide-[#D4E2F4]">
            {data.data.map(p => <ProductCard key={p.id} product={p} wa={wa} />)}
          </div>
        )}

        {/* Pagination */}
        {data && data.last_page > 1 && (
          <div className="flex justify-center gap-2 mt-10">
            {[...Array(data.last_page)].map((_, i) => (
              <button key={i} onClick={() => setPage(i + 1)}
                className={`w-8 h-8 text-xs border transition-colors font-medium ${
                  page === i + 1
                    ? 'border-[#1565C0] text-[#1565C0] bg-[#EEF4FF]'
                    : 'border-[#D4E2F4] text-[#6B82A8] hover:border-[#1565C0] hover:text-[#1565C0]'
                }`}>
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="bg-[#F5F8FF] border-t border-[#D4E2F4] py-16 md:py-20 text-center px-6">
        <div className="max-w-lg mx-auto">
          <p className="text-xs tracking-widest uppercase text-[#1565C0] mb-3 font-semibold">Need help choosing?</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-[#0A1628] mb-3 leading-tight">{ctaTitle}</h2>
          <p className="text-sm text-[#6B82A8] mb-8 leading-relaxed">{ctaBody}</p>
          <div className="flex justify-center gap-4 flex-wrap">
            <a href={waHref} target="_blank" rel="noopener"
              className="inline-flex items-center gap-2 bg-[#25D366] text-black px-7 py-3.5 text-xs font-bold tracking-widest uppercase hover:bg-[#1dc856] transition-colors shadow-md">
              {WA_SVG} Chat on WhatsApp
            </a>
            <a href={telHref}
              className="inline-flex items-center gap-2 border border-[#D4E2F4] bg-white text-[#1565C0] px-7 py-3.5 text-xs font-medium tracking-widest uppercase hover:border-[#1565C0] transition-colors shadow-sm">
              <Phone size={13} /> {phoneDsp}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product, wa }) {
  const img    = product.primary_image?.path;
  const waText = encodeURIComponent(`Hello, I'd like to enquire about ${product.name} (Ref: ${product.variants?.[0]?.sku ?? product.id})`);

  return (
    <div className="bg-white flex flex-col group transition-shadow hover:shadow-lg hover:shadow-[#1565C0]/8">
      <Link to={`/product/${product.id}`} className="block">
        <div className="aspect-[3/4] relative overflow-hidden bg-[#F5F8FF]">
          {img ? (
            <img src={`/storage/${img}`} alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#EEF4FF] to-[#F5F8FF]" />
          )}
        </div>
      </Link>
      <div className="p-4 border-t border-[#D4E2F4] flex flex-col flex-1">
        <p className="text-xs tracking-widest uppercase text-[#1565C0] mb-1 font-medium">{product.category?.name}</p>
        <Link to={`/product/${product.id}`}>
          <p className="font-display text-base text-[#0A1628] leading-tight hover:text-[#1565C0] transition-colors font-semibold">{product.name}</p>
        </Link>
        {product.fabric && <p className="text-xs text-[#6B82A8] mt-1">{product.fabric}</p>}
        <a href={`https://wa.me/${wa || '918181816202'}?text=${waText}`}
          className="mt-auto pt-3 text-xs tracking-widest uppercase text-[#1565C0] hover:text-[#0A1628] transition-colors flex items-center gap-2 font-medium group-hover:gap-3">
          Ask for Price →
        </a>
      </div>
    </div>
  );
}
