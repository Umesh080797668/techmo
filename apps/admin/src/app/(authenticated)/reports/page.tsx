'use client';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ordersApi, repairsApi, inventoryApi, workerApi } from '@/lib/api';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { DollarSign, Receipt, Tag, TrendingUp, BarChart2, type LucideIcon } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#1e40af', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export default function ReportsPage() {
  const today = new Date();
  const [from, setFrom] = useState(format(subDays(today, 29), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(today, 'yyyy-MM-dd'));

  // Queries
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['reports-summary', from, to],
    queryFn: () => ordersApi.summary({ from, to }).then(r => r.data),
  });

  const { data: ordersData } = useQuery({
    queryKey: ['reports-orders', from, to],
    queryFn: () => ordersApi.list({ from, to, limit: 500, status: 'COMPLETED' }).then(r => r.data),
  });

  const { data: repairsData } = useQuery({
    queryKey: ['reports-repairs', from, to],
    queryFn: () => repairsApi.list({ limit: 500 }).then(r => r.data),
  });

  const { data: lowStockData } = useQuery({
    queryKey: ['reports-lowstock'],
    queryFn: () => inventoryApi.list({ lowStockOnly: true, limit: 20 }).then(r => r.data),
  });

  // Build daily revenue chart from orders
  const dailyRevenue = useMemo(() => {
    const orders: any[] = ordersData?.data ?? ordersData ?? [];
    const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayOrders = orders.filter(o => o.createdAt?.startsWith(dayStr));
      const revenue = dayOrders.reduce((s: number, o: any) => s + Number(o.totalAmt ?? 0), 0);
      const orders_count = dayOrders.length;
      return { date: format(day, 'dd MMM'), revenue, orders: orders_count };
    });
  }, [ordersData, from, to]);

  // Payment method breakdown
  const paymentBreakdown = useMemo(() => {
    const orders: any[] = ordersData?.data ?? ordersData ?? [];
    const map: Record<string, number> = {};
    orders.forEach((o: any) => {
      const m = o.paymentMethod ?? 'UNKNOWN';
      map[m] = (map[m] ?? 0) + Number(o.totalAmt ?? 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [ordersData]);

  // Repair status breakdown
  const repairBreakdown = useMemo(() => {
    const repairs: any[] = repairsData?.data ?? repairsData ?? [];
    const map: Record<string, number> = {};
    repairs.forEach((r: any) => { map[r.status] = (map[r.status] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [repairsData]);

  const summary = summaryData ?? {};
  const lowStock: any[] = lowStockData?.data ?? lowStockData ?? [];

  const dailyPulseMutation = useMutation({
    mutationFn: () => {
      const orders: any[] = ordersData?.data ?? ordersData ?? [];
      const repairs: any[] = repairsData?.data ?? repairsData ?? [];
      const completedRepairs = repairs.filter((r: any) => r.status === 'COMPLETED').length;
      const totalRevenue = orders.reduce((s: number, o: any) => s + Number(o.totalAmt ?? 0), 0);

      // Build top products from order line items
      const productMap: Record<string, { name: string; qty_sold: number; revenue: number }> = {};
      orders.forEach((o: any) => {
        (o.items ?? o.orderItems ?? []).forEach((item: any) => {
          const name = item.product?.name ?? item.productName ?? item.name ?? 'Unknown';
          if (!productMap[name]) productMap[name] = { name, qty_sold: 0, revenue: 0 };
          productMap[name].qty_sold += Number(item.quantity ?? 1);
          productMap[name].revenue += Number(item.lineTotal ?? item.line_total ?? 0);
        });
      });
      const topProducts = Object.values(productMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      return workerApi.dailyPulsePdf({
        date: format(new Date(), 'yyyy-MM-dd'),
        branch: 'Main Branch',
        generated_by: 'Admin',
        total_sales: totalRevenue,
        total_transactions: orders.length,
        total_repairs_completed: completedRepairs,
        battery_alerts: lowStock.length,
        top_products: topProducts,
      });
    },
    onSuccess: (res) => {
      const url: string = res.data?.url;
      if (url) window.open(url, '_blank');
      else toast.error('No PDF URL returned');
    },
    onError: () => toast.error('Daily Pulse PDF generation failed'),
  });

  const quickRanges = [
    { label: 'Today', from: format(today, 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') },
    { label: '7 Days', from: format(subDays(today, 6), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') },
    { label: '30 Days', from: format(subDays(today, 29), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') },
    { label: 'This Month', from: format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header + date picker */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Reports</h1>
          <p className="page-subtitle">Revenue, orders &amp; performance analytics</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => dailyPulseMutation.mutate()}
            disabled={dailyPulseMutation.isPending || summaryLoading}
            className="btn-secondary text-sm text-violet-700 border-violet-200 hover:bg-violet-50 disabled:opacity-50 flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4" /> {dailyPulseMutation.isPending ? 'Generating…' : 'Daily Pulse PDF'}
          </button>
          <div className="flex gap-1.5 flex-wrap">
            {quickRanges.map(r => (
              <button key={r.label}
                onClick={() => { setFrom(r.from); setTo(r.to); }}
                className={(from === r.from && to === r.to) ? 'tab-pill-on' : 'tab-pill-off'}>{r.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input flex-1 sm:flex-none sm:w-36 text-sm" />
            <span className="text-slate-400 shrink-0">—</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input flex-1 sm:flex-none sm:w-36 text-sm" />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `LKR ${fmt(Number(summary.totalRevenue ?? 0))}`, sub: `${summary.orderCount ?? 0} orders`, color: 'text-primary', Icon: DollarSign },
          { label: 'Tax Collected', value: `LKR ${fmt(Number(summary.totalTax ?? 0))}`, sub: 'VAT (5%)', color: 'text-red-500', Icon: Receipt },
          { label: 'Discounts Given', value: `LKR ${fmt(Number(summary.totalDiscount ?? 0))}`, sub: 'Loyalty redemptions', color: 'text-amber-600', Icon: Tag },
          { label: 'Avg Order Value', value: `LKR ${fmt(summary.orderCount ? Math.round(Number(summary.totalRevenue) / summary.orderCount) : 0)}`, sub: 'Per completed order', color: 'text-green-600', Icon: TrendingUp },
        ].map(c => (
          <div key={c.label} className="card p-5">
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs text-slate-500">{c.label}</p>
              <span className="text-slate-400"><c.Icon className="w-5 h-5" /></span>
            </div>
            <p className={`text-xl font-bold ${c.color}`}>{summaryLoading ? '—' : c.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-700 mb-4">Daily Revenue</h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={dailyRevenue}>
            <defs>
              <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1e40af" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#1e40af" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => `LKR ${Number(v).toLocaleString()}`} />
            <Area type="monotone" dataKey="revenue" stroke="#1e40af" fill="url(#gradRevenue)" strokeWidth={2} name="Revenue" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row: payment breakdown + repair status + low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Payment Method Pie */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Revenue by Payment</h3>
          {paymentBreakdown.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={paymentBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" nameKey="name">
                  {paymentBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => `LKR ${Number(v).toLocaleString()}`} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Repair Status Bar */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Repairs by Status</h3>
          {repairBreakdown.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={repairBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={100} />
                <Tooltip />
                <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Low Stock Alerts</h3>
          {lowStock.length === 0 && (
            <div className="h-48 flex items-center justify-center">
              <p className="text-green-600 text-sm font-medium">✓ All stock levels OK</p>
            </div>
          )}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {lowStock.map((item: any) => (
              <div key={item.id} className="flex justify-between items-center py-1.5 border-b border-slate-50 text-sm">
                <div>
                  <p className="font-medium text-slate-700">{item.product?.name ?? item.sku}</p>
                  <p className="text-xs text-slate-400 font-mono">{item.sku}</p>
                </div>
                <div className="text-right">
                  <span className="badge badge-red">{item.quantity} left</span>
                  <p className="text-xs text-slate-400 mt-0.5">Min: {item.reorderThreshold}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
