'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationsApi, inventoryApi, customersApi, employeesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { format, isPast, parseISO } from 'date-fns';
import { reservationFollowUpWhatsApp } from '@/lib/whatsapp';
import ConfirmDialog from '@/components/ConfirmDialog';
import { AlertTriangle, UserCheck, User } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'badge-green',
  CONVERTED: 'badge-blue',
  EXPIRED: 'badge-amber',
  CANCELLED: 'badge-red',
};

interface CreateForm {
  customerType: 'walk-in' | 'registered';
  customerId: string;
  customerName: string;
  customerPhone: string;
  productSku: string;
  productName: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  notes: string;
  expiresInHours: string;
}

const EMPTY_FORM: CreateForm = {
  customerType: 'walk-in',
  customerId: '',
  customerName: '', customerPhone: '', productSku: '',
  productName: '', productId: '', quantity: '1',
  unitPrice: '', notes: '', expiresInHours: '48',
};

export default function ReservationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const [tab, setTab] = useState<'ALL' | 'ACTIVE' | 'EXPIRED'>('ACTIVE');
  const [page, setPage] = useState(1);
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [skuLookupLoading, setSkuLookupLoading] = useState(false);
  const [customerLookupLoading, setCustomerLookupLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  const statusParam = tab === 'ALL' ? undefined : tab;

  // Fetch employees once to resolve staffId → name
  const { data: empData } = useQuery({
    queryKey: ['employees-all'],
    queryFn: () => employeesApi.list({ limit: 200 }).then(r => r.data),
    staleTime: 5 * 60_000,
  });
  const staffMap = new Map<string, string>(
    ((empData?.data ?? empData ?? []) as any[]).map((e: any) => [
      e.userId,
      `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || e.email,
    ])
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reservations', tab, page],
    queryFn: () =>
      reservationsApi.list({ status: statusParam, page, limit: 20 }).then(r => r.data),
    refetchInterval: 15_000,
  });

  const reservations: any[] = data?.data ?? data ?? [];
  const total: number = data?.total ?? reservations.length;

  const createMutation = useMutation({
    mutationFn: () =>
      reservationsApi.create({
        staffId: user!.id,
        customerId: form.customerId || undefined,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        productId: form.productId,
        productName: form.productName,
        sku: form.productSku,
        quantity: Number(form.quantity),
        unitPrice: Number(form.unitPrice),
        notes: form.notes || undefined,
        expiresInHours: Number(form.expiresInHours) || 48,
      }),
    onSuccess: () => {
      toast.success('Reservation created');
      refetch();
      setCreateModal(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create reservation'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => reservationsApi.cancel(id),
    onSuccess: () => { toast.success('Reservation cancelled'); refetch(); },
    onError: () => toast.error('Cancel failed'),
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => reservationsApi.convertToOrder(id, ''),
    onSuccess: () => { toast.success('Reservation converted to sale order'); refetch(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Conversion failed'),
  });

  // Customer phone lookup (for registered customers)
  const lookupCustomer = async () => {
    if (!form.customerPhone) return;
    setCustomerLookupLoading(true);
    try {
      const res = await customersApi.getByPhone(form.customerPhone);
      const c = res.data;
      setForm(f => ({
        ...f,
        customerId: c.id ?? '',
        customerName: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || f.customerName,
      }));
      toast.success('Customer found ✓');
    } catch {
      toast.error('No registered customer with that phone');
      setForm(f => ({ ...f, customerId: '' }));
    } finally {
      setCustomerLookupLoading(false);
    }
  };

  // SKU lookup to auto-fill product info
  const lookupSku = async () => {
    if (!form.productSku) return;
    setSkuLookupLoading(true);
    try {
      const res = await inventoryApi.getBySku(form.productSku);
      const item = res.data;
      setForm(f => ({
        ...f,
        productId: item.productId ?? item.id,
        productName: item.product?.name ?? item.name ?? '',
        unitPrice: String(item.product?.sellingPrice ?? item.sellingPrice ?? ''),
      }));
    } catch {
      toast.error('SKU not found');
    } finally {
      setSkuLookupLoading(false);
    }
  };

  const handleFollowUp = (r: any) => {
    const url = reservationFollowUpWhatsApp(
      r.customerPhone,
      r.customerName,
      r.productName,
      r.expiresAt ? format(parseISO(r.expiresAt), 'dd MMM') : 'soon',
    );
    window.open(url, '_blank');
  };

  const TABS = ['ACTIVE', 'EXPIRED', 'ALL'] as const;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reservations</h1>
          <p className="page-subtitle">{total.toLocaleString()} reservations</p>
        </div>
        <button onClick={() => setCreateModal(true)} className="btn-primary">+ New Reservation</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }}
            className={tab === t ? 'tab-pill-on' : 'tab-pill-off'}>
            {t === 'EXPIRED' ? <><AlertTriangle className="w-3 h-3" />Follow-up Needed</> : t}
          </button>
        ))}
      </div>

      <div className="table-card">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              {['Customer', 'Product', 'Qty × Price', 'Employee', 'Expires', 'Status', 'Actions'].map(h => (
                <th key={h} className="table-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="table-td text-center py-10 text-slate-400">Loading…</td></tr>
            )}
            {!isLoading && reservations.length === 0 && (
              <tr><td colSpan={7} className="table-td text-center py-10 text-slate-400">No reservations found</td></tr>
            )}
            {reservations.map((r: any) => {
              const expired = r.status === 'ACTIVE' && r.expiresAt && isPast(parseISO(r.expiresAt));
              return (
                <tr key={r.id} className="table-tr">
                  <td className="table-td">
                    <div className="font-medium">{r.customerName}</div>
                    <div className="text-xs text-slate-400">{r.customerPhone}</div>
                    {r.customerId
                      ? <span className="text-xs text-indigo-500 font-medium flex items-center gap-0.5"><UserCheck className="w-3 h-3" /> Registered</span>
                      : <span className="text-xs text-slate-400 flex items-center gap-0.5"><User className="w-3 h-3" /> Walk-in</span>
                    }
                  </td>
                  <td className="table-td">
                    <div>{r.productName}</div>
                    <div className="text-xs text-slate-400 font-mono">{r.productSku}</div>
                  </td>
                  <td className="table-td">
                    {r.quantity} × LKR {Number(r.unitPrice).toLocaleString()}
                  </td>
                  <td className="table-td text-slate-500">
                    {staffMap.get(r.staffId) ?? <span className="font-mono text-xs text-slate-400">{r.staffId?.slice(0, 8)}</span>}
                  </td>
                  <td className="table-td">
                    {r.expiresAt ? (
                      <span className={expired ? 'text-red-500 font-semibold' : 'text-slate-600'}>
                        {format(parseISO(r.expiresAt), 'dd MMM HH:mm')}
                        {expired && <AlertTriangle className="w-3.5 h-3.5 inline ml-1 text-amber-500" />}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="table-td">
                    <span className={`badge ${STATUS_COLORS[r.status] ?? 'badge-gray'}`}>{r.status}</span>
                  </td>
                  <td className="table-td">
                    <div className="flex gap-2">
                      {r.status === 'ACTIVE' && (
                        <>
                          <button onClick={() => handleFollowUp(r)} className="text-xs text-green-600 hover:underline">
                            WA Follow-up
                          </button>
                          <button
                            onClick={() => {
                              sessionStorage.setItem('pos_reservation_prefill', JSON.stringify({
                                reservationId: r.id,
                                customerPhone: r.customerPhone,
                                customerName: r.customerName,
                                customerId: r.customerId || null,
                                productSku: r.sku ?? r.productSku,
                                productName: r.productName,
                                productId: r.productId,
                                quantity: r.quantity,
                                unitPrice: r.unitPrice,
                              }));
                              router.push('/pos');
                            }}
                            className="text-xs text-indigo-600 hover:underline">
                            Convert →
                          </button>
                          <button
                            onClick={() => setConfirmDialog({
                              open: true,
                              title: 'Cancel Reservation',
                              message: 'Are you sure you want to cancel this reservation?',
                              onConfirm: () => { cancelMutation.mutate(r.id); setConfirmDialog(d => ({ ...d, open: false })); },
                            })}
                            className="text-xs text-red-500 hover:underline">
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>

      {total > 20 && (
        <div className="flex items-center justify-center gap-1.5">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="page-btn">← Prev</button>
          <span className="text-xs text-slate-400 tabular self-center px-1">Page {page}</span>
          <button disabled={reservations.length < 20} onClick={() => setPage(p => p + 1)} className="page-btn">Next →</button>
        </div>
      )}

      {/* Create Reservation Modal */}
      {createModal && (
        <div className="modal-overlay" onClick={() => setCreateModal(false)}>
          <div className="modal-panel max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 className="modal-title">New Reservation</h3>
              <button onClick={() => setCreateModal(false)} className="btn-icon text-base">✕</button>
            </div>
            <div className="modal-body space-y-4">

              {/* Customer type toggle */}
              <div>
                <label className="label mb-1">Customer Type</label>
                <div className="flex gap-2">
                  {(['walk-in', 'registered'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setForm(f => ({ ...f, customerType: t, customerId: '', customerName: '', customerPhone: '' }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                        form.customerType === t
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-primary/50'
                      }`}>
                      {t === 'walk-in' ? <><User className="w-3.5 h-3.5" /> Walk-in</> : <><UserCheck className="w-3.5 h-3.5" /> Registered</>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Registered: phone lookup */}
              {form.customerType === 'registered' ? (
                <div>
                  <label className="label">Phone Number *</label>
                  <div className="flex gap-2">
                    <input
                      value={form.customerPhone}
                      onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value, customerId: '', customerName: '' }))}
                      onKeyDown={e => e.key === 'Enter' && lookupCustomer()}
                      className="input flex-1" placeholder="+94771234567"
                    />
                    <button onClick={lookupCustomer} disabled={customerLookupLoading} className="btn-secondary text-sm whitespace-nowrap">
                      {customerLookupLoading ? '…' : 'Look up'}
                    </button>
                  </div>
                  {form.customerId && (
                    <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                      <span className="text-emerald-600">✓</span>
                      <span className="font-medium text-emerald-800">{form.customerName}</span>
                      <span className="text-emerald-500 text-xs ml-auto font-mono">{form.customerId.slice(0, 8)}…</span>
                    </div>
                  )}
                  {form.customerId && (
                    <div className="mt-2">
                      <label className="label">Name (editable)</label>
                      <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} className="input" />
                    </div>
                  )}
                </div>
              ) : (
                /* Walk-in: plain name + phone fields */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Customer Name *</label>
                    <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} className="input" placeholder="e.g. Kamal Perera" />
                  </div>
                  <div>
                    <label className="label">Phone *</label>
                    <input value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} className="input" placeholder="+94771234567" />
                  </div>
                </div>
              )}

              {/* SKU lookup */}
              <div>
                <label className="label">Product SKU *</label>
                <div className="flex gap-2">
                  <input value={form.productSku} onChange={e => setForm(f => ({ ...f, productSku: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && lookupSku()} className="input flex-1" placeholder="Scan or type SKU" />
                  <button onClick={lookupSku} disabled={skuLookupLoading} className="btn-secondary text-sm whitespace-nowrap">
                    {skuLookupLoading ? '…' : 'Look up'}
                  </button>
                </div>
              </div>

              {form.productName && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                  <span className="font-medium">{form.productName}</span>
                  {form.unitPrice && <span className="text-slate-500 ml-2">LKR {Number(form.unitPrice).toLocaleString()}</span>}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Quantity *</label>
                  <input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="label">Unit Price (LKR) *</label>
                  <input type="number" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} className="input" />
                </div>
              </div>

              <div>
                <label className="label">Expires In (hours)</label>
                <input type="number" value={form.expiresInHours} onChange={e => setForm(f => ({ ...f, expiresInHours: e.target.value }))} className="input" />
              </div>

              <div>
                <label className="label">Notes (optional)</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="input resize-none" />
              </div>
            </div>

            <div className="modal-ft">
              <button onClick={() => setCreateModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
                className="btn-primary flex-1">{createMutation.isPending ? 'Saving…' : 'Create Reservation'}</button>
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
