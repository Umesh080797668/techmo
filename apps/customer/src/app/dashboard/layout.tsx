'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import Link from 'next/link';
import {
  LayoutDashboard, Wrench, ShoppingBag, Star, Shield, UserCircle,
  LogOut, Smartphone, Menu, X, ChevronRight, MessageSquare,
} from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/dashboard',            label: 'Overview',          icon: LayoutDashboard },
  { href: '/dashboard/repairs',    label: 'My Repairs',        icon: Wrench },
  { href: '/dashboard/orders',     label: 'Order History',     icon: ShoppingBag },
  { href: '/dashboard/points',     label: 'Loyalty Points',    icon: Star },
  { href: '/dashboard/reviews',    label: 'My Reviews',        icon: MessageSquare },
  { href: '/dashboard/warranty',   label: 'Warranty',          icon: Shield },
  { href: '/dashboard/profile',    label: 'Profile',           icon: UserCircle },
];

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { customer, logout } = useCustomerAuth();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={clsx(
          'fixed top-0 left-0 z-40 h-full w-64 bg-sidebar border-r border-slate-700/50 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg">TechMo</span>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        {customer && (
          <div className="px-5 py-4 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                {customer.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{customer.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={clsx(
                    'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
                    customer.tier === 'PREMIUM'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-primary/20 text-primary'
                  )}>
                    {customer.tier}
                  </span>
                  <span className="text-xs text-slate-400">{customer.loyaltyPoints.toLocaleString()} pts</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-0.5 px-3">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onClose}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                      active
                        ? 'bg-primary/15 text-primary'
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                    )}
                  >
                    <Icon className={clsx('w-4.5 h-4.5 flex-shrink-0', active ? 'text-primary' : 'text-slate-500 group-hover:text-slate-300')} />
                    {label}
                    {label === 'Silicon Syndicate' && !active && (
                      <span className="ml-auto text-[9px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded px-1 py-0.5 font-bold uppercase tracking-wide">NEW</span>
                    )}
                    {active && <ChevronRight className="w-3.5 h-3.5 ml-auto text-primary" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-700/50">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4.5 h-4.5" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useCustomerAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center animate-pulse">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <span className="text-sm text-slate-500">Loading…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-sidebar border-b border-slate-700/50 sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-400 hover:text-white"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
              <Smartphone className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-white text-sm">TechMo</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
