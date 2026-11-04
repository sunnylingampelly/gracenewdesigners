import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Public pages
import PublicLayout  from './components/layout/PublicLayout';
import Home          from './pages/public/Home';
import Collections  from './pages/public/Collections';
import ProductDetail from './pages/public/ProductDetail';

// Admin pages
import AdminLayout  from './components/layout/AdminLayout';
import LoginPage    from './pages/admin/Login';
import Dashboard    from './pages/admin/Dashboard';
import Products     from './pages/admin/Products';
import Inventory    from './pages/admin/Inventory';
import Purchases    from './pages/admin/Purchases';
import Sales        from './pages/admin/Sales';
import NewSale      from './pages/admin/NewSale';
import CRM          from './pages/admin/CRM';
import Reports      from './pages/admin/Reports';
import AuditLog     from './pages/admin/AuditLog';
import Users        from './pages/admin/Users';
import Categories   from './pages/admin/Categories';
import SiteContent  from './pages/admin/SiteContent';
import SaleDetail   from './pages/admin/SaleDetail';

function RequireAuth({ children }) {
  const { user, loading } = useAuthStore();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>;
  if (!user)   return <Navigate to="/admin/login" replace />;
  return children;
}

function RequirePermission({ module, children }) {
  const { hasPermission } = useAuthStore();
  if (!hasPermission(module)) return <Navigate to="/admin" replace />;
  return children;
}

export default function App() {
  const init = useAuthStore(s => s.init);
  useEffect(() => { init(); }, [init]);

  return (
    <BrowserRouter>
      <Routes>
        {/* ── PUBLIC ── */}
        <Route element={<PublicLayout />}>
          <Route index              element={<Home />} />
          <Route path="collections" element={<Collections />} />
          <Route path="products/:slug" element={<ProductDetail />} />
        </Route>

        {/* ── ADMIN ── */}
        <Route path="admin/login" element={<LoginPage />} />
        <Route path="admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
          <Route index             element={<Dashboard />} />
          <Route path="products"   element={<RequirePermission module="products"><Products /></RequirePermission>} />
          <Route path="inventory"  element={<RequirePermission module="inventory"><Inventory /></RequirePermission>} />
          <Route path="purchases"  element={<RequirePermission module="purchases"><Purchases /></RequirePermission>} />
          <Route path="sales"      element={<RequirePermission module="sales"><Sales /></RequirePermission>} />
          <Route path="sales/new"  element={<RequirePermission module="sales"><NewSale /></RequirePermission>} />
          <Route path="sales/:id"  element={<RequirePermission module="sales"><SaleDetail /></RequirePermission>} />
          <Route path="crm"        element={<RequirePermission module="crm"><CRM /></RequirePermission>} />
          <Route path="reports"    element={<RequirePermission module="reports"><Reports /></RequirePermission>} />
          <Route path="audit"      element={<RequirePermission module="audit"><AuditLog /></RequirePermission>} />
          <Route path="users"       element={<RequirePermission module="users"><Users /></RequirePermission>} />
          <Route path="categories"   element={<RequirePermission module="categories"><Categories /></RequirePermission>} />
          <Route path="site-content" element={<RequirePermission module="site_content"><SiteContent /></RequirePermission>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
