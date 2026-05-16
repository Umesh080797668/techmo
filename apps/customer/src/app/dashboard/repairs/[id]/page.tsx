'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Camera, ClipboardList, Wrench } from 'lucide-react';
import { myRepairsApi } from '@/lib/api';
import clsx from 'clsx';

const STATUS_COLOR: Record<string, string> = {
  RECEIVED:         'badge-info',
  PENDING_DIAGNOSIS:'badge-warning',
  AWAITING_PARTS:   'badge-warning',
  UNDER_REPAIR:     'badge-info',
  READY_FOR_PICKUP: 'badge-success',
  COMPLETED:        'badge-success',
  CANCELLED:        'badge-danger',
};

const TIMELINE_STEPS = [
  { key: 'RECEIVED',          label: 'Received',        icon: '📥' },
  { key: 'PENDING_DIAGNOSIS', label: 'Diagnosing',       icon: '🔍' },
  { key: 'UNDER_REPAIR',      label: 'Repairing',        icon: '🔧' },
  { key: 'READY_FOR_PICKUP',  label: 'Ready',            icon: '✅' },
  { key: 'COMPLETED',         label: 'Completed',        icon: '🎉' },
];

const PHASE_LABELS: Record<string, string> = {
  BEFORE: '📷 Before',
  DURING: '🔧 During',
  AFTER:  '✅ After',
};

type Tab = 'status' | 'photos';

