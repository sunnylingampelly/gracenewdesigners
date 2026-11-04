import { Outlet, Link, NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { siteSettingsApi } from '../../api/client';
import { Home, Grid3X3, Phone, Images } from 'lucide-react';

function WaIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

export default function PublicLayout() {
  const { pathname } = useLocation();

  const { data: settingsMap = {} } = useQuery({
    queryKey: ['public-settings'],
    queryFn:  () => siteSettingsApi.publicGet().then(r => r.data ?? {}),
    staleTime: 60000,
  });

  const s = key => settingsMap[key] ?? '';

  const brandName    = s('brand_name')           || 'Grace New Designers';
  const brandTagline = s('brand_tagline')         || 'Designer Menswear · Made to Measure';
  const phone        = s('contact_phone')         || '918181816202';
  const phoneDsp     = s('contact_phone_display') || '+91 81818 16202';
  const wa           = s('contact_whatsapp')      || '918181816202';
  const address      = s('contact_address')       || 'Musheerabad, Hyderabad, Telangana';
  const hours        = s('store_hours')           || 'Mon–Sat · 10am–7pm';
  const copyright    = s('copyright_text')        || `© ${new Date().getFullYear()} Grace New Designers`;
  const col2         = s('footer_col2_title')     || 'Collections';
  const col3         = s('footer_col3_title')     || 'Services';
  const col4         = s('footer_col4_title')     || 'Contact';
  const footerAbout  = s('footer_tagline')        || brandTagline;
  const services     = s('footer_services')
    ? s('footer_services').split(',').map(x => x.trim()).filter(Boolean)
    : ['Made to Measure', 'Bespoke Tailoring', 'Alterations', 'Occasion Wear'];
  const announcement = s('announcement_text');

  const waHref = `https://wa.me/${wa}?text=${encodeURIComponent("Hello Grace New Designers! I'd like to enquire about your collection.")}`;
  const telHref = `tel:+${phone}`;

  return (
    <div className="min-h-screen bg-white text-[#0A1628] font-body">

      {/* ── Announcement bar ── */}
      {announcement && (
        <div className="bg-[#1565C0] text-white text-xs text-center py-1.5 px-4 font-medium tracking-wide">
          {announcement}
        </div>
      )}

      {/* ── Desktop / Tablet Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 hidden md:flex items-center justify-between px-8 py-4
                      bg-white/95 backdrop-blur-sm border-b border-[#D4E2F4] shadow-sm"
           style={{ top: announcement ? '28px' : '0' }}>
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo.png" alt={brandName} className="h-10 w-auto" onError={e => { e.target.style.display = 'none'; }} />
          <span className="font-display text-lg font-medium tracking-wide text-[#0A1628] hidden lg:block">{brandName}</span>
        </Link>

        <div className="flex items-center gap-8">
          <NavLink to="/collections" className={({ isActive }) =>
            `text-xs tracking-widest uppercase transition-colors ${isActive ? 'text-[#1565C0]' : 'text-[#6B82A8] hover:text-[#0A1628]'}`
          }>{col2}</NavLink>
          <a href="/#gallery" className="text-xs tracking-widest uppercase text-[#6B82A8] hover:text-[#0A1628] transition-colors">Gallery</a>
          <a href="/#craft"   className="text-xs tracking-widest uppercase text-[#6B82A8] hover:text-[#0A1628] transition-colors">Our Craft</a>
        </div>

        <div className="flex items-center gap-4">
          <a href={telHref}
            className="flex items-center gap-2 text-sm text-[#6B82A8] hover:text-[#1565C0] transition-colors">
            <Phone size={14} />
            <span className="hidden lg:inline">{phoneDsp}</span>
          </a>
          <a href={waHref} target="_blank" rel="noopener"
            className="text-xs tracking-widest uppercase px-5 py-2.5
                       bg-gradient-to-r from-[#1565C0] to-[#29ABE2] text-white
                       hover:from-[#1976D2] hover:to-[#4FC3F7] transition-all shadow-sm">
            Enquire
          </a>
        </div>
      </nav>

      {/* ── Mobile Top Bar ── */}
      <div className="fixed top-0 left-0 right-0 z-50 flex md:hidden items-center justify-between px-4 py-3
                      bg-white border-b border-[#D4E2F4] shadow-sm"
           style={{ top: announcement ? '28px' : '0' }}>
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt={brandName} className="h-8 w-auto" onError={e => { e.target.style.display = 'none'; }} />
          <span className="font-display text-sm font-medium text-[#0A1628] leading-tight">
            Grace New<br/><span className="text-[#1565C0]">Designers</span>
          </span>
        </Link>
        <a href={telHref}
          className="flex items-center gap-2 bg-[#EEF4FF] border border-[#D4E2F4] px-3 py-2 text-xs text-[#1565C0] font-medium">
          <Phone size={13} /> Call Us
        </a>
      </div>

      {/* Page content — padded for nav + mobile bottom nav */}
      <div className="pb-20 md:pb-0 pt-0 md:pt-[73px]" style={{ paddingTop: announcement ? undefined : undefined }}>
        <Outlet />
      </div>

      {/* ── Desktop Footer ── */}
      <footer id="contact" className="hidden md:block border-t border-[#D4E2F4] py-16 bg-[#F5F8FF]">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src="/logo.png" alt={brandName} className="h-10 w-auto" onError={e => { e.target.style.display = 'none'; }} />
              <h3 className="font-display text-lg text-[#0A1628]">{brandName}</h3>
            </div>
            <p className="text-sm text-[#6B82A8] leading-relaxed">{footerAbout}</p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-widest text-[#1565C0] mb-4">{col2}</h4>
            <ul className="space-y-2 text-sm text-[#6B82A8]">
              <li><Link to="/collections" className="hover:text-[#0A1628] transition-colors">All Pieces</Link></li>
              <li><Link to="/collections?type=indian" className="hover:text-[#0A1628] transition-colors">Indian Wear</Link></li>
              <li><Link to="/collections?type=western" className="hover:text-[#0A1628] transition-colors">Western Suits</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-widest text-[#1565C0] mb-4">{col3}</h4>
            <ul className="space-y-2 text-sm text-[#6B82A8]">
              {services.map(sv => <li key={sv}>{sv}</li>)}
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-widest text-[#1565C0] mb-4">{col4}</h4>
            <ul className="space-y-3 text-sm text-[#6B82A8]">
              <li className="flex items-start gap-2">
                <Phone size={13} className="text-[#1565C0] mt-0.5 shrink-0" />
                <a href={telHref} className="hover:text-[#0A1628] transition-colors">{phoneDsp}</a>
              </li>
              <li className="flex items-start gap-2">
                <WaIcon size={13} className="text-[#25D366] mt-0.5 shrink-0" />
                <a href={waHref} target="_blank" rel="noopener" className="hover:text-[#0A1628] transition-colors">WhatsApp</a>
              </li>
              {address && <li className="text-xs leading-relaxed">{address}</li>}
              {hours && <li>{hours}</li>}
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 mt-10 pt-6 border-t border-[#D4E2F4] flex justify-between text-xs text-[#6B82A8]">
          <span>{copyright}</span>
          <Link to="/admin" className="hover:text-[#0A1628] transition-colors">Staff Login</Link>
        </div>
      </footer>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden
                      bg-white border-t border-[#D4E2F4] shadow-lg
                      flex items-stretch" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <Link to="/" className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors
          ${pathname === '/' ? 'text-[#1565C0]' : 'text-[#9BB0CC] hover:text-[#6B82A8]'}`}>
          <Home size={20} strokeWidth={1.8} />
          <span className="text-[10px] tracking-wide uppercase">Home</span>
        </Link>

        <Link to="/collections" className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors
          ${pathname.startsWith('/collections') ? 'text-[#1565C0]' : 'text-[#9BB0CC] hover:text-[#6B82A8]'}`}>
          <Grid3X3 size={20} strokeWidth={1.8} />
          <span className="text-[10px] tracking-wide uppercase">Catalogue</span>
        </Link>

        {/* WhatsApp — featured center button */}
        <a href={waHref} target="_blank" rel="noopener"
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2">
          <div className="w-12 h-12 rounded-full bg-[#25D366]
                          flex items-center justify-center shadow-lg shadow-[#25D366]/40 -mt-5">
            <WaIcon size={22} className="text-white" />
          </div>
          <span className="text-[10px] tracking-wide uppercase text-[#9BB0CC]">Enquire</span>
        </a>

        <a href="/#gallery" className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[#9BB0CC] hover:text-[#6B82A8] transition-colors">
          <Images size={20} strokeWidth={1.8} />
          <span className="text-[10px] tracking-wide uppercase">Gallery</span>
        </a>

        <a href={telHref} className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[#9BB0CC] hover:text-[#6B82A8] transition-colors">
          <Phone size={20} strokeWidth={1.8} />
          <span className="text-[10px] tracking-wide uppercase">Call</span>
        </a>
      </nav>

      {/* Mobile footer */}
      <footer className="md:hidden border-t border-[#D4E2F4] py-10 bg-[#F5F8FF] text-center" id="contact">
        <img src="/logo.png" alt={brandName} className="h-12 w-auto mx-auto mb-3" onError={e => { e.target.style.display = 'none'; }} />
        <p className="font-display text-lg mb-1 text-[#0A1628]">{brandName}</p>
        {address && <p className="text-xs text-[#6B82A8] mb-2 px-6 leading-relaxed">{address}</p>}
        {hours && <p className="text-xs text-[#6B82A8] mb-4">{hours}</p>}
        <div className="flex justify-center gap-3 flex-wrap px-4">
          <a href={telHref} className="flex items-center gap-2 border border-[#D4E2F4] bg-white px-4 py-2 text-xs text-[#1565C0] font-medium">
            <Phone size={13} /> {phoneDsp}
          </a>
          <a href={waHref} target="_blank" rel="noopener" className="flex items-center gap-2 bg-[#25D366] px-4 py-2 text-xs text-white font-medium">
            <WaIcon size={13} /> WhatsApp
          </a>
        </div>
        <p className="text-xs text-[#9BB0CC] mt-6">{copyright}</p>
      </footer>
    </div>
  );
}
