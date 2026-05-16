'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Camera, AlertCircle } from 'lucide-react';
import axios from 'axios';
import clsx from 'clsx';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:3001';

// Public (unauthenticated) API call
const publicApi = axios.create({ baseURL: `${GATEWAY}/api/v1`, timeout: 10000 });
const trackRepair = (ref: string) => publicApi.get(`/repairs/track/${encodeURIComponent(ref)}`);
const trackPhotos = (repairId: string) => publicApi.get(`/repairs/${repairId}/photos`);

const STATUS_COLOR: Record<string, string> = {
  RECEIVED:          'bg-slate-100 text-slate-700',
  PENDING_DIAGNOSIS: 'bg-amber-100 text-amber-700',
  AWAITING_PARTS:    'bg-amber-100 text-amber-700',
  UNDER_REPAIR:      'bg-blue-100 text-blue-700',
  READY_FOR_PICKUP:  'bg-emerald-100 text-emerald-700',
  COMPLETED:         'bg-emerald-100 text-emerald-700',
  CANCELLED:         'bg-red-100 text-red-700',
};

const TIMELINE_STEPS = [
  { key: 'RECEIVED',          label: 'Received',    icon: '📥', desc: 'Device dropped off at TechMo' },
  { key: 'PENDING_DIAGNOSIS', label: 'Diagnosing',  icon: '🔍', desc: 'Technician is assessing the issue' },
  { key: 'UNDER_REPAIR',      label: 'Repairing',   icon: '🔧', desc: 'Repair work is in progress' },
  { key: 'READY_FOR_PICKUP',  label: 'Ready',       icon: '✅', desc: 'Your device is ready to collect' },
  { key: 'COMPLETED',         label: 'Completed',   icon: '🎉', desc: 'Repair completed & device collected' },
];

const PHASE_LABELS: Record<string, string> = {
  BEFORE: '📷 Before Repair',
  DURING: '🔧 During Repair',
  AFTER:  '✅ After Repair',
};

type Tab = 'status' | 'photos';

