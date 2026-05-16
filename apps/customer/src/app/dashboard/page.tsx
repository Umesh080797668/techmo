'use client';
import { useQuery } from '@tanstack/react-query';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { loyaltyApi, myRepairsApi, myOrdersApi } from '@/lib/api';
import Link from 'next/link';
import {
  Wrench, ShoppingBag, Star, Shield, ArrowRight, TrendingUp,
  Trophy, ChevronRight, Zap, Package, Clock, MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

const REPAIR_BADGE: Record<string, { label: string; color: string }> = {
  RECEIVED:          { label: 'Received',       color: 'text-cyan-400    bg-cyan-400/10    border-cyan-400/20'    },
  PENDING:           { label: 'Pending',        color: 'text-amber-400   bg-amber-400/10   border-amber-400/20'   },
  PENDING_DIAGNOSIS: { label: 'Diagnosing',     color: 'text-sky-400     bg-sky-400/10     border-sky-400/20'     },
  DIAGNOSING:        { label: 'Diagnosing',     color: 'text-sky-400     bg-sky-400/10     border-sky-400/20'     },
  AWAITING_PARTS:    { label: 'Waiting Parts',  color: 'text-orange-400  bg-orange-400/10  border-orange-400/20'  },
  UNDER_REPAIR:      { label: 'In Progress',    color: 'text-blue-400    bg-blue-400/10    border-blue-400/20'    },
  IN_PROGRESS:       { label: 'In Progress',    color: 'text-blue-400    bg-blue-400/10    border-blue-400/20'    },
  WAITING_PARTS:     { label: 'Waiting Parts',  color: 'text-orange-400  bg-orange-400/10  border-orange-400/20'  },
  READY_FOR_PICKUP:  { label: 'Ready',          color: 'text-violet-400  bg-violet-400/10  border-violet-400/20'  },
  COMPLETED:         { label: 'Completed',      color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  DELIVERED:         { label: 'Delivered',      color: 'text-green-400   bg-green-400/10   border-green-400/20'   },
  CANCELLED:         { label: 'Cancelled',      color: 'text-red-400     bg-red-400/10     border-red-400/20'     },
};

const ORDER_BADGE: Record<string, { label: string; color: string }> = {
  PENDING:    { label: 'Pending',    color: 'text-amber-400   bg-amber-400/10   border-amber-400/20'   },
  CONFIRMED:  { label: 'Confirmed',  color: 'text-blue-400    bg-blue-400/10    border-blue-400/20'    },
  PROCESSING: { label: 'Processing', color: 'text-sky-400     bg-sky-400/10     border-sky-400/20'     },
  COMPLETED:  { label: 'Completed',  color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  CANCELLED:  { label: 'Cancelled',  color: 'text-red-400     bg-red-400/10     border-red-400/20'     },
};

export default function DashboardPage() {
  const { customer } = useCustomerAuth();

  const { data: loyalty } = useQuery({
    queryKey: ['loyalty-summary'],
    queryFn: () => loyaltyApi.summary().then(r => r.data),
    enabled: !!customer,
  });
  const { data: repairs } = useQuery({
    queryKey: ['my-repairs-recent'],
    queryFn: () => myRepairsApi.list({ limit: 4 }).then(r => r.data),
    enabled: !!customer,
  });
  const { data: orders } = useQuery({
    queryKey: ['my-orders-recent'],
    queryFn: () => myOrdersApi.list({ limit: 4 }).then(r => r.data),
    enabled: !!customer,
  });

  const points = loyalty?.totalPoints ?? customer?.loyaltyPoints ?? 0;
  const tier   = loyalty?.tier ?? customer?.tier ?? 'STANDARD';
  const PREMIUM_THRESHOLD = 5000;
  const progress     = tier === 'PREMIUM' ? 100 : Math.min(100, (points / PREMIUM_THRESHOLD) * 100);
  const repairItems  = repairs?.items ?? [];
  const orderItems   = orders?.items  ?? [];
  const activeRepairs = repairItems.filter((r: any) => !['DELIVERED', 'CANCELLED', 'COMPLETED'].includes(r.status)).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = customer?.name.split(' ')[0] ?? '';

  return (
    <div className="space-y-6 max-w-5xl">

      {/* ── Welcome banner ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2747] via-slate-800/80 to-slate-800/40 border border-primary/25 p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none blur-2xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-slate-400 mb-1">{greeting} 👋</p>
            <h1 className="text-2xl font-bold text-white truncate">{firstName}</h1>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={clsx(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border',
                tier === 'PREMIUM'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-primary/15 text-primary border-primary/30',
              )}>
                {tier === 'PREMIUM' ? <Trophy className="w-3 h-3" /> : <Star className="w-3 h-3" />}
                {tier}
              </span>
              <span className="text-sm text-slate-400">
                <span className="text-white font-semibold">{points.toLocaleString()}</span> points
              </span>
            </div>
          </div>
          <div className={clsx(
            'flex-shrink-0 w-14 h-14 rounded-2xl border flex items-center justify-center text-xl font-bold',
            tier === 'PREMIUM'
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              : 'bg-primary/15 border-primary/30 text-primary',
          )}>
            {customer?.name.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          href="/dashboard/points"
          icon={<Star className="w-5 h-5 text-amber-400" />}
          bg="bg-amber-400/10"
          label="Loyalty Points"
          value={points.toLocaleString()}
          sub={<span className={clsx('text-[11px] font-bold uppercase', tier === 'PREMIUM' ? 'text-amber-400' : 'text-primary')}>{tier}</span>}
        />
        <StatCard
          href="/dashboard/repairs"
          icon={<Wrench className="w-5 h-5 text-blue-400" />}
          bg="bg-blue-400/10"
          label="Active Repairs"
          value={activeRepairs}
          sub={<span className="text-[11px] text-slate-500">{repairItems.length} total</span>}
        />
        <StatCard
          href="/dashboard/orders"
          icon={<ShoppingBag className="w-5 h-5 text-emerald-400" />}
          bg="bg-emerald-400/10"
          label="Total Orders"
          value={orders?.total ?? '—'}
          sub={<span className="text-[11px] text-slate-500">all time</span>}
        />
        <StatCard
          href="/dashboard/warranty"
          icon={<Shield className="w-5 h-5 text-violet-400" />}
          bg="bg-violet-400/10"
          label="Warranty"
          value="Check"
          sub={<span className="text-[11px] text-slate-500">by IMEI</span>}
        />
      </div>

      {/* ── Loyalty progress (STANDARD only) ───────────────────────────────── */}
      {tier !== 'PREMIUM' && (
        <div className="card border-amber-500/15">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" /> Progress to Premium
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {(PREMIUM_THRESHOLD - points).toLocaleString()} more points to unlock exclusive benefits
              </p>
            </div>
            <Link href="/dashboard/points" className="text-xs text-primary hover:underline whitespace-nowrap">
              Earn more
            </Link>
          </div>
          <div className="w-full bg-slate-700/60 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-primary via-primary/80 to-amber-400 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[11px] text-slate-500">
            <span>{points.toLocaleString()} pts</span>
            <span className="text-amber-400 font-medium">{PREMIUM_THRESHOLD.toLocaleString()} pts — Premium</span>
          </div>
        </div>
      )}

      {/* ── Premium banner ──────────────────────────────────────────────────── */}
      {tier === 'PREMIUM' && (
        <div className="card border-amber-500/25 bg-gradient-to-r from-amber-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-400">Premium Member</p>
              <p className="text-xs text-slate-400">You enjoy exclusive discounts and priority service. Keep it up!</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick actions ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/dashboard/repairs',  label: 'Track Repair',     icon: Wrench,       color: 'text-blue-400   bg-blue-400/10   border-blue-400/20'   },
            { href: '/dashboard/orders',   label: 'My Orders',        icon: Package,      color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
            { href: '/dashboard/points',   label: 'Redeem Points',    icon: Zap,          color: 'text-amber-400  bg-amber-400/10  border-amber-400/20'  },
            { href: '/dashboard/reviews',  label: 'Write a Review',   icon: MessageSquare, color: 'text-violet-400 bg-violet-400/10 border-violet-400/20'  },
          ].map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                'group flex items-center gap-3 p-3.5 rounded-xl border bg-slate-800/50 hover:bg-slate-800 transition-all',
                color.split(' ').slice(2).join(' '),
              )}
            >
              <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', color.split(' ').slice(0, 2).join(' '))}>
                <Icon className={clsx('w-4 h-4', color.split(' ')[0])} />
              </div>
              <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Recent activity ─────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent repairs */}
        <section className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-400" /> Recent Repairs
            </h2>
            <Link href="/dashboard/repairs" className="text-xs text-primary hover:underline flex items-center gap-1">
              All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {repairItems.length === 0 ? (
            <EmptyState icon={<Wrench className="w-5 h-5" />} text="No repair tickets yet" />
          ) : (
            <ul className="space-y-2">
              {repairItems.map((r: any) => {
                const badge = REPAIR_BADGE[r.status];
                return (
                  <li key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-blue-400/10 border border-blue-400/20 flex items-center justify-center flex-shrink-0">
                      <Wrench className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{r.deviceModel ?? r.device ?? 'Device'}</p>
                      <p className="text-xs text-slate-500 truncate">{r.issue ?? r.repairType ?? '—'}</p>
                    </div>
                    {badge && (
                      <span className={clsx('flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border', badge.color)}>
                        {badge.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Recent orders */}
        <section className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-400" /> Recent Orders
            </h2>
            <Link href="/dashboard/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
              All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {orderItems.length === 0 ? (
            <EmptyState icon={<ShoppingBag className="w-5 h-5" />} text="No orders yet" />
          ) : (
            <ul className="space-y-2">
              {orderItems.map((o: any) => {
                const badge = ORDER_BADGE[o.status];
                return (
                  <li key={o.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        #{o.invoiceNumber ?? o.orderNumber ?? o.id?.slice(-8)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {o.createdAt ? format(new Date(o.createdAt), 'dd MMM yyyy') : '—'}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-semibold text-emerald-400">
                        LKR {Number(o.totalAmount ?? o.totalAmt ?? 0).toLocaleString()}
                      </p>
                      {badge && (
                        <span className={clsx('text-[11px] font-medium', badge.color.split(' ')[0])}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon, bg, label, value, sub, href }: {
  icon: React.ReactNode; bg: string; label: string;
  value: string | number; sub: React.ReactNode; href: string;
}) {
  return (
    <Link
      href={href}
      className="group card hover:border-slate-600 hover:-translate-y-0.5 transition-all block"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', bg)}>{icon}</div>
        <ArrowRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400 transition-colors" />
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      <div className="mt-1">{sub}</div>
    </Link>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-slate-600">
      <div className="opacity-40 mb-2">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}