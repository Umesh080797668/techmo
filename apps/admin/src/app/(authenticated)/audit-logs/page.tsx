'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { auditApi, workerApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, KeyRound, LogOut, ClipboardList, Sparkles, Bot, Loader2, type LucideIcon } from 'lucide-react';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'badge-green',
  UPDATE: 'badge-blue',
  DELETE: 'badge-red',
  LOGIN: 'badge-purple',
  LOGOUT: 'badge-gray',
  DEFAULT: 'badge-gray',
};

const ACTION_ICONS: Record<string, LucideIcon> = {
  CREATE:  Plus,
  UPDATE:  Pencil,
  DELETE:  Trash2,
  LOGIN:   KeyRound,
  LOGOUT:  LogOut,
  DEFAULT: ClipboardList,
};

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ action: '', userId: '', resource: '', from: '', to: '' });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryModal, setAiSummaryModal] = useState(false);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const limit = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, filters],
    queryFn: () => auditApi.list({ page, limit, ...filters }).then(r => r.data),
  });

  const logs: any[] = data?.data ?? data?.items ?? data ?? [];
  const total: number = data?.total ?? data?.count ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;

  // ─── AI async job polling ──────────────────────────────────────────────
  const { data: jobResult } = useQuery({
    queryKey: ['ai-job', pendingJobId],
    queryFn: () => workerApi.aiJobStatus(pendingJobId!).then(r => r.data),
    enabled: !!pendingJobId,
    refetchInterval: pendingJobId ? 2000 : false,
  });

  useEffect(() => {
    if (!jobResult) return;
    if (jobResult.status === 'done') {
      setAiSummary(jobResult.result ?? 'No summary returned.');
      setAiSummaryModal(true);
      setPendingJobId(null);
    } else if (jobResult.status === 'failed') {
      toast.error('AI summarisation failed — check worker logs');
      setPendingJobId(null);
    }
  }, [jobResult]);

  const aiSummariseMutation = useMutation({
    mutationFn: () => {
      const entries = logs.map((l: any) =>
        `[${new Date(l.createdAt ?? l.timestamp).toLocaleString()}] ${l.action} on ${l.resource ?? l.entity}${l.resourceId ? ` (${l.resourceId})` : ''} by ${l.userName ?? l.userId ?? 'unknown'}${l.description ? `: ${l.description}` : ''}`
      );
      return workerApi.aiSummariseAuditLogs(entries);
    },
    onSuccess: (res) => {
      if (res.data?.status === 'done') {
        // Model not ready — immediate plain-text response
        setAiSummary(res.data.result ?? 'No summary returned.');
        setAiSummaryModal(true);
      } else if (res.data?.jobId) {
        // Queued — start polling
        setPendingJobId(res.data.jobId);
        toast('AI is processing… results will appear automatically', { icon: '🤖', duration: 8000 });
      }
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail ?? err?.message ?? 'Unknown error';
      toast.error(`AI unavailable: ${detail}`);
    },
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">Immutable record of all system events and changes</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {total > 0 && (
            <span className="text-sm text-slate-500">{total.toLocaleString()} events</span>
          )}
          {logs.length > 0 && (
            <button
              onClick={() => aiSummariseMutation.mutate()}
              disabled={aiSummariseMutation.isPending || !!pendingJobId}
              className="btn-secondary text-sm text-violet-700 border-violet-200 hover:bg-violet-50 disabled:opacity-50">
              {aiSummariseMutation.isPending
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Queuing…</>
                : pendingJobId
                  ? <><Bot className="w-3.5 h-3.5" /> Processing…</>
                  : <><Sparkles className="w-3.5 h-3.5" /> AI Summary</>}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select className="input text-sm" value={filters.action}
            onChange={e => handleFilterChange('action', e.target.value)}>
            <option value="">All Actions</option>
            {['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'PRINT'].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <input className="input text-sm" placeholder="Filter by user ID…"
            value={filters.userId} onChange={e => handleFilterChange('userId', e.target.value)} />
          <input className="input text-sm" placeholder="Filter by resource…"
            value={filters.resource} onChange={e => handleFilterChange('resource', e.target.value)} />
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input type="date" className="input text-sm"
              value={filters.from} onChange={e => handleFilterChange('from', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input type="date" className="input text-sm"
              value={filters.to} onChange={e => handleFilterChange('to', e.target.value)} />
          </div>
        </div>
        {(filters.action || filters.userId || filters.resource || filters.from || filters.to) && (
          <button onClick={() => { setFilters({ action: '', userId: '', resource: '', from: '', to: '' }); setPage(1); }}
            className="mt-2 text-xs text-primary hover:underline">Clear filters</button>
        )}
      </div>

      {/* Log table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Timestamp</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Resource</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">IP Address</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="py-3 px-4">
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <ClipboardList className="w-10 h-10 mx-auto mb-2 text-slate-200" />
                    <p>No audit events found</p>
                  </td>
                </tr>
              ) : logs.map((log: any) => {
                const actionKey = log.action?.toUpperCase() ?? 'DEFAULT';
                const colorClass = ACTION_COLORS[actionKey] ?? ACTION_COLORS.DEFAULT;
                const icon = ACTION_ICONS[actionKey] ?? ACTION_ICONS.DEFAULT;
                const isExpanded = expanded === log.id;

                return (
                  <>
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      onClick={() => setExpanded(isExpanded ? null : log.id)}>
                      <td className="py-3 px-4">
                        <div className="text-xs font-mono text-slate-600">
                          {new Date(log.createdAt ?? log.timestamp).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`badge ${colorClass} text-xs flex items-center gap-1 w-fit`}>
                          {(() => { const Icon = icon; return <Icon className="w-3 h-3" />; })()} {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-slate-700">{log.resource ?? log.entity}</div>
                        {log.resourceId && (
                          <div className="text-xs font-mono text-slate-400">{log.resourceId}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-slate-700">{log.userName ?? log.userId}</div>
                        {log.userName && log.userId && (
                          <div className="text-xs font-mono text-slate-400">{log.userId}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-mono text-slate-500">{log.ipAddress ?? '—'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <button className="text-primary text-xs hover:underline">
                          {isExpanded ? 'Hide ▲' : 'View ▼'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${log.id}-exp`} className="bg-slate-50">
                        <td colSpan={6} className="px-4 pb-4 pt-0">
                          <div className="bg-white rounded-xl p-4 mt-2 border border-slate-100 shadow-sm">
                            <div className="grid sm:grid-cols-2 gap-4">
                              {log.userAgent && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 mb-1">User Agent</p>
                                  <p className="text-xs text-slate-600 break-all">{log.userAgent}</p>
                                </div>
                              )}
                              {log.description && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 mb-1">Description</p>
                                  <p className="text-xs text-slate-600">{log.description}</p>
                                </div>
                              )}
                              {(log.oldValue || log.before) && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 mb-1">Before</p>
                                  <pre className="text-xs bg-red-50 border border-red-100 rounded-lg p-2 overflow-auto max-h-40 text-slate-700">
                                    {JSON.stringify(log.oldValue ?? log.before, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {(log.newValue || log.after) && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 mb-1">After</p>
                                  <pre className="text-xs bg-green-50 border border-green-100 rounded-lg p-2 overflow-auto max-h-40 text-slate-700">
                                    {JSON.stringify(log.newValue ?? log.after, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.metadata && !log.oldValue && !log.before && !log.newValue && !log.after && (
                                <div className="sm:col-span-2">
                                  <p className="text-xs font-semibold text-slate-500 mb-1">Metadata</p>
                                  <pre className="text-xs bg-slate-100 rounded-lg p-2 overflow-auto max-h-40 text-slate-700">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">← Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>

    {/* ── AI Summary Modal ─────────────────────────────────────────────── */}
    {aiSummaryModal && (
      <div className="modal-overlay"
        onClick={() => setAiSummaryModal(false)}>
        <div className="modal-panel max-w-lg p-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-violet-500" />
            <h3 className="modal-title">AI Audit Summary</h3>
            <span className="ml-auto text-xs text-slate-400 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">
              Powered by Ollama llama3
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
            {aiSummary}
          </div>
          <p className="text-xs text-slate-400 mt-2">Summarised from {logs.length} visible log entries on this page.</p>
          <button onClick={() => setAiSummaryModal(false)}
            className="btn-secondary w-full mt-4">Close</button>
        </div>
      </div>
    )}
    </div>
  );
}
