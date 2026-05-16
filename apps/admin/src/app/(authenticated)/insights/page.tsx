'use client';
import { useQuery } from '@tanstack/react-query';
import { insightsApi, repairsApi, reservationsApi } from '@/lib/api';
import { format } from 'date-fns';

interface InsightCardProps {
  title: string;
  value: string | number;
  sub?: string;
  color?: string;
  loading?: boolean;
}

function InsightCard({ title, value, sub, color = 'text-slate-800', loading }: InsightCardProps) {
  return (
    <div className="card p-5 flex flex-col gap-1">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{title}</p>
      {loading ? (
        <div className="h-8 w-24 bg-slate-100 animate-pulse rounded" />
      ) : (
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
      )}
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export default function InsightsPage() {
  const { data: orderInsights, isLoading: ordersLoading } = useQuery({
    queryKey: ['insights-orders'],
    queryFn: () => insightsApi.summary().then(r => r.data),
    staleTime: 60_000,
  });

  const { data: failureStats, isLoading: failureLoading } = useQuery({
    queryKey: ['insights-failure'],
    queryFn: () => repairsApi.getFailureRate(90).then(r => r.data),
    staleTime: 60_000,
  });

  const { data: reservationsData, isLoading: resLoading } = useQuery({
    queryKey: ['insights-reservations'],
    queryFn: () => reservationsApi.list({ status: 'ACTIVE', limit: 1 }).then(r => r.data),
    staleTime: 60_000,
  });

  const revenueChange = orderInsights?.revenueChangePercent ?? 0;
  const revenueColor = revenueChange >= 0 ? 'text-emerald-600' : 'text-red-500';
  const changeLabel = revenueChange >= 0 ? `+${revenueChange.toFixed(1)}%` : `${revenueChange.toFixed(1)}%`;

  const topFailure = failureStats?.[0];
  const activeReservations = reservationsData?.total ?? reservationsData?.length ?? 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Business Insights</h1>
          <p className="page-subtitle">Updated {format(new Date(), 'dd MMM yyyy HH:mm')}</p>
        </div>
      </div>

      {/* Revenue section */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Revenue</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <InsightCard
            title="Revenue This Month"
            value={ordersLoading ? '…' : `LKR ${Number(orderInsights?.revenueCurrentMonth ?? 0).toLocaleString()}`}
            sub={ordersLoading ? undefined : orderInsights?.revenueVsPreviousLabel ?? 'vs last month'}
            loading={ordersLoading}
          />
          <InsightCard
            title="Month-over-Month Change"
            value={ordersLoading ? '…' : changeLabel}
            sub="vs previous 30 days"
            color={revenueColor}
            loading={ordersLoading}
          />
          <InsightCard
            title="Orders This Month"
            value={ordersLoading ? '…' : (orderInsights?.orderCountCurrentMonth ?? 0).toLocaleString()}
            sub="completed orders"
            loading={ordersLoading}
          />
          <InsightCard
            title="Avg Order Value"
            value={ordersLoading ? '…' : `LKR ${Number(orderInsights?.avgOrderValue ?? 0).toLocaleString()}`}
            loading={ordersLoading}
          />
        </div>
      </section>

      {/* Operations section */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Operations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InsightCard
            title="Top Selling Product"
            value={ordersLoading ? '…' : (orderInsights?.topSellingProduct?.productName ?? 'N/A')}
            sub="by quantity this month"
            loading={ordersLoading}
          />
          <InsightCard
            title="Void Rate"
            value={ordersLoading ? '…' : `${(orderInsights?.voidRatePercent ?? 0).toFixed(1)}%`}
            sub="of all orders voided (30 days)"
            color={(orderInsights?.voidRatePercent ?? 0) > 5 ? 'text-red-500' : 'text-slate-800'}
            loading={ordersLoading}
          />
          <InsightCard
            title="Active Reservations"
            value={resLoading ? '…' : activeReservations}
            sub="awaiting conversion or follow-up"
            color={activeReservations > 10 ? 'text-amber-500' : 'text-slate-800'}
            loading={resLoading}
          />
        </div>
      </section>

      {/* Repair section */}
      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Repair Performance (90 days)</h2>
        {failureLoading && (
          <div className="card p-6 text-center text-slate-400 animate-pulse">Loading failure stats…</div>
        )}
        {!failureLoading && (!failureStats || failureStats.length === 0) && (
          <div className="card p-6 text-center text-slate-400">No repair data available yet.</div>
        )}
        {!failureLoading && failureStats && failureStats.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  {['Device Model', 'Total Repairs', 'Returned / Re-opened', 'Failure Rate'].map(h => (
                    <th key={h} className="table-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {failureStats.map((row: any, i: number) => (
                  <tr key={i} className="table-tr">
                    <td className="table-td font-medium">{row.deviceModel}</td>
                    <td className="table-td">{row.totalRepairs}</td>
                    <td className="table-td">{row.failures}</td>
                    <td className="table-td">
                      <span className={`font-semibold ${Number(row.failureRate) > 15 ? 'text-red-500' : Number(row.failureRate) > 8 ? 'text-amber-500' : 'text-emerald-600'}`}>
                        {Number(row.failureRate).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
