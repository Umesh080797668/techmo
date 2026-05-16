'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { warrantyApi, imeiApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { CheckCircle2, Clock, RefreshCw, XCircle, type LucideIcon } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  ELIGIBLE:     'badge-green',
  INELIGIBLE:   'badge-red',
  CLAIMED:      'badge-amber',
  EXPIRED:      'badge-gray',
  APPROVED:     'badge-green',
  REJECTED:     'badge-red',
  PENDING:      'badge-amber',
  RESOLVED:     'badge-blue',
};

const CLAIM_TYPE_LABELS: Record<string, string> = {
  WARRANTY_REPAIR:      'Warranty Repair',
  WARRANTY_REPLACEMENT: 'Warranty Replacement',
  SUPPLIER_RETURN:      'Supplier Return',
};

const CLAIM_TYPE_COLORS: Record<string, string> = {
  WARRANTY_REPAIR:      'badge-blue',
  WARRANTY_REPLACEMENT: 'badge-amber',
  SUPPLIER_RETURN:      'badge-gray',
};

export default function WarrantyPage() {
  const [lookupInput, setLookupInput] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [looking, setLooking] = useState(false);
  const [claimModal, setClaimModal] = useState(false);
  const [claimForm, setClaimForm] = useState({ imeiOrSerial: '', issueDescription: '', claimType: 'WARRANTY_REPAIR' });
  const [claimsPage, setClaimsPage] = useState(1);
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);

  const { data: claimsData, isLoading, refetch } = useQuery({
    queryKey: ['warranty-claims', claimsPage],
    queryFn: () => warrantyApi.listClaims({ page: claimsPage, limit: 20 }).then(r => r.data),
  });

  const claims: any[] = claimsData?.data ?? claimsData ?? [];
  const total: number = claimsData?.total ?? claims.length;

  const lookup = async () => {
    if (!lookupInput.trim()) return;
    setLooking(true);
    setLookupResult(null);
    try {
      const res = await warrantyApi.validate(lookupInput.trim());
      setLookupResult(res.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Lookup failed');
    } finally {
      setLooking(false);
    }
  };

  const claimMutation = useMutation({
    mutationFn: () => warrantyApi.claim(claimForm),
    onSuccess: () => {
      toast.success('Warranty claim submitted');
      setClaimModal(false);
      refetch();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Claim failed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      warrantyApi.updateClaim(id, { status }),
    onSuccess: () => { toast.success('Claim updated'); refetch(); setSelectedClaim(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Update failed'),
  });

  // Fetch fresh claim data when modal opens so we always show latest server state
  const { data: claimDetail, isLoading: claimDetailLoading } = useQuery({
    queryKey: ['warranty-claim', selectedClaim?.id],
    queryFn: () => warrantyApi.getClaim(selectedClaim!.id).then(r => r.data),
    enabled: !!selectedClaim?.id,
    staleTime: 0,
  });

  // Merge: prefer fresh server data, fall back to list row data while loading
  const activeClaim = claimDetail ?? selectedClaim;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Warranty &amp; Claims</h1>
          <p className="page-subtitle">Track warranty status and manage repair claims</p>
        </div>
        <button onClick={() => setClaimModal(true)} className="btn-primary">+ New Claim</button>
      </div>

      {/* IMEI / Serial Lookup */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-700 mb-3">Warranty Eligibility Lookup</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className="input"
            placeholder="Enter IMEI or Serial Number…"
            value={lookupInput}
            onChange={e => setLookupInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookup()}
          />
          <button onClick={lookup} disabled={looking} className="btn-primary w-full sm:w-28 sm:flex-shrink-0">
            {looking ? 'Checking…' : 'Check'}
          </button>
        </div>

        {lookupResult && (() => {
          // Derive a single status string from the backend response
          const warrantyStatus: 'ELIGIBLE' | 'EXPIRED' | 'CLAIMED' | 'INELIGIBLE' = (() => {
            if (lookupResult.eligible) return 'ELIGIBLE';
            const reason: string = lookupResult.reason ?? '';
            if (reason.toLowerCase().includes('expired')) return 'EXPIRED';
            if (reason.toLowerCase().includes('claim')) return 'CLAIMED';
            return 'INELIGIBLE';
          })();

          const statusConfig: { Icon: LucideIcon; label: string; bg: string; badge: string; iconColor: string } = {
            ELIGIBLE:   { Icon: CheckCircle2, label: 'Eligible — Under Warranty',      bg: 'bg-green-50  border-green-200',  badge: 'badge-green', iconColor: 'text-green-500' },
            EXPIRED:    { Icon: Clock,        label: 'Warranty Expired',                bg: 'bg-slate-50  border-slate-200',  badge: 'badge-gray',  iconColor: 'text-slate-400' },
            CLAIMED:    { Icon: RefreshCw,    label: 'Active Claim Already Open',       bg: 'bg-amber-50  border-amber-200',  badge: 'badge-amber', iconColor: 'text-amber-500' },
            INELIGIBLE: { Icon: XCircle,      label: 'Not Eligible',                    bg: 'bg-red-50    border-red-200',    badge: 'badge-red',   iconColor: 'text-red-500'   },
          }[warrantyStatus] ?? { Icon: XCircle, label: warrantyStatus, bg: 'bg-slate-50 border-slate-200', badge: 'badge-gray', iconColor: 'text-slate-400' };

          return (
            <div className={`mt-4 p-4 rounded-xl border ${statusConfig.bg}`}>
              <div className="flex items-center gap-3 mb-3">
                <statusConfig.Icon className={`w-7 h-7 ${statusConfig.iconColor}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-800">{statusConfig.label}</p>
                    <span className={`badge ${statusConfig.badge}`}>{warrantyStatus}</span>
                  </div>
                  {lookupResult.reason && (
                    <p className="text-sm text-slate-500 mt-0.5">{lookupResult.reason}</p>
                  )}
                </div>
              </div>

              {/* Product details — shown for ELIGIBLE / EXPIRED / CLAIMED */}
              {lookupResult.product && (
                <div className="text-sm space-y-1 text-slate-600 bg-white/60 rounded-lg p-3 mt-1">
                  <p><strong>Product:</strong> {lookupResult.product.name}</p>
                  <p><strong>IMEI / Serial:</strong> <span className="font-mono">{lookupInput}</span></p>
                  {lookupResult.soldAt && (
                    <p><strong>Purchase Date:</strong> {format(new Date(lookupResult.soldAt), 'dd MMM yyyy')}</p>
                  )}
                  {lookupResult.warrantyExpiresAt && (
                    <p>
                      <strong>Warranty {warrantyStatus === 'EXPIRED' ? 'Expired' : 'Expires'}:</strong>{' '}
                      {format(new Date(lookupResult.warrantyExpiresAt), 'dd MMM yyyy')}
                    </p>
                  )}
                  {lookupResult.expiredAt && !lookupResult.warrantyExpiresAt && (
                    <p><strong>Expired On:</strong> {format(new Date(lookupResult.expiredAt), 'dd MMM yyyy')}</p>
                  )}
                  {lookupResult.previousClaims !== undefined && (
                    <p><strong>Previous Claims:</strong> {lookupResult.previousClaims}</p>
                  )}
                  {warrantyStatus === 'CLAIMED' && lookupResult.claim && (
                    <p><strong>Claim Status:</strong>{' '}
                      <span className={`badge ${STATUS_COLORS[lookupResult.claim.status] ?? 'badge-gray'}`}>
                        {lookupResult.claim.status}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {warrantyStatus === 'ELIGIBLE' && (
                <button
                  onClick={() => {
                    setClaimForm(f => ({ ...f, imeiOrSerial: lookupInput }));
                    setClaimModal(true);
                  }}
                  className="btn-primary mt-3 text-xs">
                  File Warranty Claim
                </button>
              )}
            </div>
          );
        })()}
      </div>

      {/* Claims List */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700">All Claims</h2>
        </div>
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Loading…</div>
        ) : claims.length === 0 ? (
          <div className="text-center py-12 text-slate-400">No claims recorded yet.</div>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr>
                {['Claim #', 'IMEI / Serial', 'Product', 'Claim Type', 'Issue', 'Status', 'Submitted', 'Actions'].map(h => (
                  <th key={h} className="table-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {claims.map((c: any) => (
                <tr key={c.id} className="table-tr">
                  <td className="table-td font-mono text-xs">{c.id.slice(0, 8).toUpperCase()}</td>
                  <td className="table-td font-mono text-xs">{c.imeiRecord?.imei ?? '—'}</td>
                  <td className="table-td">{c.imeiRecord?.product?.name ?? '—'}</td>
                  <td className="table-td">
                    <span className={`badge text-xs ${CLAIM_TYPE_COLORS[c.claimType] ?? 'badge-gray'}`}>
                      {CLAIM_TYPE_LABELS[c.claimType] ?? c.claimType ?? '—'}
                    </span>
                  </td>
                  <td className="table-td max-w-[180px] truncate" title={c.issue}>{c.issue ?? '—'}</td>
                  <td className="table-td">
                    <span className={`badge ${STATUS_COLORS[c.status] ?? 'badge-gray'}`}>{c.status}</span>
                  </td>
                  <td className="table-td text-xs">
                    {c.createdAt ? format(new Date(c.createdAt), 'dd MMM yyyy') : '—'}
                  </td>
                  <td className="table-td">
                    <button
                      onClick={() => setSelectedClaim(c)}
                      className="text-xs font-medium text-primary hover:underline">
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > 20 && (
          <div className="flex justify-between items-center px-5 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">{total} total</span>
            <div className="flex gap-2">
              <button disabled={claimsPage === 1} onClick={() => setClaimsPage(p => p - 1)} className="btn-secondary text-xs">←</button>
              <button disabled={claimsPage * 20 >= total} onClick={() => setClaimsPage(p => p + 1)} className="btn-secondary text-xs">→</button>
            </div>
          </div>
        )}
      </div>

      {/* New Claim Modal */}
      {claimModal && (
        <div className="modal-overlay" onClick={() => setClaimModal(false)}>
          <div className="modal-panel max-w-md" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 className="modal-title">New Warranty Claim</h3>
              <button onClick={() => setClaimModal(false)} className="btn-icon"><span className="text-lg leading-none">×</span></button>
            </div>
            <div className="modal-body space-y-3">
              <div>
                <label className="label">IMEI / Serial Number</label>
                <input className="input" value={claimForm.imeiOrSerial}
                  onChange={e => setClaimForm(f => ({ ...f, imeiOrSerial: e.target.value }))} />
              </div>
              <div>
                <label className="label">Claim Type</label>
                <select className="input" value={claimForm.claimType}
                  onChange={e => setClaimForm(f => ({ ...f, claimType: e.target.value }))}>
                  <option value="WARRANTY_REPAIR">Warranty Repair</option>
                  <option value="WARRANTY_REPLACEMENT">Warranty Replacement</option>
                  <option value="SUPPLIER_RETURN">Supplier Return</option>
                </select>
              </div>
              <div>
                <label className="label">Issue Description</label>
                <textarea className="input min-h-[80px] resize-none" value={claimForm.issueDescription}
                  onChange={e => setClaimForm(f => ({ ...f, issueDescription: e.target.value }))} />
              </div>
            </div>
            <div className="modal-ft">
              <button onClick={() => setClaimModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => claimMutation.mutate()} disabled={claimMutation.isPending} className="btn-primary flex-1">
                {claimMutation.isPending ? 'Submitting…' : 'Submit Claim'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Claim Detail Modal */}
      {selectedClaim && (
        <div className="modal-overlay"
          onClick={() => setSelectedClaim(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl animate-fadeIn overflow-hidden"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className={`px-6 py-4 border-b flex items-start justify-between ${
              activeClaim.status === 'APPROVED' || activeClaim.status === 'RESOLVED' ? 'bg-green-50' :
              activeClaim.status === 'REJECTED' ? 'bg-red-50' : 'bg-amber-50'
            }`}>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Warranty Claim Detail</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">#{activeClaim.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <div className="flex items-center gap-3">
                {claimDetailLoading && (
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-primary rounded-full animate-spin" />
                )}
                <span className={`badge ${STATUS_COLORS[activeClaim.status] ?? 'badge-gray'}`}>
                  {activeClaim.status}
                </span>
                <button onClick={() => setSelectedClaim(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Device & product info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <ClaimField label="IMEI / Serial" value={activeClaim.imeiRecord?.imei ?? '—'} mono />
                <ClaimField label="Product" value={activeClaim.imeiRecord?.product?.name ?? '—'} />
                <ClaimField
                  label="Claim Type"
                  value={CLAIM_TYPE_LABELS[activeClaim.claimType] ?? activeClaim.claimType ?? '—'}
                />
                <ClaimField label="Submitted"
                  value={activeClaim.createdAt ? format(new Date(activeClaim.createdAt), 'dd MMM yyyy HH:mm') : '—'} />
                {activeClaim.updatedAt && activeClaim.updatedAt !== activeClaim.createdAt && (
                  <ClaimField label="Last Updated"
                    value={format(new Date(activeClaim.updatedAt), 'dd MMM yyyy HH:mm')} />
                )}
                {activeClaim.claimedById && (
                  <ClaimField label="Filed By" value={activeClaim.claimedById} />
                )}
              </div>

              {/* Issue description */}
              <div>
                <p className="text-xs text-slate-400 mb-1.5 font-medium uppercase tracking-wide">Issue Description</p>
                <p className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-3 leading-relaxed">
                  {activeClaim.issue ?? '—'}
                </p>
              </div>

              {/* Resolution / rejection reason */}
              {activeClaim.resolution && (
                <div>
                  <p className="text-xs text-green-600 mb-1.5 font-medium uppercase tracking-wide">Resolution Notes</p>
                  <p className="text-sm text-green-800 bg-green-50 border border-green-100 rounded-xl p-3 leading-relaxed">
                    {activeClaim.resolution}
                  </p>
                </div>
              )}
              {activeClaim.rejectedReason && (
                <div>
                  <p className="text-xs text-red-500 mb-1.5 font-medium uppercase tracking-wide">Rejection Reason</p>
                  <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3 leading-relaxed">
                    {activeClaim.rejectedReason}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              {activeClaim.status === 'PENDING' && (
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => updateMutation.mutate({ id: activeClaim.id, status: 'APPROVED' })}
                    disabled={updateMutation.isPending}
                    className="btn-primary flex-1 bg-green-600 hover:bg-green-700 border-green-600 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Approve Claim
                  </button>
                  <button
                    onClick={() => updateMutation.mutate({ id: activeClaim.id, status: 'REJECTED' })}
                    disabled={updateMutation.isPending}
                    className="flex-1 py-2 px-4 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5">
                    <XCircle className="w-4 h-4" /> Reject Claim
                  </button>
                </div>
              )}
              {activeClaim.status === 'APPROVED' && (
                <button
                  onClick={() => updateMutation.mutate({ id: activeClaim.id, status: 'RESOLVED' })}
                  disabled={updateMutation.isPending}
                  className="btn-primary w-full">
                  Mark as Resolved ✓
                </button>
              )}
              {['RESOLVED', 'REJECTED'].includes(activeClaim.status) && (
                <p className="text-xs text-slate-400 text-center">
                  This claim has been {activeClaim.status.toLowerCase()} and requires no further action.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ClaimField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={`text-sm font-medium text-slate-700 ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}
