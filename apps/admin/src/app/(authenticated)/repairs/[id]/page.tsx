'use client';
import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { repairsApi, workerApi } from '@/lib/api';
import SignaturePad from '@/components/SignaturePad';
import { repairStatusWhatsApp, courierDispatchWhatsApp } from '@/lib/whatsapp';
import { buildReviewWhatsAppLink } from '@/lib/review-request';
import { Camera, Wrench, CheckCircle2, Tag, FileText, FileCheck, Bot, Sparkles, MessageCircle, Star, ClipboardList, Video, Truck, AlertTriangle, Search, Pencil, ExternalLink, Save, Smile, Frown, Meh, PenLine, type LucideIcon } from 'lucide-react';

// ── Lazy-loaded hardware / heavy components (SSR-safe) ────────────────────
const CourierTracking    = dynamic(() => import('@/components/CourierTracking'),    { ssr: false });
const DamageMarkup       = dynamic(() => import('@/components/DamageMarkup'),       { ssr: false });
const RepairVideoCapture = dynamic(() => import('@/components/RepairVideoCapture'), { ssr: false });
const OcrScanner         = dynamic(() => import('@/components/OcrScanner'),         { ssr: false });


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

const PHASE_LABELS: Record<string, string> = {
  BEFORE: 'Before',
  DURING: 'During',
  AFTER: 'After',
};

const PHASE_ICONS: Record<string, LucideIcon> = {
  BEFORE: Camera,
  DURING: Wrench,
  AFTER: CheckCircle2,
};

