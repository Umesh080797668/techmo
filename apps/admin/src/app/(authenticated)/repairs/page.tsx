'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { repairsApi, customersApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import SignaturePad from '@/components/SignaturePad';
import { repairStatusWhatsApp, repairReviewWhatsApp } from '@/lib/whatsapp';
import { Camera, Search, ExternalLink, CheckCircle2, Eye, type LucideIcon } from 'lucide-react';

const STATUS_ORDER = [
  'RECEIVED', 'PENDING_DIAGNOSIS', 'AWAITING_PARTS',
  'UNDER_REPAIR', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED',
];

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: 'badge-gray',
  PENDING_DIAGNOSIS: 'badge-amber',
  AWAITING_PARTS: 'badge-amber',
  UNDER_REPAIR: 'badge-blue',
  READY_FOR_PICKUP: 'badge-green',
  COMPLETED: 'badge-green',
  CANCELLED: 'badge-red',
};

const PHASE_LABELS: Record<string, string> = { BEFORE: 'Before', DURING: 'During', AFTER: 'After' };
const PHASE_ICONS: Record<string, LucideIcon> = { BEFORE: Camera, DURING: CheckCircle2, AFTER: CheckCircle2 };

interface PartInput { name: string; cost: number; quantity: number; }

export default function RepairsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const searchParams = useSearchParams();

  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modals
  const [selectedRepair, setSelectedRepair] = useState<any | null>(null);
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [partsModal, setPartsModal] = useState(false);
  const [parts, setParts] = useState<PartInput[]>([{ name: '', cost: 0, quantity: 1 }]);
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ deviceBrand: '', deviceModel: '', deviceImei: '', issueDescription: '', customerName: '', customerPhone: '', estimatedCost: '' });
  const [customerType, setCustomerType] = useState<'walkin' | 'registered'>('walkin');
  const [lookupPhone, setLookupPhone] = useState('');
  const [foundCustomer, setFoundCustomer] = useState<any | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Auto-open create modal when ?new=1 is in the URL
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setCreateModal(true);
    }
  }, [searchParams]);

  // Photo upload modal
  const [photoModal, setPhotoModal] = useState(false);
  const [photoPhase, setPhotoPhase] = useState<'BEFORE' | 'DURING' | 'AFTER'>('BEFORE');
  const [photoCaption, setPhotoCaption] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Photo viewer modal
  const [photosViewModal, setPhotosViewModal] = useState(false);

  // Signature (complete) modal
  const [sigModal, setSigModal] = useState(false);
  const [sigNotes, setSigNotes] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['repairs', { statusFilter, page }],
    queryFn: () => repairsApi.list({ status: statusFilter, page, limit: 20 }).then(r => r.data),
    refetchInterval: 20_000,
  });

  const repairs: any[] = data?.data ?? data ?? [];
  const total: number = data?.total ?? repairs.length;

  // Photos query (only when viewer is open)
  const { data: photos = [], isLoading: photosLoading } = useQuery({
    queryKey: ['repair-photos', selectedRepair?.id],
    queryFn: () => repairsApi.getPhotos(selectedRepair!.id).then(r => r.data),
    enabled: photosViewModal && !!selectedRepair,
  });

  // Update status
  const statusMutation = useMutation({
    mutationFn: () => repairsApi.updateStatus(selectedRepair!.id, newStatus, statusNotes),
    onSuccess: () => { toast.success('Status updated'); refetch(); setStatusModal(false); setStatusNotes(''); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Update failed'),
  });

  // Add parts
  const partsMutation = useMutation({
    mutationFn: () => repairsApi.addParts(selectedRepair!.id, parts.filter(p => p.name)),
    onSuccess: () => { toast.success('Parts recorded'); refetch(); setPartsModal(false); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to add parts'),
  });

  // Create ticket
  const resetCreateModal = () => {
    setCreateForm({ deviceBrand: '', deviceModel: '', deviceImei: '', issueDescription: '', customerName: '', customerPhone: '', estimatedCost: '' });
    setCustomerType('walkin');
    setLookupPhone('');
    setFoundCustomer(null);
  };

  const handleCustomerLookup = async () => {
    if (!lookupPhone.trim()) return;
    setLookupLoading(true);
    try {
      const res = await customersApi.getByPhone(lookupPhone.trim());
      const c = res.data;
      setFoundCustomer(c);
      setCreateForm(f => ({
        ...f,
        customerName: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
        customerPhone: c.phone ?? lookupPhone.trim(),
      }));
    } catch {
      toast.error('Customer not found');
      setFoundCustomer(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: () => repairsApi.create({
      ...createForm,
      imei: createForm.deviceImei || undefined,
      technicianId: user?.id,
      estimatedCost: Number(createForm.estimatedCost) || undefined,
      ...(customerType === 'registered' && foundCustomer ? { customerId: foundCustomer.id } : {}),
    }),
    onSuccess: () => { toast.success('Repair ticket created'); refetch(); setCreateModal(false); resetCreateModal(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Create failed'),
  });

  const photoUploadMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('phase', photoPhase);
      if (photoCaption) fd.append('caption', photoCaption);
      return repairsApi.uploadPhoto(selectedRepair!.id, fd);
    },
    onSuccess: () => {
      toast.success('Photo uploaded');
      qc.invalidateQueries({ queryKey: ['repair-photos', selectedRepair?.id] });
      setPhotoModal(false);
      setPhotoCaption('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Upload failed'),
  });

  const signatureMutation = useMutation({
    mutationFn: (signatureDataUrl: string) =>
      repairsApi.completeWithSignature(selectedRepair!.id, { signatureDataUrl, notes: sigNotes }),
    onSuccess: () => { toast.success('Repair completed & signed ✓'); refetch(); setSigModal(false); setSigNotes(''); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Completion failed'),
  });

  const stickerMutation = useMutation({
    mutationFn: (id: string) => repairsApi.generateSticker(id),
    onSuccess: (res) => {
      const url: string = res.data?.url;
      if (url) window.open(url, '_blank');
      else toast.error('No sticker URL returned');
    },
    onError: () => toast.error('Sticker generation failed'),
  });

  const openStatusModal = (r: any) => {
    setSelectedRepair(r);
    setNewStatus(r.status);
    setStatusNotes('');
    setStatusModal(true);
  };

  const openPartsModal = (r: any) => {
    setSelectedRepair(r);
    setParts([{ name: '', cost: 0, quantity: 1 }]);
    setPartsModal(true);
  };

  const openPhotoModal = (r: any) => {
    setSelectedRepair(r);
    setPhotoPhase('BEFORE');
    setPhotoCaption('');
    setPhotoModal(true);
  };

  const openPhotosView = (r: any) => {
    setSelectedRepair(r);
    setPhotosViewModal(true);
  };

  const openSigModal = (r: any) => {
    setSelectedRepair(r);
    setSigNotes('');
    setSigModal(true);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) photoUploadMutation.mutate(file);
  };

  const handleWhatsApp = (r: any) => {
    const phone = r.customer?.phone ?? r.customerPhone;
    const name = r.customer?.name ?? r.customerName;
    repairStatusWhatsApp(phone, name, r.ticketNumber, r.status, r.deviceBrand + ' ' + r.deviceModel, r.qrToken ?? r.id);
  };

  const handleReviewRequest = async (r: any) => {
    const res = await repairsApi.getReviewLink(r.id).catch(() => null);
    const link: string = res?.data?.link;
    if (link) window.open(link, '_blank');
    else toast.error('Could not generate review link');
  };

  const updatePart = (i: number, field: keyof PartInput, value: string | number) => {
    setParts(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  };

  const statuses = ['', ...STATUS_ORDER];

  // Group photos by phase
  const photosByPhase: Record<string, any[]> = {};
  for (const p of photos) {
    if (!photosByPhase[p.phase]) photosByPhase[p.phase] = [];
    photosByPhase[p.phase].push(p);
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Repair Tickets</h1>
          <p className="page-subtitle">{total.toLocaleString()} tickets</p>
        </div>
        <button onClick={() => setCreateModal(true)} className="btn-primary">+ New Ticket</button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {statuses.map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={statusFilter === s ? 'tab-pill-on' : 'tab-pill-off'}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="table-card">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              {['Ticket #', 'Device', 'Issue', 'Customer', 'Est. Cost', 'Status', 'Created', 'Actions'].map(h => (
                <th key={h} className="table-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="table-td text-center py-10 text-slate-400">Loading…</td></tr>
            )}
            {!isLoading && repairs.length === 0 && (
              <tr><td colSpan={8} className="table-td text-center py-10 text-slate-400">No tickets found</td></tr>
            )}
            {repairs.map((r: any) => (
              <tr key={r.id} className="table-tr">
                <td className="table-td font-mono text-xs font-semibold text-primary">{r.ticketNumber}</td>
                <td className="table-td">
                  <div className="font-medium">{r.deviceBrand} {r.deviceModel}</div>
                  {r.imei && <div className="text-xs text-slate-400">IMEI: {r.imei}</div>}
                </td>
                <td className="table-td max-w-[120px]">
                  <p className="truncate text-slate-600">{r.issueDescription}</p>
                </td>
                <td className="table-td">
                  <div>{r.customer?.name ?? r.customerName}</div>
                  <div className="text-xs text-slate-400">{r.customer?.phone ?? r.customerPhone}</div>
                </td>
                <td className="table-td">
                  {r.estimatedCost ? `LKR ${Number(r.estimatedCost).toLocaleString()}` : <span className="text-slate-400">TBD</span>}
                </td>
                <td className="table-td">
                  <span className={`badge ${STATUS_COLORS[r.status] ?? 'badge-gray'}`}>{r.status}</span>
                </td>
                <td className="table-td text-slate-400 text-xs">
                  {format(new Date(r.createdAt), 'dd MMM HH:mm')}
                </td>
                <td className="table-td">
                  <Link
                    href={`/repairs/${r.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>

      {total > 20 && (
        <div className="flex items-center justify-center gap-1.5">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="page-btn">← Prev</button>
          <span className="text-xs text-slate-400 tabular self-center px-1">Page {page}</span>
          <button disabled={repairs.length < 20} onClick={() => setPage(p => p + 1)} className="page-btn">Next →</button>
        </div>
      )}

      {/* Status Update Modal */}
      {statusModal && selectedRepair && (
        <div className="modal-overlay" onClick={() => setStatusModal(false)}>
          <div className="modal-panel max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title mb-1">Update Status</h3>
            <p className="text-sm text-slate-400 mb-4">{selectedRepair.ticketNumber} — {selectedRepair.deviceBrand} {selectedRepair.deviceModel}</p>
            <label className="label">New Status</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="input mb-4">
              {STATUS_ORDER.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="label">Tech Notes (optional)</label>
            <textarea value={statusNotes} onChange={e => setStatusNotes(e.target.value)} rows={3}
              className="input resize-none mb-4" placeholder="Describe work done…" />
            <div className="flex gap-3">
              <button onClick={() => statusMutation.mutate()} disabled={statusMutation.isPending || newStatus === selectedRepair.status}
                className="btn-primary flex-1">{statusMutation.isPending ? 'Updating…' : 'Update'}</button>
              <button onClick={() => setStatusModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Parts Modal */}
      {partsModal && selectedRepair && (
        <div className="modal-overlay" onClick={() => setPartsModal(false)}>
          <div className="modal-panel max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title mb-4">Add Parts Used</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {parts.map((part, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={part.name} onChange={e => updatePart(i, 'name', e.target.value)}
                    className="input flex-1 text-sm" placeholder="Part name" />
                  <input type="number" value={part.cost} onChange={e => updatePart(i, 'cost', Number(e.target.value))}
                    className="input w-24 text-sm" placeholder="Cost" />
                  <input type="number" value={part.quantity} min={1} onChange={e => updatePart(i, 'quantity', Number(e.target.value))}
                    className="input w-16 text-sm" placeholder="Qty" />
                </div>
              ))}
            </div>
            <button onClick={() => setParts(p => [...p, { name: '', cost: 0, quantity: 1 }])}
              className="text-xs text-primary mt-2 hover:underline">+ Add Row</button>
            <div className="flex gap-3 mt-4">
              <button onClick={() => partsMutation.mutate()} disabled={partsMutation.isPending}
                className="btn-primary flex-1">{partsMutation.isPending ? 'Saving…' : 'Save Parts'}</button>
              <button onClick={() => setPartsModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {createModal && (
        <div className="modal-overlay" onClick={() => { setCreateModal(false); resetCreateModal(); }}>
          <div className="modal-panel max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-hd">
              <h3 className="modal-title">New Repair Ticket</h3>
              <button onClick={() => { setCreateModal(false); resetCreateModal(); }} className="btn-icon text-base">✕</button>
            </div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Device Brand *</label>
                <input value={createForm.deviceBrand} onChange={e => setCreateForm(f => ({ ...f, deviceBrand: e.target.value }))}
                  className="input" placeholder="Samsung" />
              </div>
              <div>
                <label className="label">Device Model *</label>
                <input value={createForm.deviceModel} onChange={e => setCreateForm(f => ({ ...f, deviceModel: e.target.value }))}
                  className="input" placeholder="Galaxy S24" />
              </div>
              <div>
                <label className="label">IMEI / Serial</label>
                <input value={createForm.deviceImei} onChange={e => setCreateForm(f => ({ ...f, deviceImei: e.target.value }))}
                  className="input font-mono" />
              </div>
              <div>
                <label className="label">Estimated Cost (LKR)</label>
                <input type="number" value={createForm.estimatedCost} onChange={e => setCreateForm(f => ({ ...f, estimatedCost: e.target.value }))}
                  className="input" />
              </div>
            </div>

            {/* Customer section */}
            <div>
              <div className="flex rounded-lg overflow-hidden border border-slate-200 mb-3">
                <button
                  onClick={() => { setCustomerType('walkin'); setFoundCustomer(null); setLookupPhone(''); setCreateForm(f => ({ ...f, customerName: '', customerPhone: '' })); }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    customerType === 'walkin' ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                  Walk-in Customer
                </button>
                <button
                  onClick={() => { setCustomerType('registered'); setCreateForm(f => ({ ...f, customerName: '', customerPhone: '' })); }}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    customerType === 'registered' ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}>
                  Registered Customer
                </button>
              </div>

              {customerType === 'registered' ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      value={lookupPhone}
                      onChange={e => { setLookupPhone(e.target.value); setFoundCustomer(null); }}
                      onKeyDown={e => e.key === 'Enter' && handleCustomerLookup()}
                      className="input flex-1"
                      placeholder="Search by phone number…"
                    />
                    <button onClick={handleCustomerLookup} disabled={lookupLoading || !lookupPhone.trim()} className="btn-primary px-4 flex items-center gap-1">
                      {lookupLoading ? '…' : <Search className="w-4 h-4" />}
                    </button>
                  </div>
                  {foundCustomer && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                      <p className="font-semibold text-green-800">{createForm.customerName}</p>
                      <p className="text-green-600">{foundCustomer.phone} · {foundCustomer.tier}</p>
                      <p className="text-green-500 text-xs">{foundCustomer.loyaltyPoints ?? 0} loyalty pts</p>
                    </div>
                  )}
                  {!foundCustomer && lookupPhone && (
                    <p className="text-xs text-slate-400">Press Search icon or Enter to search</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Customer Name *</label>
                    <input value={createForm.customerName} onChange={e => setCreateForm(f => ({ ...f, customerName: e.target.value }))}
                      className="input" />
                  </div>
                  <div>
                    <label className="label">Customer Phone *</label>
                    <input value={createForm.customerPhone} onChange={e => setCreateForm(f => ({ ...f, customerPhone: e.target.value }))}
                      className="input" />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="label">Issue Description *</label>
              <textarea value={createForm.issueDescription}
                onChange={e => setCreateForm(f => ({ ...f, issueDescription: e.target.value }))}
                rows={3} className="input resize-none" placeholder="Describe the problem…" />
            </div>
            </div>
            <div className="modal-ft">
              <button onClick={() => { setCreateModal(false); resetCreateModal(); }} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}
                className="btn-primary flex-1">{createMutation.isPending ? 'Creating…' : 'Create Ticket'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Upload Modal */}
      {photoModal && selectedRepair && (
        <div className="modal-overlay" onClick={() => setPhotoModal(false)}>
          <div className="modal-panel max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title mb-4">Upload Repair Photo</h3>
            <p className="text-sm text-slate-400 mb-4">{selectedRepair.ticketNumber} — {selectedRepair.deviceBrand} {selectedRepair.deviceModel}</p>
            <label className="label">Phase</label>
            <select value={photoPhase} onChange={e => setPhotoPhase(e.target.value as any)} className="input mb-4">
              <option value="BEFORE">Before Repair</option>
              <option value="DURING">During Repair</option>
              <option value="AFTER">After Repair</option>
            </select>
            <label className="label">Caption (optional)</label>
            <input value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} className="input mb-4" placeholder="e.g. Cracked screen close-up" />
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFileChange} />
            <button onClick={() => photoInputRef.current?.click()} disabled={photoUploadMutation.isPending} className="btn-primary w-full flex items-center justify-center gap-1.5">
              <Camera className="w-4 h-4" />
              {photoUploadMutation.isPending ? 'Uploading…' : 'Choose & Upload Photo'}
            </button>
            <button onClick={() => setPhotoModal(false)} className="btn-secondary w-full mt-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Photos Gallery Modal */}
      {photosViewModal && selectedRepair && (
        <div className="modal-overlay" onClick={() => setPhotosViewModal(false)}>
          <div className="modal-panel max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="modal-title">Photos — {selectedRepair.ticketNumber}</h3>
              <button onClick={() => setPhotosViewModal(false)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
            </div>
            {photosLoading && <p className="text-slate-400 text-center py-6">Loading…</p>}
            {!photosLoading && photos.length === 0 && (
              <p className="text-slate-400 text-center py-8">No photos yet.</p>
            )}
            {['BEFORE', 'DURING', 'AFTER'].map(phase => {
              const pics = photosByPhase[phase] ?? [];
              if (!pics.length) return null;
              return (
                <div key={phase} className="mb-6">
                  <h4 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                      {(() => { const Icon = PHASE_ICONS[phase]; return Icon ? <Icon className="w-4 h-4" /> : null; })()}
                      {PHASE_LABELS[phase]}
                    </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {pics.map((photo: any) => (
                      <div key={photo.id} className="relative group">
                        <img src={photo.cloudinaryUrl} alt={photo.caption ?? phase}
                          className="w-full aspect-square object-cover rounded-lg border border-slate-200" />
                        {photo.caption && <p className="text-xs text-slate-500 mt-1 truncate">{photo.caption}</p>}
                        <a href={photo.cloudinaryUrl} target="_blank" rel="noreferrer"
                          className="absolute top-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Signature / Collection Modal */}
      {sigModal && selectedRepair && (
        <div className="modal-overlay" onClick={() => setSigModal(false)}>
          <div className="modal-panel max-w-xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title mb-1">Device Collection — Customer Signature</h3>
            <p className="text-sm text-slate-400 mb-4">
              {selectedRepair.ticketNumber} — {selectedRepair.deviceBrand} {selectedRepair.deviceModel}{' '}|{' '}
              <strong>{selectedRepair.customer?.name ?? selectedRepair.customerName}</strong>
            </p>
            <label className="label">Completion Notes (optional)</label>
            <textarea value={sigNotes} onChange={e => setSigNotes(e.target.value)} rows={2}
              className="input resize-none mb-4" placeholder="Any final notes…" />
            <SignaturePad
              onConfirm={(dataUrl) => signatureMutation.mutate(dataUrl)}
              onCancel={() => setSigModal(false)}
            />
            {signatureMutation.isPending && (
              <p className="text-sm text-slate-500 text-center mt-3 animate-pulse">Generating receipt & marking complete…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
