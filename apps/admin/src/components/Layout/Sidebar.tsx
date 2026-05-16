'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import clsx from 'clsx';
import {
  LayoutDashboard, ShoppingCart, ClipboardList, Calendar, Package,
  Smartphone, Hash, Tag, Link2, Shield, Wrench, Users, UserCog,
  Banknote, BarChart2, Lightbulb, FileText, Settings, ShieldCheck,
  LogOut, Zap, ArrowLeftRight, X, MessageSquare, type LucideIcon,
} from 'lucide-react';

type NavRole = 'SUPER_ADMIN' | 'MANAGER' | 'CASHIER' | 'TECHNICIAN' | 'HR_ADMIN';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: readonly string[];
  /** Exact-only match — prevents parent capturing child routes */
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Sales',
    items: [
      { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard, roles: ['SUPER_ADMIN','MANAGER','CASHIER','TECHNICIAN','HR_ADMIN'] },
      { href: '/pos',          label: 'POS',          icon: ShoppingCart,    roles: ['SUPER_ADMIN','MANAGER','CASHIER'] },
      { href: '/orders',       label: 'Orders',       icon: ClipboardList,   roles: ['SUPER_ADMIN','MANAGER','CASHIER'] },
      { href: '/reservations', label: 'Reservations', icon: Calendar,        roles: ['SUPER_ADMIN','MANAGER','CASHIER'] },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { href: '/inventory',           label: 'Stock Levels',  icon: Package,        roles: ['SUPER_ADMIN','MANAGER'], exact: true },
      { href: '/inventory/transfers', label: 'Transfers',     icon: ArrowLeftRight, roles: ['SUPER_ADMIN','MANAGER'] },
      { href: '/products',            label: 'Products',      icon: Smartphone,     roles: ['SUPER_ADMIN','MANAGER'] },
      { href: '/imei',                label: 'IMEI Registry', icon: Hash,           roles: ['SUPER_ADMIN','MANAGER','CASHIER'] },
      { href: '/pricing',             label: 'Pricing',       icon: Tag,            roles: ['SUPER_ADMIN','MANAGER'] },
      { href: '/compatibility',       label: 'Compatibility', icon: Link2,          roles: ['SUPER_ADMIN','MANAGER'] },
      { href: '/warranty',            label: 'Warranty',      icon: Shield,         roles: ['SUPER_ADMIN','MANAGER','CASHIER'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/repairs',      label: 'Repairs',       icon: Wrench,          roles: ['SUPER_ADMIN','MANAGER','TECHNICIAN'] },
      { href: '/customers',    label: 'Customers',     icon: Users,           roles: ['SUPER_ADMIN','MANAGER','CASHIER'] },
      { href: '/reviews',      label: 'Reviews',       icon: MessageSquare,   roles: ['SUPER_ADMIN','MANAGER'] },
    ],
  },
  {
    label: 'HR & Finance',
    items: [
      { href: '/employees', label: 'Employees', icon: UserCog,  roles: ['SUPER_ADMIN','MANAGER','HR_ADMIN'] },
      { href: '/payroll',   label: 'Payroll',   icon: Banknote, roles: ['SUPER_ADMIN','MANAGER','HR_ADMIN'] },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { href: '/reports',    label: 'Reports',    icon: BarChart2,  roles: ['SUPER_ADMIN','MANAGER','HR_ADMIN'] },
      { href: '/insights',   label: 'Insights',   icon: Lightbulb, roles: ['SUPER_ADMIN','MANAGER'] },
      { href: '/audit-logs', label: 'Audit Logs', icon: FileText,  roles: ['SUPER_ADMIN','MANAGER','HR_ADMIN'] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings,    roles: ['SUPER_ADMIN','MANAGER'] },
      { href: '/system',   label: 'System',   icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
    ],
  },
];

function isItemActive(href: string, pathname: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

export default function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout, isRole } = useAuth();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={clsx(
        'w-60 flex-shrink-0 bg-sidebar text-white flex flex-col h-screen z-40 transition-transform duration-300',
        'fixed inset-y-0 left-0 md:sticky md:top-0',
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}>
      {/* ── Logo ─────────────────────────────────────────── */}
      <div className="px-5 py-[18px] border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-800
                          flex items-center justify-center flex-shrink-0
                          shadow-lg shadow-blue-900/50 ring-1 ring-white/[0.12]">
            <Zap className="w-[15px] h-[15px] text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-extrabold text-white text-[15px] tracking-tight leading-none">TechMo</span>
            <span className="block text-[9px] text-slate-500 font-semibold uppercase tracking-[0.18em] mt-0.5">
              Enterprise POS
            </span>
          </div>
          {/* Mobile close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────── */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto scrollbar-hide space-y-4">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) =>
            isRole(...(item.roles as unknown as NavRole[]))
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600 select-none">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isItemActive(item.href, pathname, item.exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={clsx(
                        'relative flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150',
                        active
                          ? 'bg-white/[0.09] text-white'
                          : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 inset-y-[6px] w-[3px] bg-accent rounded-r-full" />
                      )}
                      <item.icon
                        className={clsx(
                          'w-[15px] h-[15px] flex-shrink-0 transition-colors',
                          active ? 'text-accent' : 'text-slate-500'
                        )}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── User footer ───────────────────────────────────── */}
      <div className="px-3 py-4 border-t border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3 mb-2.5 px-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-amber-600
                          flex items-center justify-center text-slate-900 font-bold text-[13px] flex-shrink-0
                          shadow-md shadow-amber-900/30">
            {user?.username?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-white truncate leading-tight">{user?.username}</p>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 text-[11px] text-slate-500 hover:text-red-400
                     transition-colors py-1.5 px-2 rounded-lg hover:bg-red-500/10 font-medium"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
    </>
  );
}
