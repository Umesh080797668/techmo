'use client';
import { useQuery } from '@tanstack/react-query';
import { ordersApi, inventoryApi, repairsApi, customersApi, insightsApi, reservationsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  DollarSign, Receipt, Star, Wrench, CalendarDays, TrendingUp, TrendingDown,
  Trophy, Calendar, CheckCircle2, ShoppingCart, UserPlus, Package,
  Lightbulb, BarChart2, type LucideIcon,
} from 'lucide-react';

function StatCard({ title, value, sub, icon: Icon, color, iconColor = 'text-slate-600' }: {
  title: string; value: string | number; sub?: string;
  icon: LucideIcon; color: string; iconColor?: string;
}) {
  return (
    <div className="card p-5 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-card-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.08em] mb-1.5">{title}</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 tabular font-display leading-none">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-1.5 font-medium">{sub}</p>}
        </div>
        <div className={`stat-icon ${color}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  const today = new Date();
  const from = format(startOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");
  const to   = format(endOfDay(today),   "yyyy-MM-dd'T'HH:mm:ss");

  const { data: salesSummary } = useQuery({
    queryKey: ['sales-summary', from, to],
    queryFn: () => ordersApi.summary({ from, to }).then(r => r.data),
    refetchInterval: 15_000,
  });

  // Build last 7 days chart data
  const chartDays = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(today, 6 - i);
    return format(d, 'EEE');
  });

  const { data: chartData } = useQuery({
    queryKey: ['revenue-chart'],
    refetchInterval: 15_000,
    queryFn: async () => {
      const results = await Promise.all(
        Array.from({ length: 7 }, (_, i) => {
          const d = subDays(today, 6 - i);
          return ordersApi.summary({
            from: format(startOfDay(d), "yyyy-MM-dd'T'HH:mm:ss"),
            to: format(endOfDay(d), "yyyy-MM-dd'T'HH:mm:ss"),
          }).then(r => ({ day: format(d, 'EEE'), revenue: r.data?.totalRevenue ?? 0 }));
        })
      );
      return results;
    },
  });

  const { data: lowStockRes } = useQuery({
    queryKey: ['low-stock'],
    queryFn: () => inventoryApi.list({ lowStockOnly: true, limit: 5 }).then(r => r.data),
    refetchInterval: 15_000,
  });

  const { data: activeRepairs } = useQuery({
    queryKey: ['repairs-active'],
    queryFn: () => repairsApi.list({ status: 'UNDER_REPAIR', limit: 5 }).then(r => r.data),
    refetchInterval: 15_000,
  });

  const { data: recentOrders } = useQuery({
    queryKey: ['recent-orders'],
    queryFn: () => ordersApi.list({ limit: 5, page: 1 }).then(r => r.data),
    refetchInterval: 15_000,
  });

  const { data: bizInsights } = useQuery({
    queryKey: ['dashboard-insights'],
    queryFn: () => insightsApi.summary().then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  const { data: activeReservations } = useQuery({
    queryKey: ['dashboard-reservations'],
    queryFn: () => reservationsApi.list({ status: 'ACTIVE', limit: 5 }).then(r => r.data),
    refetchInterval: 30_000,
  });

  const reservationList: any[] = activeReservations?.data ?? (Array.isArray(activeReservations) ? activeReservations : []);
  const reservationTotal: number = activeReservations?.total ?? reservationList.length;

  const stats = salesSummary ?? {};
  const revenue = stats.totalRevenue ?? 0;
  const orderCount = stats.orderCount ?? 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-display" style={{ letterSpacing: '-0.025em' }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.username}!
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Here's what's happening today.</p>
        </div>
        <span className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl ring-1 ring-blue-200/70">
          {new Date().toLocaleDateString('en-LK', { weekday: 'long', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* Stats row 1 — today */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Revenue"
          value={`LKR ${Number(revenue).toLocaleString()}`}
          sub={`${orderCount} orders`}
          icon={DollarSign}
          color="stat-icon-green"
          iconColor="text-emerald-600"
        />
        <StatCard
          title="Tax Collected"
          value={`LKR ${Number(stats.totalTax ?? 0).toLocaleString()}`}
          sub="5% VAT"
          icon={Receipt}
          color="stat-icon-blue"
          iconColor="text-blue-600"
        />
        <StatCard
          title="Discounts Given"
          value={`LKR ${Number(stats.totalDiscount ?? 0).toLocaleString()}`}
          sub="Loyalty redemptions"
          icon={Star}
          color="stat-icon-amber"
          iconColor="text-amber-600"
        />
        <StatCard
          title="Active Repairs"
          value={(activeRepairs?.data ?? activeRepairs ?? []).length}
          sub="Under repair"
          icon={Wrench}
          color="stat-icon-purple"
          iconColor="text-purple-600"
        />
      </div>

      {/* Stats row 2 — monthly insights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Revenue This Month"
          value={bizInsights ? `LKR ${Number(bizInsights.revenueCurrentMonth ?? 0).toLocaleString()}` : '…'}
          sub={bizInsights?.revenueVsPreviousLabel ?? 'vs last month'}
          icon={CalendarDays}
          color="stat-icon-indigo"
          iconColor="text-indigo-600"
        />
        <StatCard
          title="Month-over-Month"
          value={bizInsights ? `${(bizInsights.revenueChangePercent ?? 0) >= 0 ? '+' : ''}${Number(bizInsights.revenueChangePercent ?? 0).toFixed(1)}%` : '…'}
          sub="revenue change"
          icon={bizInsights && (bizInsights.revenueChangePercent ?? 0) >= 0 ? TrendingUp : TrendingDown}
          color={(bizInsights?.revenueChangePercent ?? 0) >= 0 ? 'stat-icon-green' : 'stat-icon-red'}
          iconColor={(bizInsights?.revenueChangePercent ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}
        />
        <StatCard
          title="Top Product"
          value={bizInsights?.topSellingProduct?.productName ?? '—'}
          sub={bizInsights?.topSellingProduct ? `${bizInsights.topSellingProduct.sold} sold · ${bizInsights.topSellingProduct.sku}` : 'best seller this month'}
          icon={Trophy}
          color="stat-icon-amber"
          iconColor="text-amber-600"
        />
        <StatCard
          title="Active Reservations"
          value={reservationTotal}
          sub="awaiting conversion"
          icon={Calendar}
          color={reservationTotal > 10 ? 'stat-icon-rose' : 'stat-icon-teal'}
          iconColor={reservationTotal > 10 ? 'text-rose-500' : 'text-teal-600'}
        />
      </div>

      {/* Revenue Chart */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-slate-900 text-[15px]" style={{ letterSpacing: '-0.015em' }}>Revenue — Last 7 Days</h3>
            <p className="text-xs text-slate-400 mt-0.5">Daily totals in LKR</p>
          </div>
          <span className="badge badge-blue">7-day view</span>
        </div>
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={chartData ?? chartDays.map(day => ({ day, revenue: 0 }))} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="#3b82f6" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(241,245,249,0.9)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
              domain={[0, 200000]}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(226,232,240,0.85)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', fontSize: 12 }}
              formatter={(val: any) => [`LKR ${Number(val).toLocaleString()}`, 'Revenue']}
            />
            <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5}
              fill="url(#revGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Orders</h3>
            <Link href="/orders" className="card-link">View all →</Link>
          </div>
          <div className="divide-y divide-slate-50/80">
            {((recentOrders?.data ?? recentOrders) as any[] ?? []).slice(0, 5).map((o: any) => (
              <div key={o.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-blue-50/30 transition-colors duration-100">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{o.orderNumber}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{o.customer?.name ?? 'Walk-in'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900 tabular">
                    LKR {Number(o.totalAmt ?? o.totalAmount ?? 0).toLocaleString()}
                  </p>
                  <span className={`badge mt-1 ${o.status === 'COMPLETED' ? 'badge-green' : o.status === 'PENDING' ? 'badge-amber' : 'badge-red'}`}>
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
            {!recentOrders && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Loading…</div>
            )}
          </div>
        </div>

        {/* Active Reservations */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" /> Active Reservations</h3>
            <Link href="/reservations" className="text-xs text-primary font-semibold hover:underline">Manage →</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {!activeReservations && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Loading…</div>
            )}
            {activeReservations && reservationList.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">No active reservations</div>
            )}
            {reservationList.slice(0, 5).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{r.customerName}</p>
                  <p className="text-xs text-slate-400">{r.productName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800">
                    {r.quantity} × LKR {Number(r.unitPrice).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400">Expires {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : '—'}</p>
                </div>
              </div>
            ))}
            {reservationTotal > 5 && (
              <div className="px-5 py-3 text-center">
                <Link href="/reservations" className="text-xs text-primary hover:underline">
                  +{reservationTotal - 5} more →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Low Stock Alerts</h3>
            <Link href="/inventory" className="card-link">Manage →</Link>
          </div>
          <div className="divide-y divide-slate-50/80">
            {((lowStockRes?.data ?? lowStockRes) as any[] ?? []).slice(0, 5).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-amber-50/40 transition-colors duration-100">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.sku}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.productId}</p>
                </div>
                <div className="text-right">
                  <span className="badge badge-amber">{item.quantity} left</span>
                  <p className="text-xs text-slate-400 mt-1">min: {item.lowStockThreshold}</p>
                </div>
              </div>
            ))}
            {!lowStockRes && (
              <div className="px-5 py-8 text-center text-sm text-slate-400">Loading…</div>
            )}
            {lowStockRes && ((lowStockRes?.data ?? lowStockRes) as any[]).length === 0 && (
              <div className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-emerald-600 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> All stock levels are healthy
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-5">
        <h3 className="card-title mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-2.5">
          {[
            { href: '/pos',            label: 'New Sale',          Icon: ShoppingCart, color: 'btn-primary' },
            { href: '/repairs?new=1',  label: 'New Repair Ticket', Icon: Wrench,        color: 'btn-secondary' },
            { href: '/customers?new=1',label: 'Add Customer',      Icon: UserPlus,      color: 'btn-secondary' },
            { href: '/inventory',      label: 'Adjust Stock',      Icon: Package,       color: 'btn-secondary' },
            { href: '/reservations',   label: 'Reservations',      Icon: Calendar,      color: 'btn-secondary' },
            { href: '/insights',       label: 'Business Insights', Icon: Lightbulb,     color: 'btn-secondary' },
            { href: '/reports',        label: 'Sales Report',      Icon: BarChart2,     color: 'btn-secondary' },
          ].map(a => (
            <Link key={a.href} href={a.href}
              className={`${a.color} flex items-center justify-center sm:justify-start gap-2`}>
              <a.Icon className="w-4 h-4 shrink-0" /> <span className="truncate">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
