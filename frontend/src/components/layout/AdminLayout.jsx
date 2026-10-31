import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart,
  Users, FileText, BarChart2, Shield, LogOut, Store,
  ClipboardList, Menu, X, Globe,
} from 'lucide-react';
import clsx from 'clsx';

const nav = [
  { to: '/admin',             label: 'Dashboard',   icon: LayoutDashboard, end: true, module: 'dashboard' },
  { to: '/admin/sales',       label: 'Sales',       icon: ShoppingCart,               module: 'sales' },
  { to: '/admin/crm',         label: 'CRM / Leads', icon: Users,                      module: 'crm' },
  { to: '/admin/products',    label: 'Catalogue',   icon: Package,                    module: 'catalogue' },
  { to: '/admin/inventory',   label: 'Inventory',   icon: Warehouse,                  module: 'inventory' },
  { to: '/admin/purchases',   label: 'Purchases',   icon: ClipboardList,              module: 'purchases' },
  { to: '/admin/categories',  label: 'Categories',  icon: Store,                      module: 'categories' },
  { to: '/admin/site-content',label: 'Site Content',icon: Globe,                      module: 'site_content' },
  { to: '/admin/reports',     label: 'Reports',     icon: BarChart2,                  module: 'reports' },
  { to: '/admin/audit',       label: 'Audit Log',   icon: Shield,                     module: 'audit' },
  { to: '/admin/users',       label: 'Users',       icon: FileText,                   module: 'users' },
];

// Bottom nav shows only the 4 most-used items on mobile
const bottomNav = [
  { to: '/admin',           label: 'Home',      icon: LayoutDashboard, end: true, module: 'dashboard' },
  { to: '/admin/sales',     label: 'Sales',     icon: ShoppingCart,               module: 'sales' },
  { to: '/admin/products',  label: 'Catalogue', icon: Package,                    module: 'catalogue' },
  { to: '/admin/crm',       label: 'CRM',       icon: Users,                      module: 'crm' },
];

export default function AdminLayout() {
  const { user, logout, hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-50 w-60 bg-dark-bg flex flex-col shrink-0 transition-transform duration-300',
        'md:relative md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between">
          <div>
            <span className="font-display text-brand-500 text-base font-medium leading-tight block">
              Grace New<br/>Designers
            </span>
            <span className="text-xs text-gray-500 mt-0.5 block uppercase tracking-widest">Admin</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {nav.filter(({ module }) => hasPermission(module)).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to} to={to} end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-5 py-2.5 text-sm transition-colors',
                isActive
                  ? 'text-brand-400 bg-white/5 border-r-2 border-brand-500'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              )}
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-dark-border">
          <p className="text-xs text-gray-400 truncate font-medium">{user?.name}</p>
          <p className="text-xs text-gray-600 truncate mb-3">{user?.role_label}</p>
          <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-dark-bg border-b border-dark-border shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white p-1">
            <Menu size={22} />
          </button>
          <span className="font-display text-brand-500 text-sm font-medium">Grace New Designers</span>
          <div className="w-8" />
        </header>

        {/* Page content — scrollable */}
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-dark-bg border-t border-dark-border flex"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {bottomNav.filter(({ module }) => hasPermission(module)).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => clsx(
              'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] uppercase tracking-wide transition-colors',
              isActive ? 'text-brand-400' : 'text-gray-600 hover:text-gray-400'
            )}>
            <Icon size={20} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
        {/* More → opens sidebar */}
        <button onClick={() => setSidebarOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] uppercase tracking-wide text-gray-600 hover:text-gray-400 transition-colors">
          <Menu size={20} strokeWidth={1.8} />
          More
        </button>
      </nav>
    </div>
  );
}
