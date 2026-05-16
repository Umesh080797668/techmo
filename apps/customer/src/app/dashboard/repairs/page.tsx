'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { myRepairsApi } from '@/lib/api';
import { format } from 'date-fns';
import { Wrench, Search, ChevronDown, ChevronUp, QrCode, Clock, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

const STATUS_COLOR: Record<string, string> = {
  PENDING:        'badge-warning',
  DIAGNOSING:     'badge-info',
  IN_PROGRESS:    'badge-info',
  WAITING_PARTS:  'badge-warning',
  COMPLETED:      'badge-success',
  DELIVERED:      'badge-success',
  CANCELLED:      'badge-danger',
};

const STATUS_STEP: Record<string, number> = {
  PENDING: 0, DIAGNOSING: 1, IN_PROGRESS: 2, WAITING_PARTS: 2, COMPLETED: 3, DELIVERED: 4,
};

const TIMELINE_STEPS = ['Received', 'Diagnosing', 'Repairing', 'Completed', 'Delivered'];

export default function RepairsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['my-repairs', status],
    queryFn: () => myRepairsApi.list({ status: status || undefined }).then(r => r.data),
  });

  const items: any[] = (data?.items ?? []).filter((r: any) =>
    !search || r.deviceModel?.toLowerCase().includes(search.toLowerCase()) ||
    r.issue?.toLowerCase().includes(search.toLowerCase()) ||
    r.trackingToken?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-white">My Repairs</h1>
          <p className="text-sm text-slate-400 mt-1">Track the status of all your device repairs.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            className="input pl-9"
            placeholder="Search by device, issue or tracking code…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input sm:w-48" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLOR).map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-slate-500">
          <Wrench className="w-10 h-10 opacity-20 mb-3" />
          <p className="font-medium">No repairs found</p>
          <p className="text-sm mt-1">Visit a TechMo store to book a repair.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((repair: any) => (
            <RepairCard
              key={repair.id}
              repair={repair}
              isExpanded={expanded === repair.id}
              onToggle={() => setExpanded(expanded === repair.id ? null : repair.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RepairCard({ repair, isExpanded, onToggle }: {
  repair: any; isExpanded: boolean; onToggle: () => void;
}) {
  const step = STATUS_STEP[repair.status] ?? 0;
  const [activeTab, setActiveTab] = useState<'progress' | 'photos'>('progress');

  const { data: photos = [], isLoading: photosLoading } = useQuery({
    queryKey: ['customer-repair-photos', repair.id],
    queryFn: () => myRepairsApi.getPhotos(repair.id).then(r => r.data),
    enabled: isExpanded && activeTab === 'photos',
  });

  const afterPhotos = (photos as any[]).filter((p: any) => p.phase === 'AFTER');

  return (
    <div className="card">
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-slate-700/60 flex items-center justify-center flex-shrink-0">
          <Wrench className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{repair.deviceModel ?? 'Device'}</p>
            <span className={clsx('badge', STATUS_COLOR[repair.status] ?? 'badge-info')}>
              {repair.status?.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{repair.issue ?? repair.repairType ?? 'Repair'}</p>
        </div>
        <div className="text-right flex-shrink-0 mr-2">
          <p className="text-sm font-medium text-white">
            {repair.estimatedCost ? `LKR ${repair.estimatedCost.toLocaleString()}` : '—'}
          </p>
          <p className="text-xs text-slate-500">
            {repair.createdAt ? format(new Date(repair.createdAt), 'dd MMM yyyy') : ''}
          </p>
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="mt-5 pt-5 border-t border-slate-700/50 space-y-4">
          {/* Tab switcher */}
          <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 w-fit">
            {(['progress', 'photos'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'px-4 py-1 rounded-md text-xs font-semibold capitalize transition-all',
                  activeTab === tab ? 'bg-primary text-white' : 'text-slate-400 hover:text-white',
                )}>
                {tab === 'photos' ? '📷 Photos' : '📋 Progress'}
              </button>
            ))}
          </div>

          {/* Progress tab */}
          {activeTab === 'progress' && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-medium text-slate-400 mb-3 uppercase tracking-wider">Progress</p>
                <div className="flex items-center gap-0">
                  {TIMELINE_STEPS.map((label, i) => (
                    <div key={label} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div className={clsx(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors',
                          i <= step ? 'bg-primary border-primary text-white' : 'bg-slate-700 border-slate-600 text-slate-500',
                        )}>
                          {i < step ? '✓' : i + 1}
                        </div>
                        <span className={clsx('text-[10px] mt-1 text-center leading-tight', i <= step ? 'text-primary' : 'text-slate-600')}>
                          {label}
                        </span>
                      </div>
                      {i < TIMELINE_STEPS.length - 1 && (
                        <div className={clsx('h-0.5 flex-1 mb-4 mx-1', i < step ? 'bg-primary' : 'bg-slate-700')} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {repair.trackingToken && (
                  <Detail label="Tracking Code" value={
                    <span className="flex items-center gap-1"><QrCode className="w-3.5 h-3.5" />{repair.trackingToken}</span>
                  } />
                )}
                {repair.estimatedCompletionDate && (
                  <Detail label="Est. Completion" value={
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{format(new Date(repair.estimatedCompletionDate), 'dd MMM yyyy')}</span>
                  } />
                )}
                {repair.technicianNotes && <Detail label="Technician Notes" value={repair.technicianNotes} colSpan />}
                {repair.finalCost && <Detail label="Final Cost" value={`LKR ${repair.finalCost.toLocaleString()}`} />}
                {repair.warrantyDays && <Detail label="Repair Warranty" value={`${repair.warrantyDays} days`} />}
              </dl>

              {repair.status === 'COMPLETED' && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  Your device is ready for collection. Please bring this tracking code to the store.
                </div>
              )}
            </div>
          )}

          {/* Photos tab */}
          {activeTab === 'photos' && (
            <div>
              {photosLoading && (
                <div className="grid grid-cols-3 gap-3">
                  {[1,2,3].map(i => <div key={i} className="aspect-square bg-slate-700 animate-pulse rounded-lg" />)}
                </div>
              )}
              {!photosLoading && afterPhotos.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-6">No photos available yet.</p>
              )}
              {!photosLoading && afterPhotos.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-3">After-repair photos ({afterPhotos.length})</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {afterPhotos.map((photo: any) => (
                      <a key={photo.id} href={photo.cloudinaryUrl} target="_blank" rel="noreferrer"
                        className="relative group block">
                        <img src={photo.cloudinaryUrl} alt={photo.caption ?? 'Repair photo'}
                          className="w-full aspect-square object-cover rounded-lg border border-slate-700" />
                        {photo.caption && (
                          <p className="text-[11px] text-slate-400 mt-1 truncate">{photo.caption}</p>
                        )}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 rounded-lg transition-opacity flex items-center justify-center">
                          <span className="text-white text-xs font-medium">View full ↗</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, colSpan }: { label: string; value: React.ReactNode; colSpan?: boolean }) {
  return (
    <div className={colSpan ? 'col-span-2 sm:col-span-3' : ''}>
      <dt className="text-[11px] text-slate-500 uppercase tracking-wider mb-0.5">{label}</dt>
      <dd className="text-sm text-white">{value}</dd>
    </div>
  );
}
