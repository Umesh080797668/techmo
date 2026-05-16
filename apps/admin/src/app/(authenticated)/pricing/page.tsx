'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pricingApi, productsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Tag, DollarSign, Package, Clock, Gift, LockKeyhole, type LucideIcon } from 'lucide-react';

// ── Constants — must match the Prisma PricingRuleType enum ───────────────────
const RULE_TYPES = ['DISCOUNT_PERCENT', 'DISCOUNT_AMOUNT', 'BULK', 'TIME_BASED', 'COMBO_DISCOUNT'] as const;
type RuleType = typeof RULE_TYPES[number];

const RULE_META: Record<RuleType, { label: string; Icon: LucideIcon; color: string }> = {
  DISCOUNT_PERCENT: { label: '% Discount',       Icon: Tag,        color: 'bg-purple-100 text-purple-700' },
  DISCOUNT_AMOUNT:  { label: 'Fixed Amount Off',  Icon: DollarSign, color: 'bg-blue-100   text-blue-700'   },
  BULK:             { label: 'Bulk / Multi-Buy',  Icon: Package,    color: 'bg-amber-100  text-amber-700'  },
  TIME_BASED:       { label: 'Time-Based Promo',  Icon: Clock,      color: 'bg-green-100  text-green-700'  },
  COMBO_DISCOUNT:   { label: 'Combo Deal',        Icon: Gift,       color: 'bg-pink-100   text-pink-700'   },
};

const emptyForm = () => ({
  name: '',
  description: '',
  productId: '',
  ruleType: 'DISCOUNT_PERCENT' as RuleType,
  discountPct: '',
  discountAmt: '',
  minQty: '',
  startsAt: '',
  endsAt: '',
  requiresManagerPin: false,
});