export default function PublicTrackPage() {
  const { ref } = useParams<{ ref: string }>();
  const [activeTab, setActiveTabState] = useState<Tab>('status');

  const { data: repair, isLoading, error, refetch } = useQuery({
    queryKey: ['track', ref],
    queryFn: () => trackRepair(ref).then(r => r.data),
    enabled: !!ref,
    retry: 1,
  });

  const { data: photos = [], isLoading: photosLoading } = useQuery({
    queryKey: ['track-photos', repair?.id],
    queryFn: () => trackPhotos(repair!.id).then(r => r.data),
    enabled: !!repair?.id && activeTab === 'photos',
  });

  const setActiveTab = (t: Tab) => setActiveTabState(t);

  const currentStepIdx = TIMELINE_STEPS.findIndex(s => s.key === repair?.status);
  const isCancelled    = repair?.status === 'CANCELLED';

  const photosByPhase: Record<string, any[]> = {};
  for (const p of photos) {
    if (!photosByPhase[p.phase]) photosByPhase[p.phase] = [];
    photosByPhase[p.phase].push(p);
  }

  // ── Courier delivery signature ───────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [showSignPad, setShowSignPad]     = useState(false);
  const [sigIsEmpty, setSigIsEmpty]       = useState(true);
  const [sigSubmitting, setSigSubmitting] = useState(false);
  const [sigDone, setSigDone]             = useState(false);
  const [sigReceiptUrl, setSigReceiptUrl] = useState<string | null>(null);

  // HiDPI canvas setup — runs whenever the pad becomes visible
  useEffect(() => {
    if (!showSignPad || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const cssW = canvas.offsetWidth || 300;
    const cssH = 160;
    const ratio = window.devicePixelRatio || 1;
    canvas.width  = cssW * ratio;
    canvas.height = cssH * ratio;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
  }, [showSignPad]);

  // Non-passive touch listeners (passive blocks preventDefault)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !showSignPad) return;
    const pos = (t: Touch) => {
      const r = canvas.getBoundingClientRect();
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0]; if (!t) return;
      const { x, y } = pos(t);
      const ctx = canvas.getContext('2d')!;
      ctx.beginPath(); ctx.moveTo(x, y);
      drawingRef.current = true; setSigIsEmpty(false);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!drawingRef.current) return;
      const t = e.touches[0]; if (!t) return;
      const { x, y } = pos(t);
      const ctx = canvas.getContext('2d')!;
      ctx.lineTo(x, y); ctx.stroke();
    };
    const onTouchEnd = (e: TouchEvent) => { e.preventDefault(); drawingRef.current = false; };
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd,   { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
    };
  }, [showSignPad]);

  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    canvas.getContext('2d')!.beginPath();
    canvas.getContext('2d')!.moveTo(e.clientX - r.left, e.clientY - r.top);
    drawingRef.current = true; setSigIsEmpty(false);
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d')!;
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top); ctx.stroke();
  }, []);

  const stopDraw = useCallback(() => { drawingRef.current = false; }, []);

  const clearSig = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setSigIsEmpty(true);
  };

  const submitDeliverySignature = async () => {
    if (sigIsEmpty || !canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    setSigSubmitting(true);
    try {
      const res = await publicApi.post(`/repairs/sign-delivery/${ref}`, { signatureDataUrl: dataUrl });
      setSigDone(true);
      setSigReceiptUrl(res.data?.receiptUrl ?? null);
      await refetch();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to submit. Please try again.');
    } finally {
      setSigSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">T</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">TechMo</p>
              <p className="text-xs text-gray-400">Repair Tracker</p>
            </div>
          </div>
          <a href="https://techmo.lk" className="text-xs text-indigo-600 hover:underline">
            techmo.lk
          </a>
        </div>
      </header>

      <main className="flex-1 py-8 px-4">
        <div className="max-w-xl mx-auto space-y-5">
          {/* Loading */}
          {isLoading && (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Error */}
          {(error || (!isLoading && !repair)) && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">Repair not found</p>
              <p className="text-sm text-gray-400 mt-1">
                The tracking reference <code className="bg-gray-100 px-1 rounded">{ref}</code> doesn&apos;t match any repair ticket.
              </p>
              <p className="text-xs text-gray-400 mt-3">
                Please check the QR code or contact TechMo directly.
              </p>
            </div>
          )}

          {repair && (
            <>
              {/* Ticket summary */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-400 font-mono tracking-widest mb-1">
                      {repair.ticketNumber ?? ref}
                    </p>
                    <h1 className="text-lg font-bold text-gray-900">
                      {repair.deviceBrand} {repair.deviceModel}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">{repair.issueDescription}</p>
                  </div>
                  <span className={clsx(
                    'text-xs font-semibold px-3 py-1 rounded-full',
                    STATUS_COLOR[repair.status] ?? 'bg-gray-100 text-gray-600'
                  )}>
                    {repair.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="mt-4 flex gap-6 text-xs text-gray-400 flex-wrap">
                  <span>Dropped off: <strong className="text-gray-600">{format(new Date(repair.createdAt), 'dd MMM yyyy')}</strong></span>
                  {repair.estimatedCost && (
                    <span>Est. cost: <strong className="text-gray-600">LKR {Number(repair.estimatedCost).toLocaleString()}</strong></span>
                  )}
                </div>

                {/* Ready for pickup / courier notice */}
                {repair.status === 'READY_FOR_PICKUP' && !repair.courierTrackingNumber && (
                  <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-xl">✅</span>
                    <div>
                      <p className="font-semibold text-emerald-700 text-sm">Ready for Pickup!</p>
                      <p className="text-xs text-emerald-600">Your device is repaired and waiting at our service centre.</p>
                    </div>
                  </div>
                )}
                {repair.courierTrackingNumber && repair.status === 'READY_FOR_PICKUP' && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-xl">📦</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-blue-700 text-sm">On the Way!</p>
                      <p className="text-xs text-blue-600">Your device has been dispatched via courier.</p>
                      {repair.courierCarrier && (
                        <p className="text-xs text-blue-500 mt-0.5 font-mono truncate">
                          {repair.courierCarrier.toUpperCase()} · {repair.courierTrackingNumber}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Courier delivery signature card */}
              {repair.courierTrackingNumber && (repair.status === 'READY_FOR_PICKUP' || sigDone) && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  {sigDone ? (
                    <div className="text-center py-2">
                      <div className="text-4xl mb-3">✅</div>
                      <p className="font-bold text-emerald-700 text-base">Delivery Confirmed!</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Thank you — your signature has been recorded and the repair is now completed.
                      </p>
                      {sigReceiptUrl && (
                        <a
                          href={sigReceiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline"
                        >
                          📄 Download Signed Receipt
                        </a>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start gap-3 mb-5">
                        <span className="text-2xl">✍️</span>
                        <div>
                          <p className="font-bold text-gray-800 text-sm">Sign to Confirm Delivery</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Received your device? Please sign below to confirm delivery in good condition.
                          </p>
                        </div>
                      </div>

                      {!showSignPad ? (
                        <button
                          onClick={() => setShowSignPad(true)}
                          className="w-full bg-indigo-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all"
                        >
                          ✍️ Open Signature Pad
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <div className="relative border-2 border-gray-300 rounded-xl overflow-hidden bg-white" style={{ height: '160px' }}>
                            <canvas
                              ref={canvasRef}
                              className="touch-none cursor-crosshair block w-full h-full"
                              onMouseDown={startDraw}
                              onMouseMove={draw}
                              onMouseUp={stopDraw}
                              onMouseLeave={stopDraw}
                            />
                            {sigIsEmpty && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <p className="text-gray-300 text-sm select-none">✍ Sign here</p>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={clearSig}
                              className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                              Clear
                            </button>
                            <button
                              onClick={submitDeliverySignature}
                              disabled={sigIsEmpty || sigSubmitting}
                              className="flex-[2] py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                            >
                              {sigSubmitting ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  Submitting…
                                </>
                              ) : '✅ Confirm Delivery'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tabs */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="flex border-b border-gray-100">
                  {([['status', 'Status Timeline'], ['photos', 'Photo Timeline']] as [Tab, string][]).map(([t, label]) => (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      className={clsx(
                        'flex-1 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
                        activeTab === t
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-gray-400 hover:text-gray-600'
                      )}
                    >
                      {t === 'photos' ? '📷 ' : '📋 '}{label}
                    </button>
                  ))}
                </div>

                <div className="p-6">
                  {/* Status Timeline */}
                  {activeTab === 'status' && (
                    <div>
                      {isCancelled ? (
                        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                          <span className="text-2xl">❌</span>
                          <div>
                            <p className="font-semibold text-red-600">Repair Cancelled</p>
                            <p className="text-sm text-gray-500 mt-0.5">Please contact us for more information.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-0">
                          {TIMELINE_STEPS.map((step, idx) => {
                            const isDone    = idx < currentStepIdx;
                            const isCurrent = idx === currentStepIdx;
                            return (
                              <div key={step.key} className="flex gap-4">
                                <div className="flex flex-col items-center">
                                  <div className={clsx(
                                    'w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 transition-all',
                                    isDone    ? 'bg-emerald-100 text-emerald-600' :
                                    isCurrent ? 'bg-indigo-100 text-indigo-600 ring-4 ring-indigo-100' :
                                               'bg-gray-100 text-gray-400'
                                  )}>
                                    {isDone ? '✓' : step.icon}
                                  </div>
                                  {idx < TIMELINE_STEPS.length - 1 && (
                                    <div className={clsx(
                                      'w-0.5 h-8 my-1',
                                      isDone ? 'bg-emerald-200' : 'bg-gray-200'
                                    )} />
                                  )}
                                </div>

                                <div className="pb-8 flex-1">
                                  <p className={clsx(
                                    'font-semibold text-sm',
                                    isDone    ? 'text-emerald-600' :
                                    isCurrent ? 'text-indigo-700' :
                                               'text-gray-400'
                                  )}>
                                    {step.label}
                                    {isCurrent && (
                                      <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                                        Current Status
                                      </span>
                                    )}
                                  </p>
                                  <p className={clsx(
                                    'text-xs mt-0.5',
                                    isCurrent ? 'text-gray-500' : 'text-gray-400'
                                  )}>
                                    {step.desc}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Photo Timeline */}
                  {activeTab === 'photos' && (
                    <div>
                      {photosLoading && (
                        <div className="flex justify-center py-10">
                          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}

                      {!photosLoading && photos.length === 0 && (
                        <div className="text-center py-10 text-gray-400">
                          <Camera className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No photos uploaded yet.</p>
                          <p className="text-xs mt-1 text-gray-300">
                            Our technician will upload before, during, and after photos as work progresses.
                          </p>
                        </div>
                      )}

                      {['BEFORE', 'DURING', 'AFTER'].map(phase => {
                        const pics = photosByPhase[phase] ?? [];
                        if (!pics.length) return null;
                        return (
                          <div key={phase} className="mb-7">
                            <h3 className="text-sm font-semibold text-gray-500 mb-3">{PHASE_LABELS[phase]}</h3>
                            <div className="grid grid-cols-2 gap-3">
                              {pics.map((photo: any) => (
                                <a key={photo.id} href={photo.cloudinaryUrl} target="_blank" rel="noreferrer"
                                  className="block rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition-shadow group">
                                  <img
                                    src={photo.cloudinaryUrl}
                                    alt={photo.caption ?? phase}
                                    className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                  />
                                  {photo.caption && (
                                    <p className="text-xs text-gray-500 px-2 py-1.5 truncate">{photo.caption}</p>
                                  )}
                                </a>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {photos.length > 0 && (
                        <p className="text-[10px] text-gray-300 text-center mt-4">
                          Photos are documented by our technicians to ensure transparency and protect your device.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Contact footer */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 text-sm">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-lg shrink-0">
                  💬
                </div>
                <div>
                  <p className="font-semibold text-gray-700">Questions about your repair?</p>
                  <p className="text-xs text-gray-400">Contact us on WhatsApp or visit our service centre.</p>
                </div>
                <a
                  href={`https://wa.me/94771234567?text=${encodeURIComponent(`Hi TechMo, I'm checking on repair ticket ${repair.ticketNumber ?? ref}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto bg-green-500 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-green-600 transition-colors shrink-0"
                >
                  WhatsApp
                </a>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-gray-400 border-t border-gray-100 bg-white">
        © {new Date().getFullYear()} TechMo Electronics · Professional Repair Service
      </footer>
    </div>
  );
}