export default function RepairDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('status');

  // ── Repair data ───────────────────────────────────────────────────────────
  const { data: repair, isLoading, error } = useQuery({
    queryKey: ['my-repair', id],
    queryFn: () => myRepairsApi.get(id).then(r => r.data),
    enabled: !!id,
  });

  // ── Photos (loaded only on tab switch) ───────────────────────────────────
  const { data: photos = [], isLoading: photosLoading } = useQuery({
    queryKey: ['my-repair-photos', id],
    queryFn: () => myRepairsApi.getPhotos(id).then(r => r.data),
    enabled: !!id && activeTab === 'photos',
  });

  // ── Loading / error states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-[--primary] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !repair) {
    return (
      <div className="text-center py-24">
        <p className="text-slate-400 mb-4">Repair ticket not found.</p>
        <button onClick={() => router.back()} className="btn-secondary flex items-center gap-2 mx-auto">
          <ArrowLeft className="w-4 h-4" /> Back to Repairs
        </button>
      </div>
    );
  }

  const currentStepIdx = TIMELINE_STEPS.findIndex(s => s.key === repair.status);
  const isCancelled    = repair.status === 'CANCELLED';

  const photosByPhase: Record<string, any[]> = {};
  for (const p of photos) {
    if (!photosByPhase[p.phase]) photosByPhase[p.phase] = [];
    photosByPhase[p.phase].push(p);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fadeIn">
      {/* Back link */}
      <button onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to My Repairs
      </button>

      {/* ── Ticket header ─────────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-1 font-mono tracking-widest">
              {repair.ticketNumber ?? repair.trackingToken}
            </p>
            <h1 className="text-xl font-bold text-white">
              {repair.deviceBrand} {repair.deviceModel}
            </h1>
            {repair.deviceImei && (
              <p className="text-xs text-slate-400 font-mono mt-0.5">IMEI: {repair.deviceImei}</p>
            )}
            <p className="text-sm text-slate-400 mt-2">{repair.issueDescription}</p>
          </div>
          <span className={clsx('badge', STATUS_COLOR[repair.status] ?? 'badge-info')}>
            {repair.status.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Key dates */}
        <div className="mt-4 flex gap-6 text-xs text-slate-400 flex-wrap">
          <span>Dropped off: <strong className="text-slate-300">{format(new Date(repair.createdAt), 'dd MMM yyyy')}</strong></span>
          {repair.estimatedCost && (
            <span>Est. cost: <strong className="text-slate-300">LKR {Number(repair.estimatedCost).toLocaleString()}</strong></span>
          )}
          {repair.finalCost && (
            <span>Final cost: <strong className="text-[--accent]">LKR {Number(repair.finalCost).toLocaleString()}</strong></span>
          )}
        </div>

        {/* PDF receipt link */}
        {repair.completionPdfUrl && (
          <div className="mt-4">
            <a href={repair.completionPdfUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-[--primary] hover:underline">
              📄 Download Repair Receipt (PDF)
            </a>
          </div>
        )}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex border-b border-white/5">
          <button onClick={() => setActiveTab('status')}
            className={clsx(
              'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'status'
                ? 'border-[--primary] text-[--primary]'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            )}>
            <ClipboardList className="w-4 h-4" />
            Status Timeline
          </button>
          <button onClick={() => setActiveTab('photos')}
            className={clsx(
              'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === 'photos'
                ? 'border-[--primary] text-[--primary]'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            )}>
            <Camera className="w-4 h-4" />
            Photo Timeline
          </button>
        </div>

        <div className="p-6">
          {/* ── Status Timeline ─────────────────────────────────────────── */}
          {activeTab === 'status' && (
            <div>
              {isCancelled ? (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <span className="text-2xl">❌</span>
                  <div>
                    <p className="font-semibold text-red-400">Repair Cancelled</p>
                    <p className="text-sm text-slate-400 mt-0.5">Please contact us for more information.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-0">
                  {TIMELINE_STEPS.map((step, idx) => {
                    const isDone    = idx < currentStepIdx;
                    const isCurrent = idx === currentStepIdx;
                    const isPending = idx > currentStepIdx;
                    return (
                      <div key={step.key} className="flex gap-4">
                        {/* Connector */}
                        <div className="flex flex-col items-center">
                          <div className={clsx(
                            'w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 transition-all',
                            isDone    ? 'bg-emerald-500/20 text-emerald-400' :
                            isCurrent ? 'bg-[--primary]/20 text-[--primary] ring-4 ring-[--primary]/20' :
                                        'bg-slate-800 text-slate-600'
                          )}>
                            {isDone ? '✓' : step.icon}
                          </div>
                          {idx < TIMELINE_STEPS.length - 1 && (
                            <div className={clsx(
                              'w-0.5 h-8 my-1',
                              isDone ? 'bg-emerald-500/30' : 'bg-slate-700'
                            )} />
                          )}
                        </div>

                        {/* Content */}
                        <div className="pb-8 flex-1">
                          <p className={clsx(
                            'font-semibold text-sm',
                            isDone    ? 'text-emerald-400' :
                            isCurrent ? 'text-white' :
                                        'text-slate-600'
                          )}>
                            {step.label}
                            {isCurrent && (
                              <span className="ml-2 text-[10px] bg-[--primary]/20 text-[--primary] px-2 py-0.5 rounded-full">
                                Current
                              </span>
                            )}
                          </p>
                          {isCurrent && repair.technicianNotes && (
                            <p className="text-xs text-slate-400 mt-1">{repair.technicianNotes}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tech notes */}
              {repair.technicianNotes && !isCancelled && (
                <div className="mt-4 bg-[--surface] rounded-xl p-4 text-sm">
                  <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                    <Wrench className="w-3 h-3" /> Technician Note
                  </p>
                  <p className="text-slate-300">{repair.technicianNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Photo Timeline ───────────────────────────────────────────── */}
          {activeTab === 'photos' && (
            <div>
              {photosLoading && (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-[--primary] border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!photosLoading && photos.length === 0 && (
                <div className="text-center py-10 text-slate-500">
                  <Camera className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No photos have been uploaded for this repair yet.</p>
                  <p className="text-xs mt-1 text-slate-600">
                    Before, during, and after photos will appear here once our technician uploads them.
                  </p>
                </div>
              )}

              {['BEFORE', 'DURING', 'AFTER'].map(phase => {
                const pics = photosByPhase[phase] ?? [];
                if (!pics.length) return null;
                return (
                  <div key={phase} className="mb-8">
                    <h3 className="text-sm font-semibold text-slate-400 mb-3">{PHASE_LABELS[phase]}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {pics.map((photo: any) => (
                        <div key={photo.id} className="relative group rounded-xl overflow-hidden bg-[--surface]">
                          <img
                            src={photo.cloudinaryUrl}
                            alt={photo.caption ?? phase}
                            className="w-full aspect-video object-cover"
                            loading="lazy"
                          />
                          <div className="p-2">
                            {photo.caption && (
                              <p className="text-xs text-slate-400 truncate">{photo.caption}</p>
                            )}
                            <p className="text-[10px] text-slate-600 mt-0.5">
                              {format(new Date(photo.createdAt), 'dd MMM HH:mm')}
                            </p>
                          </div>
                          <a
                            href={photo.cloudinaryUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-lg
                                       opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ↗
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Disclaimer */}
              {photos.length > 0 && (
                <p className="text-xs text-slate-600 mt-4 text-center">
                  Photos are uploaded by our technicians to document the repair process and protect both parties.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* QR public track link */}
      {repair.trackingToken && (
        <div className="card p-4 flex items-center gap-3 text-sm">
          <span className="text-xl">🔗</span>
          <div>
            <p className="text-slate-300 font-medium">Share Repair Status</p>
            <p className="text-slate-500 text-xs">
              Anyone with the link below can view this repair&apos;s status without logging in.
            </p>
          </div>
          <Link
            href={`/track/${repair.trackingToken}`}
            target="_blank"
            className="ml-auto text-[--primary] hover:underline text-xs shrink-0"
          >
            View Public Page ↗
          </Link>
        </div>
      )}
    </div>
  );
}
