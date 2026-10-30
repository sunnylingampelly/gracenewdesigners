import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../../api/client';
import { ChevronLeft, Phone } from 'lucide-react';

const WA_NUM      = import.meta.env.VITE_WA_NUMBER     || '918181816202';
const TEL         = import.meta.env.VITE_PHONE         || '918181816202';
const TEL_DISPLAY = import.meta.env.VITE_PHONE_DISPLAY || '+91 81818 16202';

const WA_SVG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

export default function ProductDetail() {
  const { id } = useParams();
  const [activeImg, setActiveImg] = useState(0);

  const { data: product, isLoading } = useQuery({
    queryKey: ['public-product', id],
    queryFn:  () => productsApi.publicShow(id).then(r => r.data),
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-2 border-[#1565C0] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!product) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white">
      <p className="font-display text-2xl text-[#6B82A8]">Product not found</p>
      <Link to="/collections" className="text-xs tracking-widest uppercase text-[#1565C0]">← Back to Collections</Link>
    </div>
  );

  const images     = product.images ?? [];
  const currentImg = images[activeImg];
  const sku        = product.variants?.[0]?.sku;

  const waText = encodeURIComponent(
    `Hello Grace New Designers! I'm interested in:\n*${product.name}*${sku ? `\nRef: ${sku}` : ''}\n\nCould you share availability and pricing?`
  );
  const waHref = `https://wa.me/${WA_NUM}?text=${waText}`;

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="pt-28 pb-6 px-6 max-w-6xl mx-auto bg-gradient-to-b from-[#F5F8FF] to-white">
        <Link to="/collections"
          className="inline-flex items-center gap-1 text-xs tracking-widest uppercase text-[#6B82A8] hover:text-[#1565C0] transition-colors">
          <ChevronLeft size={14} /> Collections
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-2 gap-12">

          {/* Images */}
          <div className="space-y-3">
            <div className="aspect-[4/5] bg-[#F5F8FF] overflow-hidden border border-[#D4E2F4]">
              {currentImg ? (
                <img src={`/storage/${currentImg.path}`} alt={product.name}
                  className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#EEF4FF] to-[#F5F8FF]" />
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {images.map((img, i) => (
                  <button key={img.id} onClick={() => setActiveImg(i)}
                    className={`w-16 aspect-square border overflow-hidden transition-colors ${
                      i === activeImg ? 'border-[#1565C0]' : 'border-[#D4E2F4] hover:border-[#6B82A8]'
                    }`}>
                    <img src={`/storage/${img.path}`} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <p className="text-xs tracking-widest uppercase text-[#1565C0] mb-2 font-medium">{product.category?.name}</p>
            <h1 className="font-display text-4xl font-light leading-tight text-[#0A1628] mb-2">{product.name}</h1>
            {product.collection && (
              <p className="text-sm text-[#6B82A8] mb-6">{product.collection.name} Collection</p>
            )}

            {/* Variants / sizes */}
            {product.variants?.length > 0 && (
              <div className="mb-6">
                <p className="text-xs tracking-widest uppercase text-[#6B82A8] mb-3">Available sizes</p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map(v => (
                    <span key={v.id}
                      className={`border px-3 py-1.5 text-xs ${
                        v.qty_on_hand - v.qty_reserved > 0
                          ? 'border-[#D4E2F4] text-[#0A1628] bg-[#F5F8FF]'
                          : 'border-[#D4E2F4] text-[#9BB0CC] line-through bg-white'
                      }`}>
                      {v.size ?? v.sku}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {product.fabric && (
              <div className="mb-6 pb-6 border-b border-[#D4E2F4]">
                <p className="text-xs tracking-widest uppercase text-[#6B82A8] mb-1">Fabric</p>
                <p className="text-sm text-[#0A1628]">{product.fabric}</p>
              </div>
            )}

            {product.description && (
              <div className="mb-8 pb-8 border-b border-[#D4E2F4]">
                <p className="text-sm text-[#6B82A8] leading-relaxed whitespace-pre-line">{product.description}</p>
              </div>
            )}

            {/* Price note */}
            <div className="bg-[#F5F8FF] border border-[#D4E2F4] p-4 mb-6">
              <p className="text-xs text-[#6B82A8] leading-relaxed">
                Pricing depends on fabric, customisation and measurement requirements.
                Every garment is made to order — contact us for an exact quote.
              </p>
            </div>

            {/* Contact buttons */}
            <a href={waHref}
              className="flex items-center justify-center gap-3 bg-[#25D366] text-black py-4 text-xs font-medium tracking-widest uppercase hover:bg-[#1dc856] transition-colors mb-3 shadow-md">
              {WA_SVG} Ask for Price on WhatsApp
            </a>
            <a href={`tel:+${TEL}`}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#1565C0] to-[#29ABE2] text-white py-3 text-xs font-medium tracking-widest uppercase hover:from-[#1976D2] hover:to-[#4FC3F7] transition-all mb-3 shadow-sm">
              <Phone size={14} /> Call {TEL_DISPLAY}
            </a>
            <a href={waHref}
              className="flex items-center justify-center gap-2 border border-[#D4E2F4] text-[#6B82A8] py-3 text-xs font-medium tracking-widest uppercase hover:border-[#1565C0] hover:text-[#1565C0] transition-colors">
              Book a Fitting Consultation
            </a>

            {/* Category tag */}
            {product.category?.name && (
              <div className="flex flex-wrap gap-2 mt-8 pt-8 border-t border-[#D4E2F4]">
                <Link to={`/collections?category=${product.category.id}`}
                  className="text-xs border border-[#D4E2F4] text-[#6B82A8] px-3 py-1 hover:border-[#1565C0] hover:text-[#1565C0] transition-colors bg-[#F5F8FF]">
                  {product.category.name}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
