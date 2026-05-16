'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { myOrdersApi } from '@/lib/api';
import { format } from 'date-fns';
import { ShoppingBag, Search, FileText, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

const STATUS_COLOR: Record<string, string> = {
  PENDING:    'badge-warning',
  PROCESSING: 'badge-info',
  COMPLETED:  'badge-success',
  CANCELLED:  'badge-danger',
  REFUNDED:   'badge-danger',
};

export default function OrdersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['my-orders', status],
    queryFn: () => myOrdersApi.list({ status: status || undefined }).then(r => r.data),
  });

  const items: any[] = (data?.items ?? []).filter((o: any) =>
    !search ||
    o.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
    o.items?.some((i: any) => i.productName?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-white">Order History</h1>
          <p className="text-sm text-slate-400 mt-1">View all your past purchases and download invoices.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            className="input pl-9"
            placeholder="Search by invoice number or product…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input sm:w-48" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLOR).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-slate-500">
          <ShoppingBag className="w-10 h-10 opacity-20 mb-3" />
          <p className="font-medium">No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((order: any) => (
            <OrderCard
              key={order.id}
              order={order}
              isExpanded={expanded === order.id}
              onToggle={() => setExpanded(expanded === order.id ? null : order.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, isExpanded, onToggle }: {
  order: any; isExpanded: boolean; onToggle: () => void;
}) {
  // Normalise field names — API returns totalAmt / discountAmt / taxAmt / orderNumber
  const totalAmount  = order.totalAmount  ?? order.totalAmt   ?? 0;
  const discountAmt  = order.discount     ?? order.discountAmt ?? 0;
  const taxAmt       = order.tax          ?? order.taxAmt      ?? 0;
  const pointsEarned = order.pointsEarned ?? order.loyaltyPtsEarned ?? 0;
  const invoiceNumber = order.invoiceNumber ?? order.orderNumber ?? order.id?.slice(-8).toUpperCase();

  return (
    <div className="card">
      <button onClick={onToggle} className="w-full flex items-center gap-4 text-left">
        <div className="w-10 h-10 rounded-lg bg-slate-700/60 flex items-center justify-center flex-shrink-0">
          <ShoppingBag className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">
              #{invoiceNumber}
            </p>
            <span className={clsx('badge', STATUS_COLOR[order.status] ?? 'badge-info')}>
              {order.status}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {order.createdAt ? format(new Date(order.createdAt), 'dd MMM yyyy, h:mm a') : '—'}
            {' · '}{order.items?.length ?? 0} item{order.items?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="text-right flex-shrink-0 mr-2">
          <p className="text-sm font-semibold text-white">
            LKR {Number(totalAmount).toLocaleString()}
          </p>
          {pointsEarned > 0 && (
            <p className="text-xs text-amber-400">+{pointsEarned} pts</p>
          )}
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {isExpanded && (
        <div className="mt-5 pt-5 border-t border-slate-700/50 space-y-4">
          {/* Line items */}
          {order.items?.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th text-left">Product</th>
                  <th className="table-th text-right">Qty</th>
                  <th className="table-th text-right">Price</th>
                  <th className="table-th text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-700/30 last:border-0">
                    <td className="table-td">
                      <p className="text-white">{item.productName ?? item.name ?? '—'}</p>
                      {item.imei && <p className="text-[11px] text-slate-500 mt-0.5">IMEI: {item.imei}</p>}
                    </td>
                    <td className="table-td text-right text-slate-300">{item.quantity}</td>
                    <td className="table-td text-right text-slate-300">
                      LKR {Number(item.unitPrice ?? 0).toLocaleString()}
                    </td>
                    <td className="table-td text-right text-white font-medium">
                      LKR {Number(item.lineTotal ?? ((item.quantity ?? 1) * (item.unitPrice ?? 0))).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Totals */}
          <div className="flex flex-col items-end gap-1 text-sm">
            {Number(discountAmt) > 0 && (
              <div className="flex gap-6 text-slate-400">
                <span>Discount</span>
                <span className="text-red-400">- LKR {Number(discountAmt).toLocaleString()}</span>
              </div>
            )}
            {Number(taxAmt) > 0 && (
              <div className="flex gap-6 text-slate-400">
                <span>Tax</span>
                <span>LKR {Number(taxAmt).toLocaleString()}</span>
              </div>
            )}
            <div className="flex gap-6 font-semibold text-white border-t border-slate-700 pt-2 mt-1">
              <span>Total</span>
              <span>LKR {Number(totalAmount).toLocaleString()}</span>
            </div>
          </div>

          {/* Invoice PDF link */}
          {order.invoicePdfUrl && (
            <a
              href={order.invoicePdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary inline-flex items-center gap-2 text-sm"
            >
              <FileText className="w-4 h-4" />
              Download Invoice
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
