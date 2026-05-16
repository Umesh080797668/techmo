'use client';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryApi } from '@/lib/api';
import Link from 'next/link';
import { Bell, AlertTriangle, CheckCircle2, Menu } from 'lucide-react';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':     'Dashboard',
  '/pos':           'Point of Sale',
  '/orders':        'Orders',
  '/reservations':  'Reservations',
  '/inventory':     'Inventory',
  '/inventory/transfers': 'Transfers',
  '/products':      'Products',
  '/imei':          'IMEI & Serial Registry',
  '/pricing':       'Pricing & Promotions',
  '/compatibility': 'Compatibility Manager',
  '/warranty':      'Warranty & Claims',
  '/repairs':       'Repairs',
  '/customers':     'Customers & Loyalty',
  '/employees':     'Employees',
  '/payroll':       'Payroll',
  '/reports':       'Reports',
  '/insights':      'Business Insights',
  '/audit-logs':    'Audit Logs',
  '/settings':      'Settings',
  '/system':        'System',
};

export default function TopBar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Low stock query — polls every 60s
  const { data: lowStockRes } = useQuery({
    queryKey: ['low-stock-topbar'],
    queryFn: () => inventoryApi.list({ lowStockOnly: true, limit: 20 }).then(r => r.data),
    refetchInterval: 60_000,
  });

  const lowStockItems: any[] = lowStockRes?.data ?? lowStockRes ?? [];
  const lowStockCount = lowStockItems.length;

  const title = Object.entries(PAGE_TITLES).find(([path]) =>
    pathname === path || pathname.startsWith(path + '/')
  )?.[1] ?? 'TechMo Admin';

  const dateStr = now.toLocaleDateString('en-LK', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-LK', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <header className="h-14 flex items-center px-4 gap-3 flex-shrink-0 sticky top-0 z-30"
      style={{
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(16px) saturate(200%)',
        WebkitBackdropFilter: 'blur(16px) saturate(200%)',
        boxShadow: '0 1px 0 rgba(226,232,240,0.9), 0 2px 10px -3px rgba(0,0,0,0.06)',
      }}
    >
      {/* Mobile hamburger */}
      {onMenuToggle && (
        <button
          onClick={onMenuToggle}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}
      <h1 className="font-bold text-slate-900 text-base flex-1 truncate" style={{ letterSpacing: '-0.02em' }}>{title}</h1>

      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span className="hidden md:flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70">
          <span>{dateStr}</span>
          <span className="text-slate-300">·</span>
          <span className="font-mono tabular text-slate-600">{timeStr}</span>
        </span>
        <span className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50/90 px-2.5 py-1 rounded-lg ring-1 ring-emerald-200/80">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          Live
        </span>

        {/* 🔔 Low Stock Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(o => !o)}
            className="relative w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 hover:bg-slate-100 hover:text-slate-700 text-slate-500 border border-transparent hover:border-slate-200/80"
            title="Low stock alerts"
          >
            <Bell className="w-[15px] h-[15px] text-slate-500" />
            {lowStockCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                {lowStockCount > 99 ? '99+' : lowStockCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-11 w-80 rounded-2xl z-50 overflow-hidden animate-scaleIn"
              style={{
                background: 'rgba(255,255,255,0.97)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(226,232,240,0.85)',
                boxShadow: '0 10px 36px -6px rgba(0,0,0,0.14), 0 4px 12px -4px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.5)',
              }}
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(254,202,202,0.6)', background: 'linear-gradient(180deg, rgba(255,241,242,0.9) 0%, rgba(254,226,226,0.6) 100%)' }}>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-red-600 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Low Stock Alerts
                  </div>
                  {lowStockCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {lowStockCount}
                    </span>
                  )}
                </div>
                <Link href="/inventory" className="text-xs text-primary font-semibold hover:underline" onClick={() => setNotifOpen(false)}>
                  Manage →
                </Link>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                {lowStockCount === 0 && (
                  <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-green-600 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    All stock levels are healthy
                  </div>
                )}
                {lowStockItems.slice(0, 10).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-blue-50/40 transition-colors duration-100">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{item.sku}</p>
                      <p className="text-xs text-slate-400 truncate">{item.location ?? 'Main Store'}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <span className="inline-block bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        {item.quantity} left
                      </span>
                      <p className="text-xs text-slate-400 mt-0.5">min: {item.lowStockQty ?? item.lowStockThreshold}</p>
                    </div>
                  </div>
                ))}
                {lowStockCount > 10 && (
                  <div className="px-4 py-2 text-center text-xs text-slate-400">
                    +{lowStockCount - 10} more items
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {user && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs"
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1e3a8a 100%)', boxShadow: '0 2px 8px rgba(30,64,175,0.35), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span className="hidden sm:block text-sm font-semibold text-slate-800" style={{ letterSpacing: '-0.01em' }}>{user.username}</span>
          </div>
        )}
      </div>
    </header>
  );
}

