import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart,
  Users, FileText, BarChart2, Shield, LogOut, Store, ClipboardList,
} from 'lucide-react';
import clsx from 'clsx';

const nav = [
  { to: '/admin',           label: 'Dashboard',  icon: LayoutDashboard, end: true },
  { to: '/admin/sales',     label: 'Sales',       icon: ShoppingCart },
  { to: '/admin/crm',       label: 'CRM / Leads', icon: Users },
  { to: '/admin/products',  label: 'Catalogue',   icon: Package },
  { to: '/admin/inventory', label: 'Inventory',   icon: Warehouse },
  { to: '/admin/purchases', label: 'Purchases',   icon: ClipboardList },
  { to: '/admin/categories',label: 'Categories',  icon: Store },
  { to: '/admin/reports',   label: 'Reports',     icon: BarChart2 },
  { to: '/admin/audit',     label: 'Audit Log',   icon: Shield },
  { to: '/admin/users',     label: 'Users',       icon: Users },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-dark-bg flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-dark-border">
          <span className="font-display text-brand-500 text-lg font-medium leading-tight block">
            Grace New<br/>Designers
          </span>
          <span className="text-xs text-gray-500 mt-1 block uppercase tracking-widest">Management</span>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to} to={to} end={end}
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
          <p className="text-xs text-gray-500 truncate">{user?.name}</p>
          <p className="text-xs text-gray-600 truncate mb-2">{user?.role_label}</p>
          <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
