import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { productsApi, categoriesApi } from '../../api/client';
import { Phone } from 'lucide-react';

const WA_NUM      = import.meta.env.VITE_WA_NUMBER     || '918181816202';
const TEL         = import.meta.env.VITE_PHONE         || '918181816202';
const TEL_DISPLAY = import.meta.env.VITE_PHONE_DISPLAY || '+91 81818 16202';

export default function Collections() {
  const [params, setParams]     = useSearchParams();
  const [search, setSearch]     = useState(params.get('q') || '');
  const [category, setCategory] = useState(params.get('category') || '');
  const [page, setPage]         = useState(1);

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

  return (
    <div className="min-h-screen bg-white">
      {/* Page header */}
      <div className="pt-32 pb-12 px-6 max-w-6xl mx-auto bg-gradient-to-b from-[#F5F8FF] to-white">
        <p className="text-xs tracking-widest uppercase text-[#1565C0] mb-3 font-medium">All pieces</p>
        <h1 className="font-display text-5xl font-light text-[#0A1628]">The <em className="text-[#1565C0]">Collections</em></h1>
      </div>

      {/* Filters */}
      <div className="sticky top-[64px] z-20 bg-white/95 backdrop-blur border-b border-[#D4E2F4] py-4 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 flex gap-4 flex-wrap items-center">
          <input
            type="search"
            placeholder="Search pieces…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="bg-[#F5F8FF] border border-[#D4E2F4] text-[#0A1628] placeholder-[#9BB0CC] px-4 py-2 text-sm focus:outline-none focus:border-[#1565C0] w-56"
          />
          <select
            value={category}
            onChange={e => { setCategory(e.target.value); setPage(1); }}
            className="bg-[#F5F8FF] border border-[#D4E2F4] text-[#0A1628] px-4 py-2 text-sm focus:outline-none focus:border-[#1565C0]"
          >
            <option value="">All Categories</option>
            {categories?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {(search || category) && (
            <button onClick={() => { setSearch(''); setCategory(''); setPage(1); }}
              className="text-xs tracking-widest uppercase text-[#6B82A8] hover:text-[#0A1628] transition-colors">
              Clear ×
            </button>
          )}
          <span className="ml-auto text-xs text-[#6B82A8]">{data?.total ?? '—'} pieces</span>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#D4E2F4]">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white p-4 animate-pulse">
                <div className="aspect-[3/4] bg-[#EEF4FF] mb-3" />
                <div className="h-3 bg-[#EEF4FF] w-2/3 mb-2" />
                <div className="h-3 bg-[#EEF4FF] w-1/2" />
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
            {data.data.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}

        {/* Pagination */}
        {data && data.last_page > 1 && (
          <div className="flex justify-center gap-2 mt-10">
            {[...Array(data.last_page)].map((_, i) => (
              <button key={i} onClick={() => setPage(i + 1)}
                className={`w-8 h-8 text-xs border transition-colors ${
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
      <div className="bg-[#F5F8FF] border-t border-[#D4E2F4] py-14 text-center px-6">
        <p className="font-display text-2xl font-light text-[#0A1628] mb-2">Can't find what you're looking for?</p>
        <p className="text-sm text-[#6B82A8] mb-6">Tell us your occasion. We'll put together options just for you.</p>
        <div className="flex justify-center gap-4 flex-wrap">
          <a href={`https://wa.me/${WA_NUM}?text=${encodeURIComponent("Hello, I'm looking for something specific. Can you help?")}`}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#1565C0] to-[#29ABE2] text-white px-7 py-3 text-xs font-medium tracking-widest uppercase hover:from-[#1976D2] hover:to-[#4FC3F7] transition-all shadow-md">
            Enquire on WhatsApp →
          </a>
          <a href={`tel:+${TEL}`}
            className="inline-flex items-center gap-2 border border-[#D4E2F4] bg-white text-[#1565C0] px-7 py-3 text-xs tracking-widest uppercase hover:border-[#1565C0] transition-colors shadow-sm">
            <Phone size={13} /> {TEL_DISPLAY}
          </a>
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product }) {
  const img    = product.primary_image?.path;
  const waText = encodeURIComponent(`Hello, I'd like to enquire about ${product.name} (Ref: ${product.variants?.[0]?.sku ?? product.id})`);

  return (
    <div className="bg-white flex flex-col group">
      <Link to={`/product/${product.id}`} className="block">
        <div className="aspect-[3/4] relative overflow-hidden bg-[#F5F8FF]">
          {img ? (
            <img src={`/storage/${img}`} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#EEF4FF] to-[#F5F8FF]" />
          )}
        </div>
      </Link>
      <div className="p-4 border-t border-[#D4E2F4] flex flex-col flex-1">
        <p className="text-xs tracking-widest uppercase text-[#1565C0] mb-1">{product.category?.name}</p>
        <Link to={`/product/${product.id}`}>
          <p className="font-display text-base text-[#0A1628] leading-tight hover:text-[#1565C0] transition-colors">{product.name}</p>
        </Link>
        {product.fabric && <p className="text-xs text-[#6B82A8] mt-1">{product.fabric}</p>}
        <a href={`https://wa.me/${WA_NUM}?text=${waText}`}
          className="mt-auto pt-3 text-xs tracking-widest uppercase text-[#1565C0] hover:text-[#0A1628] transition-colors flex items-center gap-2">
          Ask for Price →
        </a>
      </div>
    </div>
  );
}