export default function PricingPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [filterType, setFilterType] = useState<RuleType | 'ALL'>('ALL');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['pricing-rules'],
    queryFn: () => pricingApi.listRules().then((r) => r.data),
  });

  const { data: productsData } = useQuery({
    queryKey: ['products-mini'],
    queryFn: () => productsApi.list({ limit: 200 }).then((r) => r.data),
  });

  const products: any[] = useMemo(
    () => productsData?.items ?? productsData?.data ?? [],
    [productsData],
  );

  const allRules: any[] = Array.isArray(rulesData) ? rulesData : (rulesData?.data ?? []);
  const rules = filterType === 'ALL' ? allRules : allRules.filter((r) => r.ruleType === filterType);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: (data: any) =>
      editingId ? pricingApi.updateRule(editingId, data) : pricingApi.createRule(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing-rules'] });
      toast.success(editingId ? 'Rule updated' : 'Rule created');
      closeModal();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to save'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      pricingApi.updateRule(id, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing-rules'] }),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to update'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => pricingApi.deleteRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing-rules'] });
      toast.success('Rule deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to delete'),
  });

  // ── Modal helpers ─────────────────────────────────────────────────────────────
  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setShowModal(true);
  }

  function openEdit(rule: any) {
    setEditingId(rule.id);
    setForm({
      name: rule.name ?? '',
      description: rule.description ?? '',
      productId: rule.productId ?? '',
      ruleType: rule.ruleType ?? 'DISCOUNT_PERCENT',
      discountPct: rule.discountPct != null ? String(rule.discountPct) : '',
      discountAmt: rule.discountAmt != null ? String(rule.discountAmt) : '',
      minQty: rule.minQty != null ? String(rule.minQty) : '',
      startsAt: rule.startsAt ? rule.startsAt.slice(0, 16) : '',
      endsAt: rule.endsAt ? rule.endsAt.slice(0, 16) : '',
      requiresManagerPin: rule.requiresManagerPin ?? false,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      productId: form.productId || null,
      ruleType: form.ruleType,
      requiresManagerPin: form.requiresManagerPin,
    };
    if (form.discountPct !== '') payload.discountPct = parseFloat(form.discountPct);
    if (form.discountAmt !== '') payload.discountAmt = parseFloat(form.discountAmt);
    if (form.minQty !== '') payload.minQty = parseInt(form.minQty, 10);
    if (form.startsAt) payload.startsAt = new Date(form.startsAt).toISOString();
    if (form.endsAt) payload.endsAt = new Date(form.endsAt).toISOString();
    saveMut.mutate(payload);
  }

  const selectedProduct = products.find((p) => p.id === form.productId);
  const previewPrice = selectedProduct
    ? form.discountPct
      ? Number(selectedProduct.sellingPrice) * (1 - parseFloat(form.discountPct) / 100)
      : form.discountAmt
        ? Number(selectedProduct.sellingPrice) - parseFloat(form.discountAmt)
        : null
    : null;

  const fmt = (n: number) =>
    n.toLocaleString('en-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 0 });

  const validityLabel = (rule: any) => {
    if (!rule.startsAt && !rule.endsAt) return 'Always';
    const parts: string[] = [];
    if (rule.startsAt) parts.push(`From ${new Date(rule.startsAt).toLocaleDateString()}`);
    if (rule.endsAt)   parts.push(`Until ${new Date(rule.endsAt).toLocaleDateString()}`);
    return parts.join(' · ');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Pricing Rules</h1>
          <p className="page-subtitle">Discounts, bulk deals, combo promos, and time-limited sales</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          + New Rule
        </button>
      </div>

      {/* Stats / filter cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {RULE_TYPES.map((type) => {
          const total  = allRules.filter((r) => r.ruleType === type).length;
          const active = allRules.filter((r) => r.ruleType === type && r.isActive).length;
          const { Icon, label } = RULE_META[type];
          return (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? 'ALL' : type)}
              className={`rounded-xl border p-4 text-left transition-all ${
                filterType === type
                  ? 'ring-2 ring-blue-500 border-blue-300 bg-blue-50'
                  : 'bg-white hover:border-slate-300'
              }`}
            >
              <Icon className="w-6 h-6 mb-1 text-slate-600" />
              <div className="font-semibold text-slate-800 text-xs leading-tight">{label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{active} active / {total} total</div>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">
            {filterType === 'ALL' ? 'All Rules' : RULE_META[filterType].label}
          </span>
          <span className="text-xs text-slate-400">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-slate-400">Loading…</div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Tag className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="font-medium">No pricing rules yet</p>
            <p className="text-sm mt-1">Create your first rule to start applying discounts at the POS.</p>
            <button onClick={openCreate} className="btn-primary mt-4">+ Create Rule</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="table-th">Rule</th>
                  <th className="table-th">Type</th>
                  <th className="table-th">Product</th>
                  <th className="table-th">Discount</th>
                  <th className="table-th">Validity</th>
                  <th className="table-th">Active</th>
                  <th className="table-th"></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => {
                  const meta = RULE_META[rule.ruleType as RuleType] ?? RULE_META.DISCOUNT_PERCENT;
                  return (
                    <tr key={rule.id} className={`table-tr ${!rule.isActive ? 'opacity-40' : ''}`}>
                      {/* Rule name */}
                      <td className="table-td">
                        <div className="font-medium text-slate-900">{rule.name}</div>
                        {rule.description && (
                          <div className="text-xs text-slate-400 mt-0.5">{rule.description}</div>
                        )}
                        {rule.requiresManagerPin && (
                          <span className="text-xs text-orange-600 mt-0.5 flex items-center gap-0.5"><LockKeyhole className="w-3 h-3" /> Manager PIN</span>
                        )}
                      </td>

                      {/* Type badge */}
                      <td className="table-td">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${meta.color}`}>
                          <meta.Icon className="w-3.5 h-3.5" /> {meta.label}
                        </span>
                      </td>

                      {/* Product — shows name, not UUID */}
                      <td className="table-td">
                        {rule.product ? (
                          <div>
                            <div className="font-medium text-slate-800">{rule.product.name}</div>
                            <div className="text-xs text-slate-400">{rule.product.sku}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">All products</span>
                        )}
                      </td>

                      {/* Discount */}
                      <td className="table-td font-mono">
                        {rule.discountPct != null && (
                          <span className="text-green-700 font-semibold">{rule.discountPct}% off</span>
                        )}
                        {rule.discountAmt != null && (
                          <span className="text-green-700 font-semibold">− {fmt(Number(rule.discountAmt))}</span>
                        )}
                        {rule.minQty != null && (
                          <div className="text-xs text-slate-500 mt-0.5">Min qty: {rule.minQty}</div>
                        )}
                        {rule.discountPct == null && rule.discountAmt == null && (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Validity */}
                      <td className="table-td text-xs text-slate-500">{validityLabel(rule)}</td>

                      {/* Toggle */}
                      <td className="table-td">
                        <button
                          onClick={() => toggleMut.mutate({ id: rule.id, isActive: !rule.isActive })}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent
                            transition-colors duration-200 focus:outline-none
                            ${rule.isActive ? 'bg-green-500' : 'bg-slate-300'}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white shadow
                              transition-transform duration-200
                              ${rule.isActive ? 'translate-x-4' : 'translate-x-0'}`}
                          />
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="table-td">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openEdit(rule)}
                            className="text-blue-600 hover:underline text-xs font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setConfirmDialog({
                              open: true,
                              title: 'Delete Pricing Rule',
                              message: `Delete rule "${rule.name}"? This cannot be undone.`,
                              onConfirm: () => { deleteMut.mutate(rule.id); setConfirmDialog(d => ({ ...d, open: false })); },
                            })}
                            className="text-red-500 hover:underline text-xs font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ───────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-panel max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h2 className="modal-title">
                {editingId ? 'Edit Pricing Rule' : 'New Pricing Rule'}
              </h2>
              <button type="button" onClick={closeModal} className="btn-icon text-base">✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-5">

                {/* Name */}
                <div>
                  <label className="label">Rule Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Ramadan Sale, Student Discount, Buy 3 Get 5% Off"
                    className="input"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="label">
                    Description{' '}
                    <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <input
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Internal note visible to staff at POS"
                    className="input"
                  />
                </div>

                {/* Rule Type — visual card selector */}
                <div>
                  <label className="label">Rule Type *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {RULE_TYPES.map((type) => {
                      const { label, Icon } = RULE_META[type];
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, ruleType: type }))}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left
                            ${form.ruleType === type
                              ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-400'
                              : 'border-slate-200 hover:border-slate-300 text-slate-700'}`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="leading-tight text-xs">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Product — select by name, not UUID */}
                <div>
                  <label className="label">
                    Apply to Product{' '}
                    <span className="text-slate-400 font-normal">(optional — leave blank for store-wide)</span>
                  </label>
                  <select
                    value={form.productId}
                    onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                    className="input"
                  >
                    <option value="">— All Products (store-wide rule) —</option>
                    {products.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}  ·  {p.sku}  ·  {fmt(Number(p.sellingPrice))}
                      </option>
                    ))}
                  </select>

                  {/* Live price preview after discount */}
                  {selectedProduct && previewPrice !== null && (
                    <div className="mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm flex items-center gap-3">
                      <span className="text-slate-400 line-through">{fmt(Number(selectedProduct.sellingPrice))}</span>
                      <span className="font-semibold text-green-700">→ {fmt(Math.max(0, previewPrice))}</span>
                      <span className="text-xs text-green-600 ml-auto">after this rule</span>
                    </div>
                  )}
                </div>

                {/* Discount % — DISCOUNT_PERCENT / TIME_BASED / COMBO / BULK */}
                {(form.ruleType === 'DISCOUNT_PERCENT' ||
                  form.ruleType === 'TIME_BASED' ||
                  form.ruleType === 'COMBO_DISCOUNT' ||
                  form.ruleType === 'BULK') && (
                  <div>
                    <label className="label">
                      Discount %
                      {form.ruleType === 'BULK' ? ' (applied when min qty met)' : ''} *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.01"
                        required
                        value={form.discountPct}
                        onChange={(e) => setForm((f) => ({ ...f, discountPct: e.target.value }))}
                        placeholder="e.g. 10"
                        className="input pr-10"
                      />
                      <span className="absolute right-3.5 top-2.5 text-slate-400 font-medium">%</span>
                    </div>
                  </div>
                )}

                {/* Fixed amount off — DISCOUNT_AMOUNT only */}
                {form.ruleType === 'DISCOUNT_AMOUNT' && (
                  <div>
                    <label className="label">Amount Off (LKR) *</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm font-medium">LKR</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={form.discountAmt}
                        onChange={(e) => setForm((f) => ({ ...f, discountAmt: e.target.value }))}
                        placeholder="e.g. 500"
                        className="input pl-12"
                      />
                    </div>
                  </div>
                )}

                {/* Min Qty — BULK only */}
                {form.ruleType === 'BULK' && (
                  <div>
                    <label className="label">Minimum Quantity to Trigger *</label>
                    <input
                      type="number"
                      min="2"
                      step="1"
                      required
                      value={form.minQty}
                      onChange={(e) => setForm((f) => ({ ...f, minQty: e.target.value }))}
                      placeholder="e.g. 3 → buy 3 or more to get the discount"
                      className="input"
                    />
                  </div>
                )}

                {/* Date range — TIME_BASED / COMBO */}
                {(form.ruleType === 'TIME_BASED' || form.ruleType === 'COMBO_DISCOUNT') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Start</label>
                      <input
                        type="datetime-local"
                        value={form.startsAt}
                        onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">End</label>
                      <input
                        type="datetime-local"
                        value={form.endsAt}
                        onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                        className="input"
                      />
                    </div>
                  </div>
                )}

                {/* Manager PIN */}
                <label className="flex items-start gap-3 cursor-pointer bg-orange-50 border border-orange-200 rounded-xl p-3">
                  <input
                    type="checkbox"
                    checked={form.requiresManagerPin}
                    onChange={(e) => setForm((f) => ({ ...f, requiresManagerPin: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded accent-orange-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><LockKeyhole className="w-3.5 h-3.5 text-orange-500" /> Requires Manager PIN</span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cashier must get manager approval before applying this discount at POS.
                    </p>
                  </div>
                </label>
              </div>

              {/* Sticky footer */}
              <div className="modal-ft">
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMut.isPending}
                  className="btn-primary flex-1"
                >
                  {saveMut.isPending ? 'Saving…' : editingId ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))}
      />
    </div>
  );
}
