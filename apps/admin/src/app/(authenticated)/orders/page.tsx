'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { ordersApi, fetchUserMap } from '@/lib/api';
import { format } from 'date-fns';
import Link from 'next/link';
import toast from 'react-hot-toast';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'badge-amber',
  PROCESSING: 'badge-blue',
  COMPLETED: 'badge-green',
  VOIDED: 'badge-red',
  REFUNDED: 'badge-purple',
};

export default function OrdersPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', { status, page, from, to }],
    queryFn: () => ordersApi.list({
      ...(status ? { status } : {}),
      page,
      limit: 20,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    }).then(r => r.data),
    refetchInterval: 20_000,
  });

  const { data: userMap = {} } = useQuery({
    queryKey: ['users-map'],
    queryFn: fetchUserMap,
    staleTime: 300_000,
  });

  const orders: any[] = data?.data ?? data ?? [];
  const total: number = data?.total ?? orders.length;

  const handleVoid = async () => {
    if (!voidId) return;
    setVoiding(true);
    try {
      await ordersApi.void(voidId, voidReason, user?.id ?? '');
      setVoidId(null);
      setVoidReason('');
      refetch();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to void order');
    } finally {
      setVoiding(false);
    }
  };

  const statusButtons = ['', 'PENDING', 'PROCESSING', 'COMPLETED', 'VOIDED', 'REFUNDED'];

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">{total.toLocaleString()} orders</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }}
            className="input flex-1 sm:w-36 sm:flex-none text-sm" />
          <span className="text-slate-400 text-sm shrink-0">–</span>
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }}
            className="input flex-1 sm:w-36 sm:flex-none text-sm" />
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {statusButtons.map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }}
            className={status === s ? 'tab-pill-on' : 'tab-pill-off'}>
            {s || 'All Statuses'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-card">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr>
              {['Order #', 'Date', 'Customer', 'Cashier', 'Items', 'Total', 'Status', ''].map(h => (
                <th key={h} className="table-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="table-td text-center text-slate-400 py-10">Loading…</td></tr>
            )}
            {!isLoading && orders.length === 0 && (
              <tr><td colSpan={8} className="table-td text-center text-slate-400 py-10">No orders found</td></tr>
            )}
            {orders.map((o: any) => (
              <tr key={o.id} className="table-tr">
                <td className="table-td font-mono font-semibold text-primary">{o.orderNumber}</td>
                <td className="table-td text-slate-500">
                  {format(new Date(o.createdAt), 'dd MMM yyyy HH:mm')}
                </td>
                <td className="table-td">
                  {o.customer ? (
                    <span>
                      <span className="font-medium">{o.customer.name}</span>
                      {' '}<span className="text-slate-400 text-xs">(Registered · {o.customer.tier ?? 'Standard'})</span>
                    </span>
                  ) : (
                    <span>
                      <span className="font-medium">{o.walkInName || 'Walk-in Customer'}</span>
                      {' '}<span className="text-slate-400 text-xs">(Walk-in)</span>
                    </span>
                  )}
                </td>
                <td className="table-td">{o.cashier?.name ?? userMap[o.cashierId] ?? o.cashierId}</td>
                <td className="table-td text-center">{o.items?.length ?? '—'}</td>
                <td className="table-td font-semibold">LKR {Number(o.totalAmt ?? o.totalAmount ?? 0).toLocaleString()}</td>
                <td className="table-td">
                  <span className={`badge ${STATUS_COLORS[o.status] ?? 'badge-gray'}`}>{o.status}</span>
                </td>
                <td className="table-td">
                  <div className="flex gap-2">
                    <Link href={`/orders/${o.id}`}
                      className="text-xs text-primary hover:underline">View</Link>
                    {(o.status === 'PENDING' || o.status === 'PROCESSING') && (
                      <button onClick={() => setVoidId(o.id)}
                        className="text-xs text-red-500 hover:underline">Void</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-between px-1 py-1">
          <span className="text-xs text-slate-400 tabular">Page {page} · {total.toLocaleString()} total</span>
          <div className="flex gap-1.5">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="page-btn">← Prev</button>
            <button disabled={orders.length < 20} onClick={() => setPage(p => p + 1)}
              className="page-btn">Next →</button>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {voidId && (
        <div className="modal-overlay" onClick={() => setVoidId(null)}>
          <div className="modal-panel max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 className="modal-title">Void Order</h3>
              <button onClick={() => setVoidId(null)} className="btn-icon text-slate-400"><span className="text-lg leading-none">×</span></button>
            </div>
            <div className="modal-body space-y-4">
              <p className="text-sm text-slate-500">This action cannot be undone. Please provide a reason.</p>
              <div>
                <label className="label">Reason</label>
                <input type="text" value={voidReason} onChange={e => setVoidReason(e.target.value)}
                  className="input" placeholder="e.g. Customer cancelled" />
              </div>
            </div>
            <div className="modal-ft">
              <button onClick={handleVoid} disabled={!voidReason.trim() || voiding}
                className="btn-danger flex-1">
                {voiding ? 'Voiding…' : 'Confirm Void'}
              </button>
              <button onClick={() => setVoidId(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
