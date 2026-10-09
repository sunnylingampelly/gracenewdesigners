"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  BarChart3, BookImage, ChevronsLeft, ChevronsRight, ClipboardList, FileText, FolderTree, Gem, Globe, Images, Inbox, LayoutDashboard,
  LayoutTemplate, ListTree, LogOut, Menu, Package, Ruler, Search, Settings, Shield, ShoppingBag, Sparkles, UserCircle, Users, X, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/admin/auth";
import { useAdminQuery, useDebounced } from "@/lib/admin/hooks";
import { cn } from "@/lib/utils";

type NavEntry = { href: string; label: string; icon: LucideIcon; permission: string | string[] };

export const NAV_GROUPS: { label: string; items: NavEntry[] }[] = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "reports.view" }] },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", icon: Package, permission: "products.view" },
      { href: "/admin/categories", label: "Categories", icon: FolderTree, permission: ["taxonomy.manage", "products.view"] },
      { href: "/admin/collections", label: "Collections", icon: Gem, permission: ["taxonomy.manage", "products.view"] },
      { href: "/admin/occasions", label: "Occasions", icon: Sparkles, permission: ["taxonomy.manage", "products.view"] },
      { href: "/admin/attributes", label: "Attributes & Size Charts", icon: Ruler, permission: "attributes.manage" },
      { href: "/admin/media", label: "Media Library", icon: Images, permission: "media.view" },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/enquiries", label: "Enquiries", icon: Inbox, permission: "enquiries.view" },
      { href: "/admin/orders", label: "Orders", icon: ShoppingBag, permission: "orders.view" },
      { href: "/admin/customers", label: "Customers / Contacts", icon: Users, permission: "customers.view" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/homepage", label: "Homepage Builder", icon: LayoutTemplate, permission: "content.manage" },
      { href: "/admin/lookbooks", label: "Lookbook", icon: BookImage, permission: "content.manage" },
      { href: "/admin/pages", label: "Pages & Testimonials", icon: FileText, permission: "content.manage" },
      { href: "/admin/navigation", label: "Navigation Menus", icon: ListTree, permission: "navigation.manage" },
      { href: "/admin/seo", label: "SEO & Marketing", icon: Globe, permission: "seo.manage" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3, permission: "reports.view" },
      { href: "/admin/team", label: "Team & Roles", icon: Shield, permission: "users.manage" },
      { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings.manage" },
      { href: "/admin/activity", label: "Activity Logs", icon: ClipboardList, permission: "activity.view" },
    ],
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, can, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("gnd-admin-collapsed") === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("gnd-admin-collapsed", c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(i.permission)) })).filter((g) => g.items.length);
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const nav = (compact: boolean) => (
    <nav aria-label="Admin" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.label} className="mb-5">
          {!compact && <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{group.label}</p>}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={compact ? item.label : undefined}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                    isActive(item.href) ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    compact && "justify-center",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                  {!compact && <span className="truncate">{item.label}</span>}
                  {compact && <span className="sr-only">{item.label}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex", collapsed ? "w-16" : "w-64")}>
        <div className={cn("flex h-14 items-center border-b border-slate-100", collapsed ? "justify-center" : "justify-between px-4")}>
          {!collapsed && (
            <Link href="/admin" className="leading-none">
              <span className="display block text-xl tracking-[0.25em] text-midnight uppercase">Grace</span>
              <span className="text-[9px] font-semibold tracking-[0.3em] text-slate-400 uppercase">Studio Admin</span>
            </Link>
          )}
          <button type="button" onClick={toggleCollapsed} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
        {nav(collapsed)}
        <a href="/" target="_blank" rel="noopener noreferrer" className={cn("m-3 rounded-md border border-slate-200 px-3 py-2 text-center text-xs text-slate-600 hover:bg-slate-50", collapsed && "sr-only")}>View storefront ↗</a>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-slate-100 px-4">
              <span className="display text-xl tracking-[0.25em] text-midnight uppercase">Grace</span>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="rounded p-1.5 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            {nav(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} className="-ml-1 rounded p-2 hover:bg-slate-100 lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
          <GlobalSearch />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="ml-auto flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-100" aria-label="Account menu">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">{user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
              <span className="hidden text-left sm:block">
                <span className="block leading-tight font-medium">{user.name}</span>
                <span className="block text-xs leading-tight text-slate-500">{user.roles.map((r) => r.name).join(", ")}</span>
              </span>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-52 rounded-md border border-slate-200 bg-white p-1 text-sm shadow-lg">
                <DropdownMenu.Label className="px-2 py-1.5 text-xs text-slate-500">{user.email}</DropdownMenu.Label>
                <DropdownMenu.Item asChild>
                  <Link href="/admin/account" className="flex items-center gap-2 rounded px-2 py-1.5 outline-none data-[highlighted]:bg-slate-100"><UserCircle className="h-4 w-4" /> Account & security</Link>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-slate-100" />
                <DropdownMenu.Item onSelect={() => void logout()} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-red-700 outline-none data-[highlighted]:bg-red-50">
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </header>
        {user.two_factor_required && !user.two_factor_enabled && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900">
            Your role requires two-factor authentication. <Link href="/admin/account" className="font-medium underline">Set it up now</Link>.
          </div>
        )}
        <main id="admin-main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

type SearchHit = { id: number; name?: string; sku?: string; reference?: string; product?: string | null; status: string };

function GlobalSearch() {
  const { can } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(q.trim(), 250);
  const ref = useRef<HTMLDivElement>(null);
  const active = debounced.length >= 2;
  const products = useAdminQuery<{ data: SearchHit[] }>(active && can("products.view") ? "/admin/products" : null, { q: debounced, per_page: 5 });
  const enquiries = useAdminQuery<{ data: SearchHit[] }>(active && can("enquiries.view") ? "/admin/enquiries" : null, { q: debounced, per_page: 5 });

  useEffect(() => {
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        ref.current?.querySelector("input")?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search products, SKUs, enquiries…  (Ctrl K)"
        aria-label="Global search"
        className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm focus:border-royal focus:bg-white focus:outline-none"
      />
      {open && active && (
        <div className="absolute inset-x-0 top-11 z-50 max-h-96 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg">
          {products.data?.data.length ? <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Products</p> : null}
          {products.data?.data.map((p) => (
            <button key={`p${p.id}`} type="button" onClick={() => go(`/admin/products/${p.id}`)} className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100">
              <span className="truncate">{p.name}</span><span className="ml-2 shrink-0 text-xs text-slate-400">{p.sku}</span>
            </button>
          ))}
          {enquiries.data?.data.length ? <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Enquiries</p> : null}
          {enquiries.data?.data.map((e) => (
            <button key={`e${e.id}`} type="button" onClick={() => go(`/admin/enquiries/${e.id}`)} className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100">
              <span className="truncate">{e.reference} · {e.product ?? "—"}</span><span className="ml-2 shrink-0 text-xs text-slate-400">{e.status}</span>
            </button>
          ))}
          {!products.isFetching && !enquiries.isFetching && !products.data?.data.length && !enquiries.data?.data.length && <p className="px-2 py-3 text-sm text-slate-500">No matches for “{debounced}”.</p>}
        </div>
      )}
    </div>
  );
}
