'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { customersApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import ConfirmDialog from '@/components/ConfirmDialog';
import { CheckCircle2, Copy, RefreshCw } from 'lucide-react';

const TIER_COLORS: Record<string, string> = {
  NORMAL: 'badge-gray',
  PREMIUM: 'badge-amber',
};

const fullName = (c: any) => `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '—';

const genPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!';
  const all = upper + lower + digits + special;
  const rand = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
  const base = [rand(upper), rand(lower), rand(digits), rand(special),
    ...Array.from({ length: 6 }, () => rand(all))];
  return base.sort(() => Math.random() - 0.5).join('');
};

export default function CustomersPage() {
  const qc = useQueryClient();
  const { isRole } = useAuth();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', email: '', address: '', password: '' });
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
    open: false, title: '', message: '', onConfirm: () => {},
  });
  const [pointsModal, setPointsModal] = useState(false);
  const [pointsAction, setPointsAction] = useState<'earn' | 'redeem' | 'adjust'>('adjust');
  const [pointsAmount, setPointsAmount] = useState('');
  const [pointsNote, setPointsNote] = useState('');
  const [txModal, setTxModal] = useState(false);
  const [createForm, setCreateForm] = useState({ firstName: '', lastName: '', phone: '', email: '', address: '', password: genPassword() });
  const [credModal, setCredModal] = useState<{ email: string; password: string } | null>(null);

  const openEdit = (c: any) => {
    setSelected(c);
    setEditForm({ firstName: c.firstName ?? '', lastName: c.lastName ?? '', phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '', password: '' });
    setEditModal(true);
  };

  // Auto-open create modal when ?new=1 is in the URL
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setCreateModal(true);
    }
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { search, page }],
    queryFn: () => customersApi.list({ search, page, limit: 20 }).then(r => r.data),
  });

  const { data: txData } = useQuery({
    queryKey: ['customer-tx', selected?.id],
    queryFn: () => customersApi.transactions(selected!.id).then(r => r.data?.data ?? r.data),
    enabled: !!selected && txModal,
  });

  const customers: any[] = data?.data ?? data ?? [];
  const total: number = data?.total ?? customers.length;

  const createMutation = useMutation({
    mutationFn: () => customersApi.create(createForm),
    onSuccess: () => {
      setCredModal({ email: createForm.email, password: createForm.password });
      toast.success('Customer created');
      qc.invalidateQueries({ queryKey: ['customers'] });
      setCreateModal(false);
      setCreateForm({ firstName: '', lastName: '', phone: '', email: '', address: '', password: genPassword() });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Create failed'),
  });

  const pointsMutation = useMutation({
    mutationFn: async () => {
      const amt = Number(pointsAmount);
      if (pointsAction === 'earn') return customersApi.earnPoints({ customerId: selected!.id, points: amt, reference: pointsNote || 'MANUAL' });
      if (pointsAction === 'redeem') return customersApi.redeemPoints({ customerId: selected!.id, points: amt, reference: pointsNote || 'MANUAL' });
      return customersApi.adjustPoints({ customerId: selected!.id, adjustment: amt, reason: pointsNote });
    },
    onSuccess: () => {
      toast.success('Points updated');
      qc.invalidateQueries({ queryKey: ['customers'] });
      setPointsModal(false);
      setPointsAmount('');
      setPointsNote('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const payload: any = { ...editForm };
      if (!payload.password) delete payload.password;
      return customersApi.update(selected!.id, payload);
    },
    onSuccess: () => {
      toast.success('Customer updated');
      qc.invalidateQueries({ queryKey: ['customers'] });
      setEditModal(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: () => {
      toast.success('Customer deleted');
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Delete failed'),
  });

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{total.toLocaleString()} registered customers</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name / phone…" className="input w-full sm:w-52 text-sm" />
          <button onClick={() => setCreateModal(true)} className="btn-primary">+ Add Customer</button>
        </div>
      </div>

      <div className="table-card">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr>
              {['Name', 'Phone', 'Email', 'Tier', 'Points', 'Joined', ''].map(h => (
                <th key={h} className="table-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="table-td text-center py-10 text-slate-400">Loading…</td></tr>
            )}
            {!isLoading && customers.length === 0 && (
              <tr><td colSpan={7} className="table-td text-center py-10 text-slate-400">No customers found</td></tr>
            )}
            {customers.map((c: any) => (
              <tr key={c.id} className="table-tr">
                <td className="table-td font-medium">{fullName(c)}</td>
                <td className="table-td font-mono">{c.phone}</td>
                <td className="table-td text-slate-500">{c.email ?? '—'}</td>
                <td className="table-td">
                  <span className={`badge ${TIER_COLORS[c.tier] ?? 'badge-gray'}`}>{c.tier}</span>
                </td>
                <td className="table-td font-semibold text-amber-600">{(c.loyaltyPoints ?? 0).toLocaleString()} pts</td>
                <td className="table-td text-slate-400 text-xs">
                  {c.createdAt ? format(new Date(c.createdAt), 'dd MMM yyyy') : '—'}
                </td>
                <td className="table-td">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => { setSelected(c); setPointsModal(true); setPointsAction('adjust'); }}
                      className="text-xs text-amber-600 hover:underline">Points</button>
                    <button
                      onClick={() => { setSelected(c); setTxModal(true); }}
                      className="text-xs text-primary hover:underline">History</button>
                    {isRole('SUPER_ADMIN', 'MANAGER', 'CASHIER') && (
                      <>
                        <button onClick={() => openEdit(c)}
                          className="text-xs text-blue-600 hover:underline">Edit</button>
                        <button
                          onClick={() => setConfirmDialog({
                            open: true,
                            title: 'Delete Customer',
                            message: `Delete ${fullName(c)}? This cannot be undone.`,
                            onConfirm: () => { deleteMutation.mutate(c.id); setConfirmDialog(d => ({ ...d, open: false })); },
                          })}
                          className="text-xs text-red-500 hover:underline">Delete</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {total > 20 && (
        <div className="flex items-center justify-between px-1 py-1">
          <span className="text-xs text-slate-400 tabular">Page {page} · {total.toLocaleString()} total</span>
          <div className="flex gap-1.5">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="page-btn">← Prev</button>
            <button disabled={customers.length < 20} onClick={() => setPage(p => p + 1)} className="page-btn">Next →</button>
          </div>
        </div>
      )}

      {/* Create Customer Modal */}
      {createModal && (
        <div className="modal-overlay" onClick={() => setCreateModal(false)}>
          <div className="modal-panel max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 className="modal-title">Add Customer</h3>
              <button onClick={() => setCreateModal(false)} className="btn-icon text-slate-400"><span className="text-lg leading-none">×</span></button>
            </div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">First Name *</label>
                  <input value={createForm.firstName} onChange={e => setCreateForm(f => ({ ...f, firstName: e.target.value }))} className="input" placeholder="Kasun" />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input value={createForm.lastName} onChange={e => setCreateForm(f => ({ ...f, lastName: e.target.value }))} className="input" placeholder="Perera" />
                </div>
              </div>
              <div>
                <label className="label">Phone *</label>
                <input value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} className="input" placeholder="07XXXXXXXX" />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Address</label>
                <input value={createForm.address} onChange={e => setCreateForm(f => ({ ...f, address: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Login Password <span className="text-slate-400 font-normal">(auto-generated)</span></label>
                <div className="flex gap-2">
                  <input type="text" value={createForm.password} readOnly
                    className="input flex-1 bg-slate-50 cursor-default font-mono tracking-wide select-all" />
                  <button type="button" onClick={() => setCreateForm(f => ({ ...f, password: genPassword() }))}
                    className="btn-secondary px-3 text-xs whitespace-nowrap flex items-center gap-1.5" title="Generate a new password">
                    <RefreshCw className="w-3 h-3" /> New
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Share this with the customer — they’ll be asked to change it on first login.</p>
              </div>
            </div>
            <div className="modal-ft">
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !createForm.firstName || !createForm.phone}
                className="btn-primary flex-1">{createMutation.isPending ? 'Creating…' : 'Create Customer'}</button>
              <button onClick={() => setCreateModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Points Modal */}
      {pointsModal && selected && (
        <div className="modal-overlay" onClick={() => setPointsModal(false)}>
          <div className="modal-panel max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 className="modal-title">Manage Points</h3>
              <button onClick={() => setPointsModal(false)} className="btn-icon text-slate-400"><span className="text-lg leading-none">×</span></button>
            </div>
            <div className="modal-body space-y-4">
              <p className="text-sm text-slate-500">
                {fullName(selected)} — Current: <strong className="text-amber-600">{selected.loyaltyPoints} pts</strong>
              </p>
              <div className="seg-switcher w-full">
                {(['earn', 'redeem', 'adjust'] as const).map(a => (
                  <button key={a} onClick={() => setPointsAction(a)}
                    className={`flex-1 ${pointsAction === a ? 'seg-btn-on' : 'seg-btn-off'} justify-center capitalize`}>{a}</button>
                ))}
              </div>
              <div>
                <label className="label">Points</label>
                <input type="number" value={pointsAmount} onChange={e => setPointsAmount(e.target.value)}
                  className="input" placeholder={pointsAction === 'adjust' ? '-100 or +200' : 'e.g. 500'} />
              </div>
              {(pointsAction === 'earn' || pointsAction === 'adjust') && (
                <div>
                  <label className="label">{pointsAction === 'adjust' ? 'Reason' : 'Source'}</label>
                  <input value={pointsNote} onChange={e => setPointsNote(e.target.value)}
                    className="input" placeholder={pointsAction === 'adjust' ? 'Correction, bonus…' : 'In-store purchase'} />
                </div>
              )}
            </div>
            <div className="modal-ft">
              <button onClick={() => pointsMutation.mutate()} disabled={pointsMutation.isPending || !pointsAmount}
                className="btn-accent flex-1">{pointsMutation.isPending ? 'Saving…' : 'Apply'}</button>
              <button onClick={() => setPointsModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {txModal && selected && (
        <div className="modal-overlay" onClick={() => setTxModal(false)}>
          <div className="modal-panel max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <div>
                <h3 className="modal-title">Transaction History</h3>
                <p className="text-xs text-slate-400 mt-0.5">{fullName(selected)}</p>
              </div>
              <button onClick={() => setTxModal(false)} className="btn-icon text-slate-400"><span className="text-lg leading-none">×</span></button>
            </div>
            <div className="modal-body space-y-0 divide-y divide-slate-50">
              {!txData && <p className="text-slate-400 text-sm py-4">Loading…</p>}
              {Array.isArray(txData) && txData.length === 0 && <p className="text-slate-400 text-sm py-4">No transactions yet</p>}
              {(Array.isArray(txData) ? txData : []).map((tx: any) => (
                <div key={tx.id} className="flex justify-between items-center py-3 text-sm">
                  <div>
                    <p className="font-medium capitalize">{tx.type?.toLowerCase().replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-400">{tx.createdAt ? format(new Date(tx.createdAt), 'dd MMM yyyy HH:mm') : ''}</p>
                    {tx.reference && <p className="text-xs text-slate-400">Ref: {tx.reference}</p>}
                  </div>
                  <span className={`font-semibold tabular ${tx.points > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {tx.points > 0 ? '+' : ''}{tx.points} pts
                  </span>
                </div>
              ))}
            </div>
            <div className="modal-ft">
              <button onClick={() => setTxModal(false)} className="btn-secondary flex-1">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editModal && selected && (
        <div className="modal-overlay" onClick={() => setEditModal(false)}>
          <div className="modal-panel max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 className="modal-title">Edit Customer</h3>
              <button onClick={() => setEditModal(false)} className="btn-icon text-slate-400"><span className="text-lg leading-none">×</span></button>
            </div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">First Name *</label>
                  <input value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} className="input" />
                </div>
              </div>
              <div>
                <label className="label">Phone *</label>
                <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Address</label>
                <input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">New Password <span className="text-slate-400 font-normal">(leave blank to keep unchanged)</span></label>
                <input type="password" value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} className="input" placeholder="Min. 6 characters" autoComplete="new-password" />
                {editForm.password && editForm.password.length < 6 && (
                  <p className="text-xs text-amber-500 mt-1">Must be at least 6 characters</p>
                )}
              </div>
            </div>
            <div className="modal-ft">
              <button onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending || !editForm.firstName || !editForm.phone}
                className="btn-primary flex-1">
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setEditModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {credModal && (
        <div className="modal-overlay" onClick={() => setCredModal(null)}>
          <div className="modal-panel max-w-sm text-center" onClick={e => e.stopPropagation()}>
            <div className="p-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="modal-title mb-1">Customer Account Created</h3>
            <p className="text-sm text-slate-500 mb-5">Share these login credentials with the customer.</p>
            <div className="bg-slate-50 rounded-xl p-4 text-left space-y-3 mb-5">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Email</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-slate-800 flex-1 break-all">{credModal.email}</span>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(credModal!.email); toast.success('Copied'); }} className="text-xs text-primary hover:underline whitespace-nowrap">Copy</button>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Password</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-800 flex-1 tracking-wide">{credModal.password}</span>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(credModal!.password); toast.success('Copied'); }} className="text-xs text-primary hover:underline whitespace-nowrap">Copy</button>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => { navigator.clipboard.writeText(`Email: ${credModal.email}\nPassword: ${credModal.password}`); toast.success('Credentials copied!'); }} className="btn-primary w-full mb-2 flex items-center justify-center gap-1.5"><Copy className="w-4 h-4" /> Copy Both</button>
            <button type="button" onClick={() => setCredModal(null)} className="btn-secondary w-full">Done</button>
            <p className="text-xs text-slate-400 mt-4">Customer will be prompted to change their password on first login.</p>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        danger
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))}
      />
    </div>
  );
}