const STATUS_STEPS = [
  { key: 'RECEIVED', label: 'Received' },
  { key: 'PENDING_DIAGNOSIS', label: 'Diagnosing' },
  { key: 'AWAITING_PARTS', label: 'Awaiting Parts' },
  { key: 'UNDER_REPAIR', label: 'Under Repair' },
  { key: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
  { key: 'COMPLETED', label: 'Completed' },
];

const VALID_TRANSITIONS: Record<string, string[]> = {
  RECEIVED:          ['PENDING_DIAGNOSIS', 'CANCELLED'],
  PENDING_DIAGNOSIS: ['AWAITING_PARTS', 'UNDER_REPAIR', 'CANCELLED'],
  AWAITING_PARTS:    ['UNDER_REPAIR', 'CANCELLED'],
  UNDER_REPAIR:      ['READY_FOR_PICKUP', 'AWAITING_PARTS', 'CANCELLED'],
  READY_FOR_PICKUP:  ['COMPLETED', 'UNDER_REPAIR'],
  COMPLETED:         [],
  CANCELLED:         [],
};

type Tab = 'details' | 'photos' | 'timeline' | 'parts' | 'courier' | 'video';

export default function RepairDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('details');

  // Modals
  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');

  const [partsModal, setPartsModal] = useState(false);
  const [parts, setParts] = useState<{ productName: string; sku: string; unitCost: number; quantity: number }[]>([{ productName: '', sku: '', unitCost: 0, quantity: 1 }]);

  const [photoModal, setPhotoModal] = useState(false);
  const [photoPhase, setPhotoPhase] = useState<'BEFORE' | 'DURING' | 'AFTER'>('BEFORE');
  const [photoCaption, setPhotoCaption] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [sigModal, setSigModal] = useState(false);
  const [sigNotes, setSigNotes] = useState('');

  // New component modals
  const [ocrModal, setOcrModal]                   = useState(false);
  const [damageMarkupModal, setDamageMarkupModal] = useState(false);
  const [damageMarkupUrl, setDamageMarkupUrl]     = useState('');
  const [damageMarkupPhotoId, setDamageMarkupPhotoId] = useState<string | null>(null);
  const [repairVideoUrl, setRepairVideoUrl]       = useState('');
  const [courierForm, setCourierForm]             = useState({ trackingNumber: '', carrier: 'slpost' });


  // AI modal state
  const [aiModal, setAiModal] = useState<null | 'advice' | 'sentiment'>(null);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Courier mutation
  const saveCourierMutation = useMutation({
    mutationFn: () => repairsApi.saveCourierInfo(id, courierForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repair', id] });
      toast.success('Courier tracking saved');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to save courier info'),
  });

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: repair, isLoading, error } = useQuery({
    queryKey: ['repair', id],
    queryFn: () => repairsApi.get(id).then(r => r.data),
    enabled: !!id,
  });

  const { data: photos = [], isLoading: photosLoading } = useQuery({
    queryKey: ['repair-photos', id],
    queryFn: () => repairsApi.getPhotos(id).then(r => r.data),
    enabled: !!id && activeTab === 'photos',
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: () => repairsApi.updateStatus(id, newStatus, statusNotes),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['repair', id] });
      setStatusModal(false);
      setStatusNotes('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Update failed'),
  });

  const partsMutation = useMutation({
    mutationFn: () => repairsApi.addParts(id,
      parts.filter(p => p.productName.trim()).map(p => ({ productId: '', ...p }))
    ),
    onSuccess: () => {
      toast.success('Parts recorded');
      qc.invalidateQueries({ queryKey: ['repair', id] });
      setPartsModal(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const photoUploadMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('phase', photoPhase);
      if (photoCaption) fd.append('caption', photoCaption);
      return repairsApi.uploadPhoto(id, fd);
    },
    onSuccess: () => {
      toast.success('Photo uploaded');
      qc.invalidateQueries({ queryKey: ['repair-photos', id] });
      setPhotoModal(false);
      setPhotoCaption('');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Upload failed'),
  });

  const signatureMutation = useMutation({
    mutationFn: (signatureDataUrl: string) =>
      repairsApi.completeWithSignature(id, { signatureDataUrl, notes: sigNotes }),
    onSuccess: () => {
      toast.success('Repair completed & customer signature captured ✓');
      qc.invalidateQueries({ queryKey: ['repair', id] });
      setSigModal(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Completion failed'),
  });

  const stickerMutation = useMutation({
    mutationFn: () => repairsApi.generateSticker(id),
    onSuccess: (res) => {
      const url: string = res.data?.url;
      if (url) window.open(url, '_blank');
      else toast.error('No sticker URL returned');
    },
    onError: () => toast.error('Sticker generation failed'),
  });

  const repairReceiptMutation = useMutation({
    mutationFn: () => workerApi.repairReceiptPdf({
      ticket_number: repair!.ticketNumber,
      customer_name:  repair!.customer?.name  ?? repair!.customerName,
      customer_phone: repair!.customer?.phone ?? repair!.customerPhone,
      device: `${repair!.deviceBrand} ${repair!.deviceModel}`,
      issue: repair!.issueDescription,
      status: repair!.status,
      estimated_cost: Number(repair!.estimatedCost ?? 0),
      qr_token: repair!.qrToken ?? repair!.id,
    }),
    onSuccess: (res) => {
      const url: string = res.data?.url;
      if (url) window.open(url, '_blank');
      else toast.error('No PDF URL returned');
    },
    onError: () => toast.error('Receipt PDF generation failed'),
  });

  const signedReceiptMutation = useMutation({
    mutationFn: () => workerApi.signedReceiptPdf({
      ticket_number:    repair!.ticketNumber,
      customer_name:    repair!.customer?.name  ?? repair!.customerName,
      customer_phone:   repair!.customer?.phone ?? repair!.customerPhone,
      device: `${repair!.deviceBrand} ${repair!.deviceModel}`,
      issue: repair!.issueDescription,
      final_cost:       Number(repair!.finalCost ?? repair!.estimatedCost ?? 0),
      technician_notes: repair!.notes ?? '',
      signature_data_url: repair!.signatureDataUrl ?? '',
      after_photos:     [],
      completed_at:     repair!.completedAt ?? new Date().toISOString(),
    }),
    onSuccess: (res) => {
      const url: string = res.data?.url;
      if (url) window.open(url, '_blank');
      else toast.error('No PDF URL returned');
    },
    onError: () => toast.error('Signed receipt PDF generation failed'),
  });

  /** Poll AI job until status is 'done' or 'failed', max 60 s */
  const pollAiJob = async (jobId: string): Promise<any> => {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 1500));
      const poll = await workerApi.aiJobStatus(jobId);
      if (poll.data?.status === 'done')   return poll.data.result;
      if (poll.data?.status === 'failed') throw new Error(poll.data.error ?? 'AI job failed');
    }
    throw new Error('AI timed out after 60 s');
  };

  const handleAiAdvice = async () => {
    if (!repair) return;
    setAiModal('advice');
    setAiResult(null);
    setAiLoading(true);
    try {
      const res = await workerApi.aiRepairAdvice({
        device_model: `${repair.deviceBrand} ${repair.deviceModel}`,
        reported_fault: repair.issueDescription,
      });
      // Worker returns { jobId, status: 'queued' } — poll until done
      const result = res.data?.jobId
        ? await pollAiJob(res.data.jobId)
        : res.data;
      setAiResult(result);
    } catch (e: any) {
      toast.error(e?.message ?? 'AI service unavailable — ensure Ollama is running');
      setAiModal(null);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiSentiment = async () => {
    if (!repair) return;
    setAiModal('sentiment');
    setAiResult(null);
    setAiLoading(true);
    try {
      const res = await workerApi.aiRepairSentiment({
        technician_notes: repair.notes ?? '',
        customer_complaint: repair.issueDescription,
      });
      // Worker returns { jobId, status: 'queued' } — poll until done
      const result = res.data?.jobId
        ? await pollAiJob(res.data.jobId)
        : res.data;
      setAiResult(result);
    } catch (e: any) {
      toast.error(e?.message ?? 'AI service unavailable — ensure Ollama is running');
      setAiModal(null);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleWhatsApp = () => {
    if (!repair) return;
    const phone = repair.customer?.phone ?? repair.customerPhone;
    const name  = repair.customer?.name  ?? repair.customerName;
    const link  = repairStatusWhatsApp(phone, name, repair.ticketNumber, repair.status, `${repair.deviceBrand} ${repair.deviceModel}`, repair.qrToken ?? repair.id);
    window.open(link, '_blank');
  };

  const handleReviewRequest = () => {
    if (!repair) return;
    const phone = repair.customer?.phone ?? repair.customerPhone;
    const name  = repair.customer?.name  ?? repair.customerName;
    const link  = buildReviewWhatsAppLink(phone, name);
    window.open(link, '_blank');
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) photoUploadMutation.mutate(file);
  };

  // ── Early returns ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !repair) {
    return (
      <div className="text-center py-24">
        <p className="text-slate-500 mb-4">Repair ticket not found.</p>
        <Link href="/repairs" className="btn-secondary">← Back to Repairs</Link>
      </div>
    );
  }

  const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === repair.status);
  const photosByPhase: Record<string, any[]> = {};
  for (const p of photos) {
    if (!photosByPhase[p.phase]) photosByPhase[p.phase] = [];
    photosByPhase[p.phase].push(p);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fadeIn">
      {/* ── Breadcrumb & Header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/repairs" className="text-slate-400 hover:text-primary transition-colors">← Repairs</Link>
        <span className="text-slate-300">/</span>
        <span className="font-semibold text-slate-700">{repair.ticketNumber}</span>
        <span className={`badge ${STATUS_COLORS[repair.status] ?? 'badge-gray'} ml-1`}>{repair.status.replace(/_/g, ' ')}</span>
      </div>

      {/* ── Summary card ────────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex flex-wrap gap-4 justify-between">
          <div>
            <h1 className="page-title">{repair.deviceBrand} {repair.deviceModel}</h1>
            {repair.imei && (
              <p className="text-xs text-slate-400 font-mono mt-0.5">IMEI: {repair.imei}</p>
            )}
            <p className="text-sm text-slate-500 mt-1">{repair.issueDescription}</p>
          </div>

          <div className="text-left sm:text-right space-y-0.5">
            <p className="text-sm font-semibold text-slate-700">
              {repair.customer?.name ?? repair.customerName}
            </p>
            <p className="text-sm text-slate-400">{repair.customer?.phone ?? repair.customerPhone}</p>
            <p className="text-xs text-slate-400">
              Created {format(new Date(repair.createdAt), 'dd MMM yyyy HH:mm')}
            </p>
          </div>
        </div>

        {/* Costs */}
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-slate-400">Est. Cost</span>
            <p className="font-semibold text-slate-700">
              {repair.estimatedCost ? `LKR ${Number(repair.estimatedCost).toLocaleString()}` : <span className="text-slate-400">TBD</span>}
            </p>
          </div>
          {repair.finalCost && (
            <div>
              <span className="text-slate-400">Final Cost</span>
              <p className="font-semibold text-emerald-600">LKR {Number(repair.finalCost).toLocaleString()}</p>
            </div>
          )}
          {repair.technicianId && (
            <div>
              <span className="text-slate-400">Technician</span>
              <p className="font-semibold text-slate-700">{repair.technician?.name ?? repair.technicianId}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-5 flex flex-wrap gap-2">
          {repair.status === 'READY_FOR_PICKUP' ? (
            <button onClick={() => setSigModal(true)} className="btn-primary text-sm flex items-center gap-1.5">
              <PenLine className="w-3.5 h-3.5" /> Collect &amp; Sign
            </button>
          ) : !['COMPLETED', 'CANCELLED'].includes(repair.status) && (
            <button onClick={() => { const valid = VALID_TRANSITIONS[repair.status] ?? []; setNewStatus(valid[0] ?? ''); setStatusModal(true); }} className="btn-primary text-sm">
              ↻ Update Status
            </button>
          )}
          {!['COMPLETED', 'CANCELLED'].includes(repair.status) && (
            <button onClick={() => setPartsModal(true)} className="btn-secondary text-sm flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" /> Add Parts
            </button>
          )}
          {!['COMPLETED', 'CANCELLED'].includes(repair.status) && (
            <button onClick={() => setPhotoModal(true)} className="btn-secondary text-sm flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" /> Upload Photo
            </button>
          )}
          <button onClick={() => stickerMutation.mutate()} disabled={stickerMutation.isPending}
            className="btn-secondary text-sm disabled:opacity-50 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" /> {stickerMutation.isPending ? 'Generating…' : 'Print Status Sticker'}
          </button>
          <button onClick={() => repairReceiptMutation.mutate()} disabled={repairReceiptMutation.isPending}
            className="btn-secondary text-sm disabled:opacity-50 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> {repairReceiptMutation.isPending ? 'Generating…' : 'Repair Receipt'}
          </button>
          {repair.status === 'COMPLETED' && (
            <button onClick={() => signedReceiptMutation.mutate()} disabled={signedReceiptMutation.isPending}
              className="btn-secondary text-sm disabled:opacity-50 flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5" /> {signedReceiptMutation.isPending ? 'Generating…' : 'Signed Receipt'}
            </button>
          )}
          <button onClick={handleAiAdvice}
            className="btn-secondary text-sm text-violet-700 border-violet-200 hover:bg-violet-50 flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5" /> AI Repair Advice
          </button>
          <button onClick={handleAiSentiment}
            className="btn-secondary text-sm text-violet-700 border-violet-200 hover:bg-violet-50 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Sentiment Analysis
          </button>
          <button onClick={handleWhatsApp} className="btn-secondary text-sm text-green-700 border-green-200 hover:bg-green-50 flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Notify
          </button>
          {repair.status === 'COMPLETED' && (
            <button onClick={handleReviewRequest} className="btn-secondary text-sm text-amber-600 border-amber-200 hover:bg-amber-50 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5" /> Request Review
            </button>
          )}
        </div>
      </div>

      {/* ── Status Timeline ──────────────────────────────────────────────── */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-600 mb-4">Repair Progress</h2>
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {STATUS_STEPS.map((step, idx) => {
            const isDone    = idx < currentStepIdx;
            const isCurrent = idx === currentStepIdx;
            const isCancel  = repair.status === 'CANCELLED';
            return (
              <div key={step.key} className="flex items-center min-w-0">
                <div className="flex flex-col items-center min-w-[80px]">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isCancel ? 'bg-red-100 text-red-400 border-2 border-red-200' :
                    isDone    ? 'bg-emerald-500 text-white' :
                    isCurrent ? 'bg-primary text-white ring-4 ring-primary/20' :
                               'bg-slate-100 text-slate-400 border-2 border-slate-200'
                  }`}>
                    {isDone ? '✓' : idx + 1}
                  </div>
                  <span className={`text-[10px] mt-1 text-center leading-tight ${
                    isCurrent ? 'text-primary font-semibold' : 'text-slate-400'
                  }`}>{step.label}</span>
                </div>
                {idx < STATUS_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 min-w-[24px] mx-1 ${
                    idx < currentStepIdx ? 'bg-emerald-400' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex border-b border-slate-100 flex-wrap">
          {(['details', 'photos', 'timeline', 'parts'] as Tab[]).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-5 py-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                activeTab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {t === 'photos' ? <><Camera className="w-3.5 h-3.5" /> Photo Timeline</> :
               t === 'timeline' ? <><ClipboardList className="w-3.5 h-3.5" /> Status History</> :
               t === 'parts' ? <><Wrench className="w-3.5 h-3.5" /> Parts Used</> :
               <><FileText className="w-3.5 h-3.5" /> Details</>}
            </button>
          ))}
          <button onClick={() => setActiveTab('video')}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === 'video'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <Video className="w-3.5 h-3.5" /> Proof Video
          </button>
          <button onClick={() => setActiveTab('courier')}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
              activeTab === 'courier'
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <Truck className="w-3.5 h-3.5" /> Courier
          </button>
        </div>

        <div className="p-6">
          {/* Details tab */}
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Detail label="Ticket #" value={repair.ticketNumber} mono />
              <Detail label="Status" value={repair.status.replace(/_/g, ' ')} />
              <Detail label="Device" value={`${repair.deviceBrand} ${repair.deviceModel}`} />
              <div>
                <p className="text-xs text-slate-400 mb-0.5">IMEI / Serial</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs font-medium text-slate-700">{repair.imei ?? '—'}</p>
                  <button onClick={() => setOcrModal(true)}
                    className="text-[10px] text-indigo-500 hover:underline border border-indigo-100 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                    <Search className="w-2.5 h-2.5" /> Scan
                  </button>
                </div>
              </div>
              <Detail label="Customer" value={repair.customer?.name ?? repair.customerName} />
              <Detail label="Phone" value={repair.customer?.phone ?? repair.customerPhone} />
              <Detail label="Issue" value={repair.issueDescription} full />
              {repair.notes && <Detail label="Tech Notes" value={repair.notes} full />}
              <Detail label="Est. Cost" value={repair.estimatedCost ? `LKR ${Number(repair.estimatedCost).toLocaleString()}` : 'TBD'} />
              {repair.finalCost && <Detail label="Final Cost" value={`LKR ${Number(repair.finalCost).toLocaleString()}`} />}
              {repair.completionReceiptUrl && (
                <div className="col-span-2">
                  <p className="text-slate-400 mb-1">Signed Receipt PDF</p>
                  <a href={repair.completionReceiptUrl} target="_blank" rel="noreferrer"
                    className="text-primary hover:underline text-sm flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> View / Download Receipt
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Photo Timeline tab */}
          {activeTab === 'photos' && (
            <div>
              <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <p className="text-sm text-slate-500">
                  {photos.length} photo{photos.length !== 1 ? 's' : ''} across{' '}
                  {Object.keys(photosByPhase).length} phase{Object.keys(photosByPhase).length !== 1 ? 's' : ''}
                </p>
                {!['COMPLETED', 'CANCELLED'].includes(repair.status) && (
                  <button onClick={() => setPhotoModal(true)} className="btn-secondary text-sm">
                    + Upload Photo
                  </button>
                )}
              </div>

              {photosLoading && <p className="text-slate-400 text-center py-10">Loading photos…</p>}
              {!photosLoading && photos.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  <Camera className="w-10 h-10 mx-auto mb-2" />
                  <p>No photos yet. Upload before/during/after images to build the repair timeline.</p>
                </div>
              )}

              {['BEFORE', 'DURING', 'AFTER'].map(phase => {
                const pics = photosByPhase[phase] ?? [];
                if (!pics.length) return null;
                return (
                  <div key={phase} className="mb-8">
                    <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-1.5">
                      {(() => { const Icon = PHASE_ICONS[phase]; return Icon ? <Icon className="w-4 h-4" /> : null; })()}
                      {PHASE_LABELS[phase]}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {pics.map((photo: any) => (
                        <div key={photo.id} className="relative group rounded-xl overflow-hidden border border-slate-100">
                          <img src={photo.cloudinaryUrl} alt={photo.caption ?? phase}
                            className="w-full aspect-video object-cover" />
                          <div className="p-2">
                            {photo.caption && <p className="text-xs text-slate-500 truncate">{photo.caption}</p>}
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {format(new Date(photo.createdAt), 'dd MMM HH:mm')}
                            </p>
                            {phase === 'BEFORE' && (
                              <button
                                onClick={() => { setDamageMarkupUrl(photo.cloudinaryUrl); setDamageMarkupPhotoId(photo.id); setDamageMarkupModal(true); }}
                                className="mt-1 text-[10px] text-amber-600 hover:underline flex items-center gap-0.5">
                                <Pencil className="w-2.5 h-2.5" /> Annotate damage
                              </button>
                            )}
                          </div>
                          <a href={photo.cloudinaryUrl} target="_blank" rel="noreferrer"
                            className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> View
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Status History tab */}
          {activeTab === 'timeline' && (
            <div>
              {(!repair.statusHistory || repair.statusHistory.length === 0) ? (
                <p className="text-slate-400 text-center py-8">No status history recorded yet.</p>
              ) : (
                <ol className="relative border-l border-slate-200 ml-2 space-y-4">
                  {repair.statusHistory?.map((entry: any) => (
                    <li key={entry.id} className="ml-4">
                      <span className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-primary border-2 border-white" />
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className={`badge ${STATUS_COLORS[entry.status] ?? 'badge-gray'} text-xs`}>
                          {entry.status.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-slate-400">
                          {format(new Date(entry.createdAt), 'dd MMM yyyy HH:mm')}
                        </span>
                        {entry.updatedBy && (
                          <span className="text-xs text-slate-400">— {entry.updatedBy}</span>
                        )}
                      </div>
                      {entry.notes && <p className="text-sm text-slate-600">{entry.notes}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* Parts Used tab */}
          {activeTab === 'parts' && (
            <div>
              <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <p className="text-sm text-slate-500">{(repair.parts ?? []).length} part(s) recorded</p>
                {!['COMPLETED', 'CANCELLED'].includes(repair.status) && (
                  <button onClick={() => setPartsModal(true)} className="btn-secondary text-sm">
                    + Add Parts
                  </button>
                )}
              </div>
              {(!repair.parts || repair.parts.length === 0) ? (
                <p className="text-slate-400 text-center py-8">No parts recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr>
                      {['Part Name', 'Quantity', 'Unit Cost', 'Total'].map(h => (
                        <th key={h} className="table-th">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {repair.parts.map((p: any, i: number) => (
                      <tr key={i} className="table-tr">
                        <td className="table-td font-medium">{p.productName ?? p.name}</td>
                        <td className="table-td">{p.quantity}</td>
                        <td className="table-td">LKR {Number(p.unitCost ?? p.cost).toLocaleString()}</td>
                        <td className="table-td font-semibold">
                          LKR {(Number(p.unitCost ?? p.cost) * Number(p.quantity)).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          )}

          {/* Proof Video tab */}
          {activeTab === 'video' && (
            <div>
              <p className="text-sm text-slate-500 mb-4">
                Record a short proof-of-function video (max 10 s) showing the device working after repair.
                Uploaded to Cloudinary and shared with the customer.
              </p>
              <RepairVideoCapture
                ticketRef={repair.ticketNumber}
                existingVideoUrl={repairVideoUrl || repair.completionVideoUrl || repair.videoUrl}
                onUploaded={(url) => {
                  setRepairVideoUrl(url);
                  toast.success('Proof video saved');
                }}
              />
            </div>
          )}

          {/* Courier Tracking tab */}
          {activeTab === 'courier' && (
            <div className="space-y-6">
              {/* Tracking number input form */}
              <div className="card p-5 border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5"><Truck className="w-4 h-4" /> Courier Shipment Details</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Assign a courier tracking number to this repair ticket (e.g. when a device is shipped to/from a supplier or branch).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Tracking Number</label>
                    <input
                      className="input w-full"
                      placeholder="e.g. 1234567890"
                      value={courierForm.trackingNumber || repair?.courierTrackingNumber || ''}
                      onChange={e => setCourierForm(f => ({ ...f, trackingNumber: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Carrier</label>
                    <select
                      className="input w-full"
                      value={courierForm.carrier || repair?.courierCarrier || 'slpost'}
                      onChange={e => setCourierForm(f => ({ ...f, carrier: e.target.value }))}
                    >
                      <option value="slpost">Sri Lanka Post</option>
                      <option value="dhl">DHL Express</option>
                      <option value="17track">17TRACK (multi-carrier)</option>
                      <option value="fedex">FedEx</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    if (!courierForm.trackingNumber && !repair?.courierTrackingNumber) {
                      toast.error('Enter a tracking number first');
                      return;
                    }
                    if (!courierForm.trackingNumber) {
                      setCourierForm(f => ({ ...f, trackingNumber: repair?.courierTrackingNumber ?? '' }));
                    }
                    saveCourierMutation.mutate();
                  }}
                  disabled={saveCourierMutation.isPending}
                  className="btn-primary text-sm disabled:opacity-50 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" /> {saveCourierMutation.isPending ? 'Saving…' : 'Save Tracking Info'}
                </button>

                {/* WhatsApp delivery link — shown once tracking number is set */}
                {(repair?.courierTrackingNumber || courierForm.trackingNumber) && repair?.customerPhone && (
                  <a
                    href={courierDispatchWhatsApp(
                      repair.customerPhone,
                      repair.customerName,
                      repair.ticketNumber,
                      `${repair.deviceBrand} ${repair.deviceModel}`,
                      courierForm.carrier || repair.courierCarrier || 'slpost',
                      courierForm.trackingNumber || repair.courierTrackingNumber,
                      repair.qrToken ?? repair.id,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary text-sm flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-4 h-4 text-green-600" />
                    Send Delivery Link to Customer
                  </a>
                )}
                </div>
              </div>

              {/* Live tracking events */}
              {(repair?.courierTrackingNumber || courierForm.trackingNumber) && (
                <CourierTracking
                  ticketRef={repair.ticketNumber}
                  trackingNumber={courierForm.trackingNumber || repair.courierTrackingNumber}
                  carrier={courierForm.carrier || repair.courierCarrier || 'slpost'}
                />
              )}
            </div>
          )}
        </div>
      </div>
      {/* ── OCR IMEI Scanner Modal ─────────────────────────────────────────────── */}
      {ocrModal && (
        <div className="modal-overlay" onClick={() => setOcrModal(false)}>
          <div className="modal-panel max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="modal-title flex items-center gap-2"><Search className="w-5 h-5" /> Scan IMEI / Serial</h3>
              <button onClick={() => setOcrModal(false)} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
            </div>
            <OcrScanner
              mode="imei"
              onResult={(text) => {
                toast.success(`Scanned: ${text}`);
                setOcrModal(false);
              }}
            />
          </div>
        </div>
      )}

      {/* ── Damage Markup Modal ────────────────────────────────────────────────── */}
      {damageMarkupModal && damageMarkupUrl && (
        <div className="modal-overlay" onClick={() => setDamageMarkupModal(false)}>
          <div className="card w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="modal-title flex items-center gap-2"><Pencil className="w-5 h-5" /> Annotate Damage</h3>
              <button onClick={() => setDamageMarkupModal(false)} className="text-slate-400 hover:text-slate-700 text-xl">×</button>
            </div>
            <DamageMarkup
              imageUrl={damageMarkupUrl}
              onExport={(dataUrl) => {
                toast.success('Annotated image ready — uploading…');
                fetch(dataUrl).then(r => r.blob()).then(blob => {
                  const file = new File([blob], 'annotated.png', { type: 'image/png' });
                  const fd = new FormData();
                  fd.append('file', file);
                  const req = damageMarkupPhotoId
                    ? repairsApi.updatePhoto(id, damageMarkupPhotoId, fd)
                    : (() => {
                        fd.append('phase', 'BEFORE');
                        fd.append('caption', 'Damage annotation');
                        return repairsApi.uploadPhoto(id, fd);
                      })();
                  req
                    .then(() => { toast.success('Photo updated ✓'); qc.invalidateQueries({ queryKey: ['repair-photos', id] }); })
                    .catch(() => toast.error('Upload failed'));
                });
                setDamageMarkupModal(false);
              }}
            />
          </div>
        </div>
      )}
      {/* ── Status Update Modal ──────────────────────────────────────────── */}
      {statusModal && (
        <div className="modal-overlay" onClick={() => setStatusModal(false)}>
          <div className="modal-panel max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title mb-4">Update Status</h3>
            <label className="label">New Status</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="input mb-4">
              {(VALID_TRANSITIONS[repair.status] ?? []).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <label className="label">Tech Notes (optional)</label>
            <textarea value={statusNotes} onChange={e => setStatusNotes(e.target.value)}
              rows={3} className="input resize-none mb-4" placeholder="Describe work done…" />
            <div className="flex gap-3">
              <button onClick={() => statusMutation.mutate()} disabled={statusMutation.isPending}
                className="btn-primary flex-1">{statusMutation.isPending ? 'Updating…' : 'Update'}</button>
              <button onClick={() => setStatusModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Modal ────────────────────────────────────────────────────── */}
      {aiModal && (
        <div className="modal-overlay" onClick={() => { setAiModal(null); setAiResult(null); }}>
          <div className="modal-panel max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              {aiModal === 'advice' ? <Bot className="w-6 h-6 text-violet-500" /> : <Sparkles className="w-6 h-6 text-violet-500" />}
              <h3 className="modal-title">
                {aiModal === 'advice' ? 'AI Repair Advice' : 'Sentiment Analysis'}
              </h3>
              <span className="ml-auto text-xs text-slate-400 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">Powered by Ollama llama3</span>
            </div>

            {aiLoading && (
              <div className="flex flex-col items-center py-10 gap-3">
                <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Consulting local AI…</p>
              </div>
            )}

            {!aiLoading && aiResult && aiModal === 'advice' && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Likely Causes</p>
                  <ul className="list-disc list-inside space-y-1">
                    {(aiResult.likely_causes ?? []).map((c: string, i: number) => (
                      <li key={i} className="text-sm text-slate-700">{c}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Recommended Parts</p>
                  <ul className="list-disc list-inside space-y-1">
                    {(aiResult.recommended_parts ?? []).map((p: string, i: number) => (
                      <li key={i} className="text-sm text-slate-700">{p}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-wrap gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-0.5">Difficulty</p>
                    <span className={`badge text-xs ${
                      aiResult.estimated_difficulty === 'easy' ? 'badge-green' :
                      aiResult.estimated_difficulty === 'medium' ? 'badge-amber' : 'badge-red'
                    }`}>{aiResult.estimated_difficulty ?? '—'}</span>
                  </div>
                </div>
                {aiResult.notes && (
                  <div className="bg-violet-50 rounded-xl p-3 text-sm text-violet-800 border border-violet-100">
                    <p className="font-semibold mb-0.5 text-xs uppercase text-violet-500">AI Notes</p>
                    {aiResult.notes}
                  </div>
                )}
              </div>
            )}

            {!aiLoading && aiResult && aiModal === 'sentiment' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    aiResult.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-600' :
                    aiResult.sentiment === 'negative' ? 'bg-red-100 text-red-500' : 'bg-amber-100 text-amber-600'
                  }`}>{  
                    aiResult.sentiment === 'positive' ? <Smile className="w-5 h-5" /> :
                    aiResult.sentiment === 'negative' ? <Frown className="w-5 h-5" /> : <Meh className="w-5 h-5" />
                  }</span>
                  <div>
                    <p className={`font-semibold capitalize text-lg ${
                      aiResult.sentiment === 'positive' ? 'text-emerald-600' :
                      aiResult.sentiment === 'negative' ? 'text-red-600' : 'text-amber-600'
                    }`}>{aiResult.sentiment ?? 'unknown'}</p>
                    <p className="text-xs text-slate-400">Confidence: {Math.round((aiResult.confidence ?? 0) * 100)}%</p>
                  </div>
                </div>
                {aiResult.summary && (
                  <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 border border-slate-100">
                    {aiResult.summary}
                  </div>
                )}
                {aiResult.flags && aiResult.flags.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-500 mb-1 uppercase flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Flags</p>
                    <div className="flex flex-wrap gap-2">
                      {aiResult.flags.map((f: string, i: number) => (
                        <span key={i} className="badge badge-red text-xs">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button onClick={() => { setAiModal(null); setAiResult(null); }}
              className="btn-secondary w-full mt-5">Close</button>
          </div>
        </div>
      )}

      {/* ── Add Parts Modal ──────────────────────────────────────────────── */}
      {partsModal && (
        <div className="modal-overlay" onClick={() => setPartsModal(false)}>
          <div className="modal-panel max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title mb-4">Add Parts Used</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <div className="grid grid-cols-[1fr_56px_80px_36px] gap-1.5 text-xs font-medium text-slate-400 px-0.5">
                <span>Part Name</span><span>SKU</span><span>Cost (LKR)</span><span>Qty</span>
              </div>
              {parts.map((part, i) => (
                <div key={i} className="grid grid-cols-[1fr_56px_80px_36px] gap-1.5 items-center">
                  <input value={part.productName} onChange={e => setParts(p => p.map((x, j) => j === i ? { ...x, productName: e.target.value } : x))}
                    className="input text-sm" placeholder="e.g. LCD Screen" />
                  <input value={part.sku} onChange={e => setParts(p => p.map((x, j) => j === i ? { ...x, sku: e.target.value } : x))}
                    className="input text-sm" placeholder="SKU-001" />
                  <input type="number" value={part.unitCost} min={0} onChange={e => setParts(p => p.map((x, j) => j === i ? { ...x, unitCost: Number(e.target.value) } : x))}
                    className="input text-sm" placeholder="0" />
                  <input type="number" value={part.quantity} min={1} onChange={e => setParts(p => p.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))}
                    className="input text-sm" placeholder="1" />
                </div>
              ))}
            </div>
            <button onClick={() => setParts(p => [...p, { productName: '', sku: '', unitCost: 0, quantity: 1 }])}
              className="text-xs text-primary mt-2 hover:underline">+ Add Row</button>
            <div className="flex gap-3 mt-4">
              <button onClick={() => partsMutation.mutate()} disabled={partsMutation.isPending}
                className="btn-primary flex-1">{partsMutation.isPending ? 'Saving…' : 'Save Parts'}</button>
              <button onClick={() => setPartsModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Photo Upload Modal ───────────────────────────────────────────── */}
      {photoModal && (
        <div className="modal-overlay" onClick={() => setPhotoModal(false)}>
          <div className="modal-panel max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title mb-4">Upload Repair Photo</h3>
            <label className="label">Phase</label>
            <select value={photoPhase} onChange={e => setPhotoPhase(e.target.value as any)} className="input mb-4">
              <option value="BEFORE">Before Repair</option>
              <option value="DURING">During Repair</option>
              <option value="AFTER">After Repair</option>
            </select>
            <label className="label">Caption (optional)</label>
            <input value={photoCaption} onChange={e => setPhotoCaption(e.target.value)}
              className="input mb-4" placeholder="e.g. Cracked screen close-up" />
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFileChange} />
            <button onClick={() => photoInputRef.current?.click()} disabled={photoUploadMutation.isPending}
              className="btn-primary w-full flex items-center justify-center gap-1.5">
              <Camera className="w-4 h-4" />
              {photoUploadMutation.isPending ? 'Uploading…' : 'Choose & Upload Photo'}
            </button>
            <button onClick={() => setPhotoModal(false)} className="btn-secondary w-full mt-2">Cancel</button>
          </div>
        </div>
      )}

      {/* ── Signature / Collection Modal ─────────────────────────────────── */}
      {sigModal && (
        <div className="modal-overlay" onClick={() => setSigModal(false)}>
          <div className="modal-panel max-w-xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title mb-1">Device Collection — Customer Signature</h3>
            <p className="text-sm text-slate-400 mb-4">
              {repair.ticketNumber} — {repair.deviceBrand} {repair.deviceModel}{' '}|{' '}
              <strong>{repair.customer?.name ?? repair.customerName}</strong>
            </p>
            <label className="label">Completion Notes (optional)</label>
            <textarea value={sigNotes} onChange={e => setSigNotes(e.target.value)} rows={2}
              className="input resize-none mb-4" placeholder="Any final notes…" />
            <SignaturePad
              onConfirm={(dataUrl) => signatureMutation.mutate(dataUrl)}
              onCancel={() => setSigModal(false)}
            />
            {signatureMutation.isPending && (
              <p className="text-sm text-slate-500 text-center mt-3 animate-pulse">
                Generating receipt & marking complete…
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Small helper for detail rows
function Detail({ label, value, mono, full }: { label: string; value: string; mono?: boolean; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={`font-medium text-slate-700 ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</p>
    </div>
  );
}
