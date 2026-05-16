'use client';

/**
 * Transfer Marketplace — Admin Page
 * ===================================
 * Route: /admin/(authenticated)/inventory/transfers
 *
 * Full CRUD for inter-branch stock transfer requests.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { transfersApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { ClipboardList, CheckCircle2, XCircle, Truck, Package, Ban, Store, ArrowLeftRight, Plus, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type TransferStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

interface Transfer {
  id:           string;
  fromBranchId: string;
  toBranchId:   string;
  productName:  string;
  qty:          number;
  status:       TransferStatus;
  requestedBy:  string;
  approvedBy?:  string;
  notes?:       string;
  createdAt:    string;
  completedAt?: string;
}

interface Stats { requested: number; approved: number; inTransit: number; completed: number; }

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<TransferStatus, string> = {
  REQUESTED:  'badge badge-amber',
  APPROVED:   'badge badge-green',
  REJECTED:   'badge badge-red',
  IN_TRANSIT: 'badge badge-blue',
  COMPLETED:  'badge badge-gray',
  CANCELLED:  'badge badge-gray',
};

const STATUS_ICON: Record<TransferStatus, React.ComponentType<{className?: string}>> = {
  REQUESTED:  ClipboardList,
  APPROVED:   CheckCircle2,
  REJECTED:   XCircle,
  IN_TRANSIT: Truck,
  COMPLETED:  Package,
  CANCELLED:  Ban,
};

const FILTER_TABS: Array<{ value: TransferStatus | ''; label: string }> = [
  { value: '',           label: 'All'        },
  { value: 'REQUESTED',  label: 'Pending'    },
  { value: 'APPROVED',   label: 'Approved'   },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'COMPLETED',  label: 'Completed'  },
  { value: 'REJECTED',   label: 'Rejected'   },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TransferMarketplacePage() {
  const { user } = useAuth();
  const [transfers, setTransfers]   = useState<Transfer[]>([]);
  const [stats, setStats]           = useState<Stats>({ requested: 0, approved: 0, inTransit: 0, completed: 0 });
  const [loading, setLoading]       = useState(true);
  const [filterStatus, setFilter]   = useState<TransferStatus | ''>('');
  const [showForm, setShowForm]     = useState(false);
  const [toast, setToast]           = useState<string | null>(null);

  const [form, setForm] = useState({
    fromBranchId: '', toBranchId: '', productName: '',
    qty: 1, notes: '', requestedBy: '',
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        transfersApi.list(filterStatus ? { status: filterStatus } : {}),
        transfersApi.stats(),
      ]);
      setTransfers(tRes.data);
      setStats(sRes.data);
    } catch {
      // silently ignore; show empty state
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { reload(); }, [reload]);

  const createTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await transfersApi.create({
        ...form,
        productId: form.productName.toLowerCase().replace(/\s/g, '_'),
        requestedBy: form.requestedBy || user?.id || '',
      });
      showToast('Transfer request created. Branch manager notified via WhatsApp.');
      setShowForm(false);
      reload();
    } catch {
      showToast('Failed to create request');
    }
  };

  const doAction = async (id: string, action: string, body?: object) => {
    try {
      const userId = user?.id ?? 'current-user';
      if (action === 'approve') await transfersApi.approve(id, userId);
      else if (action === 'reject') await transfersApi.reject(id, userId, (body as any)?.reason);
      else if (action === 'transit') await transfersApi.markInTransit(id);
      else if (action === 'complete') await transfersApi.complete(id, userId);
      else if (action === 'cancel') await transfersApi.cancel(id, userId);
      showToast(`Transfer ${action}d successfully`);
      reload();
    } catch {
      showToast('Action failed');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl bg-slate-800 shadow-card-lg px-4 py-3 text-sm text-white flex items-center gap-2 animate-scaleIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            Branch Transfer Marketplace
          </h2>
          <p className="page-subtitle">Request stock from other branches — WhatsApp notifications sent automatically</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Request Stock
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pending Requests', count: stats.requested,  color: 'bg-amber-50',  iconColor: 'text-amber-600',  Icon: ClipboardList },
          { label: 'Approved',         count: stats.approved,   color: 'bg-green-50',  iconColor: 'text-green-600',  Icon: CheckCircle2  },
          { label: 'In Transit',       count: stats.inTransit,  color: 'bg-blue-50',   iconColor: 'text-blue-600',   Icon: Truck         },
          { label: 'Completed',        count: stats.completed,  color: 'bg-slate-50',  iconColor: 'text-slate-500',  Icon: Package       },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{s.label}</p>
                <p className="page-title">{s.count}</p>
              </div>
              <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center`}>
                <s.Icon className={`w-4 h-4 ${s.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150
              ${filterStatus === tab.value
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Transfer list */}
      {loading ? (
        <div className="card p-12 text-center">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading transfers…</p>
        </div>
      ) : transfers.length === 0 ? (
        <div className="card p-16 text-center">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium">No transfers found</p>
          <p className="text-sm text-slate-400 mt-1">Create a request to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transfers.map((t) => {
            const Icon = STATUS_ICON[t.status];
            return (
              <div key={t.id} className="card p-4 hover:shadow-card-md transition-shadow duration-200">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`${STATUS_BADGE[t.status]} flex items-center gap-1`}>
                        <Icon className="w-3 h-3" />
                        {t.status.replace('_', ' ')}
                      </span>
                      <span className="font-semibold text-slate-800">{t.productName}</span>
                      <span className="badge badge-blue">×{t.qty}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{t.fromBranchId}</span>
                      {' → '}
                      <span className="font-medium text-slate-700">{t.toBranchId}</span>
                      {' · Requested by '}
                      <span className="text-slate-700">{t.requestedBy}</span>
                      {' · '}
                      {new Date(t.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    {t.notes && <p className="text-xs text-slate-400 mt-1 italic">{t.notes}</p>}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-shrink-0 flex-wrap">
                    {t.status === 'REQUESTED' && (
                      <>
                        <button onClick={() => doAction(t.id, 'approve')}
                          className="btn-secondary text-xs py-1.5 px-3 text-green-700 border-green-200 hover:bg-green-50">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={() => doAction(t.id, 'reject', { reason: 'Insufficient stock' })}
                          className="btn-secondary text-xs py-1.5 px-3 text-red-600 border-red-200 hover:bg-red-50">
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}
                    {t.status === 'APPROVED' && (
                      <button onClick={() => doAction(t.id, 'transit')}
                        className="btn-secondary text-xs py-1.5 px-3 text-blue-700 border-blue-200 hover:bg-blue-50">
                        <Truck className="w-3.5 h-3.5" /> Mark In Transit
                      </button>
                    )}
                    {t.status === 'IN_TRANSIT' && (
                      <button onClick={() => doAction(t.id, 'complete')}
                        className="btn-primary text-xs py-1.5 px-3">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Receipt
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Transfer Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-panel max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h2 className="modal-title flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-primary" />
                Request Stock Transfer
              </h2>
              <button onClick={() => setShowForm(false)} className="btn-icon">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={createTransfer}>
              <div className="modal-body space-y-3">
                <div>
                  <label className="label">From Branch ID</label>
                  <input required placeholder="e.g. BRANCH-001" value={form.fromBranchId}
                    onChange={(e) => setForm({ ...form, fromBranchId: e.target.value })}
                    className="input" />
                </div>
                <div>
                  <label className="label">To Branch ID</label>
                  <input required placeholder="e.g. BRANCH-002" value={form.toBranchId}
                    onChange={(e) => setForm({ ...form, toBranchId: e.target.value })}
                    className="input" />
                </div>
                <div>
                  <label className="label">Product Name / SKU</label>
                  <input required placeholder="e.g. iPhone 15 Pro 256GB" value={form.productName}
                    onChange={(e) => setForm({ ...form, productName: e.target.value })}
                    className="input" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Quantity</label>
                    <input required type="number" min={1} placeholder="1" value={form.qty}
                      onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
                      className="input" />
                  </div>
                  <div>
                    <label className="label">Requested By</label>
                    <input placeholder="Your ID (optional)" value={form.requestedBy}
                      onChange={(e) => setForm({ ...form, requestedBy: e.target.value })}
                      className="input" />
                  </div>
                </div>
                <div>
                  <label className="label">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                  <textarea placeholder="Any additional notes…" value={form.notes} rows={2}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="input resize-none" />
                </div>
              </div>
              <div className="modal-ft">
                <button type="button" onClick={() => setShowForm(false)}
                  className="btn-secondary flex-1 justify-center">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 justify-center">
                  <Plus className="w-4 h-4" /> Send Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
