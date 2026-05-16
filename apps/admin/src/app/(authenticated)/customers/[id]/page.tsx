'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi, ordersApi, repairsApi } from '@/lib/api';
import { format } from 'date-fns';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { ArrowLeft, Star, Phone, Mail, MapPin, ShoppingBag, Wrench, TrendingUp, Edit2 } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

const TIER_BG: Record<string, string> = {
  STANDARD: 'bg-slate-600/30 text-slate-300',
  PREMIUM:  'bg-amber-500/20 text-amber-400',
};

const TX_SIGN: Record<string, string> = { EARN: '+', REDEEM: '−', BONUS: '+', EXPIRE: '−', ADJUST: '±' };
const TX_COLOR: Record<string, string> = {
  EARN: 'text-emerald-400', REDEEM: 'text-red-400',
  BONUS: 'text-amber-400', EXPIRE: 'text-slate-500', ADJUST: 'text-blue-400',
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const router = useRouter();
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [pointsModal, setPointsModal] = useState(false);
  const [pointsAction, setPointsAction] = useState<'earn' | 'redeem' | 'adjust'>('adjust');
  const [pointsAmount, setPointsAmount] = useState('');
  const [pointsNote, setPointsNote] = useState('');
  const [activeTab, setActiveTab] = useState<'orders' | 'repairs' | 'transactions'>('orders');

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.get(id).then(r => r.data),
  });

  const { data: txData } = useQuery({
    queryKey: ['customer-tx', id],
    queryFn: () => customersApi.transactions(id).then(r => r.data),
    enabled: activeTab === 'transactions',
  });

  const { data: ordersData } = useQuery({
    queryKey: ['customer-orders', id],
    queryFn: () => ordersApi.list({ customerId: id, limit: 20 }).then(r => r.data),
    enabled: activeTab === 'orders',
  });

  const { data: repairsData } = useQuery({
    queryKey: ['customer-repairs', id],
    queryFn: () => repairsApi.list({ customerPhone: customer?.phone, limit: 20 }).then(r => r.data),
    enabled: activeTab === 'repairs' && !!customer?.phone,
  });

  const updateMutation = useMutation({
    mutationFn: () => customersApi.update(id, editForm),
    onSuccess: () => { toast.success('Customer updated'); qc.invalidateQueries({ queryKey: ['customer', id] }); setEditModal(false); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Update failed'),
  });

  const pointsMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(pointsAmount);
      if (pointsAction === 'earn') return customersApi.earnPoints({ customerId: id, points: amt, reference: pointsNote || 'MANUAL' });
      if (pointsAction === 'redeem') return customersApi.redeemPoints({ customerId: id, points: amt, reference: pointsNote || 'MANUAL' });
      return customersApi.adjustPoints({ customerId: id, adjustment: amt, reason: pointsNote });
    },
    onSuccess: () => {
      toast.success('Points updated');
      qc.invalidateQueries({ queryKey: ['customer', id] });
      qc.invalidateQueries({ queryKey: ['customer-tx', id] });
      setPointsModal(false); setPointsAmount(''); setPointsNote('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="skeleton h-8 w-64 rounded" />
      <div className="skeleton h-40 rounded-2xl" />
      <div className="skeleton h-64 rounded-2xl" />
    </div>
  );

  if (!customer) return (
    <div className="text-center py-20 text-slate-500">
      <p className="font-medium">Customer not found</p>
      <Link href="/customers" className="text-indigo-500 text-sm mt-2 hover:underline block">← Back to Customers</Link>
    </div>
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/customers" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Customers
        </Link>
        <span className="text-slate-600">/</span>
        <span className="text-sm text-slate-300 font-medium">{customer.name}</span>
      </div>

      {/* Header card */}
      <div className="card flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-indigo-500/20 flex items-center justify-center text-2xl font-bold text-indigo-400 flex-shrink-0">
          {customer.name?.charAt(0)?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="page-title">{customer.name}</h1>
            <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold uppercase', TIER_BG[customer.tier] ?? TIER_BG.STANDARD)}>
              {customer.tier}
            </span>
          </div>
          <div className="flex flex-wrap gap-4 mt-1.5 text-sm text-slate-500">
            <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{customer.phone}</span>
            {customer.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{customer.email}</span>}
            {customer.address && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{customer.address}</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <Star className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-semibold text-slate-700">{(customer.loyaltyPoints ?? 0).toLocaleString()} points</span>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => { setEditForm({ name: customer.name, email: customer.email ?? '', address: customer.address ?? '' }); setEditModal(true); }}
            className="btn-secondary flex items-center gap-1.5 text-sm">
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
          <button onClick={() => setPointsModal(true)}
            className="btn-primary flex items-center gap-1.5 text-sm">
            <TrendingUp className="w-3.5 h-3.5" /> Points
          </button>
        </div>
      </div>

      {/* Stats mini row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Orders', value: ordersData?.total ?? '—', icon: <ShoppingBag className="w-4 h-4 text-emerald-500" /> },
          { label: 'Repairs', value: repairsData?.total ?? '—', icon: <Wrench className="w-4 h-4 text-indigo-500" /> },
          { label: 'Member Since', value: customer.createdAt ? format(new Date(customer.createdAt), 'MMM yyyy') : '—', icon: <Star className="w-4 h-4 text-amber-500" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="card flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">{icon}</div>
            <div>
              <p className="modal-title">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex border-b border-slate-200 mb-4 gap-1 overflow-x-auto">
          {(['orders', 'repairs', 'transactions'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={clsx('px-4 py-2 text-sm font-medium capitalize rounded-t-lg transition-colors',
                activeTab === tab ? 'text-indigo-600 border-b-2 border-indigo-600 -mb-px' : 'text-slate-500 hover:text-slate-700'
              )}>
              {tab === 'transactions' ? 'Loyalty Transactions' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Orders */}
        {activeTab === 'orders' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr>
                <th className="table-th text-left">Invoice</th>
                <th className="table-th text-left">Date</th>
                <th className="table-th text-right">Amount</th>
                <th className="table-th text-right">Pts Earned</th>
                <th className="table-th">Status</th>
              </tr></thead>
              <tbody>
                {(ordersData?.items ?? ordersData?.data ?? []).map((o: any) => (
                  <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="table-td font-mono text-xs">#{o.invoiceNumber ?? o.id?.slice(-8).toUpperCase()}</td>
                    <td className="table-td text-slate-500">{o.createdAt ? format(new Date(o.createdAt), 'dd MMM yyyy') : '—'}</td>
                    <td className="table-td text-right font-medium">LKR {(o.totalAmount ?? 0).toLocaleString()}</td>
                    <td className="table-td text-right text-amber-600">+{o.pointsEarned ?? 0}</td>
                    <td className="table-td text-center"><span className="badge badge-success">{o.status}</span></td>
                  </tr>
                ))}
                {!(ordersData?.items ?? ordersData?.data ?? []).length && (
                  <tr><td colSpan={5} className="table-td text-center text-slate-400 py-8">No orders yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Repairs */}
        {activeTab === 'repairs' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr>
                <th className="table-th text-left">Device</th>
                <th className="table-th text-left">Issue</th>
                <th className="table-th text-left">Date</th>
                <th className="table-th text-right">Cost</th>
                <th className="table-th">Status</th>
              </tr></thead>
              <tbody>
                {(repairsData?.items ?? repairsData?.data ?? []).map((r: any) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="table-td font-medium">{r.deviceModel ?? '—'}</td>
                    <td className="table-td text-slate-600">{r.issue ?? r.repairType ?? '—'}</td>
                    <td className="table-td text-slate-500">{r.createdAt ? format(new Date(r.createdAt), 'dd MMM yyyy') : '—'}</td>
                    <td className="table-td text-right">LKR {(r.estimatedCost ?? r.finalCost ?? 0).toLocaleString()}</td>
                    <td className="table-td text-center"><span className="badge badge-info">{r.status?.replace('_', ' ')}</span></td>
                  </tr>
                ))}
                {!(repairsData?.items ?? repairsData?.data ?? []).length && (
                  <tr><td colSpan={5} className="table-td text-center text-slate-400 py-8">No repairs found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Loyalty transactions */}
        {activeTab === 'transactions' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr>
                <th className="table-th text-left">Date</th>
                <th className="table-th text-left">Description</th>
                <th className="table-th text-left">Type</th>
                <th className="table-th text-right">Points</th>
                <th className="table-th text-right">Balance</th>
              </tr></thead>
              <tbody>
                {(txData?.items ?? txData?.data ?? []).map((tx: any) => (
                  <tr key={tx.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="table-td text-slate-500 text-xs">{tx.createdAt ? format(new Date(tx.createdAt), 'dd MMM yyyy, HH:mm') : '—'}</td>
                    <td className="table-td">{tx.description ?? tx.type}</td>
                    <td className="table-td"><span className="badge badge-info">{tx.type}</span></td>
                    <td className={clsx('table-td text-right font-semibold', TX_COLOR[tx.type] ?? 'text-slate-600')}>
                      {TX_SIGN[tx.type] ?? ''}{Math.abs(tx.points).toLocaleString()}
                    </td>
                    <td className="table-td text-right text-slate-600">{tx.balance?.toLocaleString() ?? '—'}</td>
                  </tr>
                ))}
                {!(txData?.items ?? txData?.data ?? []).length && (
                  <tr><td colSpan={5} className="table-td text-center text-slate-400 py-8">No transactions yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="modal-title mb-4">Edit Customer</h2>
            <div className="space-y-3">
              {['name', 'email', 'address'].map(field => (
                <div key={field}>
                  <label className="label capitalize">{field}</label>
                  <input className="input" value={editForm[field] ?? ''} onChange={e => setEditForm({ ...editForm, [field]: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => updateMutation.mutate()} className="btn-primary flex-1" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Points Modal */}
      {pointsModal && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="modal-title mb-4">Manage Points</h2>
            <p className="text-sm text-slate-500 mb-4">Current: <strong className="text-slate-700">{(customer.loyaltyPoints ?? 0).toLocaleString()}</strong> pts</p>
            <div className="space-y-3">
              <div>
                <label className="label">Action</label>
                <select className="input" value={pointsAction} onChange={e => setPointsAction(e.target.value as any)}>
                  <option value="earn">Earn</option>
                  <option value="redeem">Redeem</option>
                  <option value="adjust">Manual Adjust</option>
                </select>
              </div>
              <div>
                <label className="label">Points</label>
                <input className="input" type="number" min="1" value={pointsAmount} onChange={e => setPointsAmount(e.target.value)} placeholder="e.g. 500" />
              </div>
              <div>
                <label className="label">Note / Reason</label>
                <input className="input" value={pointsNote} onChange={e => setPointsNote(e.target.value)} placeholder="Reason…" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => pointsMutation.mutate()} className="btn-primary flex-1" disabled={pointsMutation.isPending || !pointsAmount}>
                {pointsMutation.isPending ? 'Saving…' : 'Apply'}
              </button>
              <button onClick={() => setPointsModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
