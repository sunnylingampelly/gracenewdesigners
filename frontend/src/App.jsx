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
          <Route path="products"   element={<Products />} />
          <Route path="inventory"  element={<Inventory />} />
          <Route path="purchases"  element={<Purchases />} />
          <Route path="sales"      element={<Sales />} />
          <Route path="sales/new"  element={<NewSale />} />
          <Route path="sales/:id"  element={<SaleDetail />} />
          <Route path="crm"        element={<CRM />} />
          <Route path="reports"    element={<Reports />} />
          <Route path="audit"      element={<AuditLog />} />
          <Route path="users"       element={<Users />} />
          <Route path="categories"   element={<Categories />} />
          <Route path="site-content" element={<SiteContent />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
