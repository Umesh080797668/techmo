'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  Star, CheckCircle2, XCircle, Trash2, ImageIcon,
  MessageSquare, Clock, BarChart3, Sparkles,
} from 'lucide-react';
import Image from 'next/image';
import clsx from 'clsx';

const STATUS_TABS = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const;
type StatusTab = typeof STATUS_TABS[number];

const STATUS_BADGE: Record<string, string> = {
  PENDING:  'bg-amber-100 text-amber-700 border border-amber-200',
  APPROVED: 'bg-green-100 text-green-700 border border-green-200',
  REJECTED: 'bg-red-100 text-red-700 border border-red-200',
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={clsx('w-4 h-4', i < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300')}
        />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<StatusTab>('PENDING');
  const [page, setPage] = useState(1);
  const [noteModal, setNoteModal] = useState<{ id: string; action: 'APPROVED' | 'REJECTED' } | null>(null);
  const [note, setNote] = useState('');
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  const statusParam = tab === 'ALL' ? undefined : tab;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reviews', statusParam, page],
    queryFn: () => reviewsApi.adminList({ status: statusParam, page, limit: 15 }).then(r => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['review-stats'],
    queryFn: () => reviewsApi.stats().then(r => r.data),
  });

  const moderateMutation = useMutation({
    mutationFn: ({ id, status, adminNote, featured }: {
      id: string; status: 'APPROVED' | 'REJECTED'; adminNote?: string; featured?: boolean;
    }) => reviewsApi.moderate(id, { status, adminNote, featured }),
    onSuccess: () => {
      toast.success('Review updated');
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
      qc.invalidateQueries({ queryKey: ['review-stats'] });
      setNoteModal(null);
      setNote('');
    },
    onError: () => toast.error('Failed to update review'),
  });

  const featureMutation = useMutation({
    mutationFn: (id: string) => reviewsApi.toggleFeatured(id),
    onSuccess: () => {
      toast.success('Featured status toggled');
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
    },
    onError: () => toast.error('Failed to update review'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => reviewsApi.delete(id),
    onSuccess: () => {
      toast.success('Review deleted');
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
      qc.invalidateQueries({ queryKey: ['review-stats'] });
    },
    onError: () => toast.error('Failed to delete review'),
  });

  const reviews: any[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / 15);

  const handleModerate = (id: string, action: 'APPROVED' | 'REJECTED') => {
    setNoteModal({ id, action });
    setNote('');
  };

  const confirmModerate = () => {
    if (!noteModal) return;
    moderateMutation.mutate({
      id: noteModal.id,
      status: noteModal.action,
      adminNote: note.trim() || undefined,
      featured: noteModal.action === 'APPROVED' ? false : undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
          <p className="text-sm text-gray-500 mt-0.5">Moderate customer reviews &amp; manage the happy-customers gallery.</p>
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Pending',  value: stats.pending,  icon: <Clock className="w-5 h-5 text-amber-500" />,   bg: 'bg-amber-50'  },
            { label: 'Approved', value: stats.approved, icon: <CheckCircle2 className="w-5 h-5 text-green-500" />, bg: 'bg-green-50' },
            { label: 'Rejected', value: stats.rejected, icon: <XCircle className="w-5 h-5 text-red-500" />,   bg: 'bg-red-50'    },
            { label: 'Avg Rating', value: `${stats.avgRating} ★`, icon: <BarChart3 className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-50' },
          ].map(s => (
            <div key={s.label} className={clsx('rounded-2xl p-4 flex items-center gap-3', s.bg)}>
              <div className="p-2 bg-white rounded-xl shadow-sm">{s.icon}</div>
              <div>
                <div className="text-xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {STATUS_TABS.map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Reviews table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No reviews in this category</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reviews.map((r: any) => (
              <div key={r.id} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Photo thumbnail */}
                  {r.photoUrl ? (
                    <button
                      onClick={() => setPhotoModal(r.photoUrl)}
                      className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-gray-200 hover:opacity-80 transition-opacity"
                    >
                      <Image src={r.photoUrl} alt="Review photo" width={64} height={64} className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-gray-300">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 text-sm">
                        {r.customer?.firstName} {r.customer?.lastName}
                      </span>
                      <span className="text-xs text-gray-400">{r.customer?.email ?? r.customer?.phone}</span>
                      <span className={clsx('px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase', STATUS_BADGE[r.status])}>
                        {r.status}
                      </span>
                      {r.featured && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                          <Sparkles className="w-3 h-3" /> Featured
                        </span>
                      )}
                      <span className="text-xs text-gray-400 capitalize">{r.type}</span>
                    </div>

                    <Stars rating={r.rating} />

                    {r.title && (
                      <p className="text-sm font-medium text-gray-800 mt-1">{r.title}</p>
                    )}
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed line-clamp-3">{r.body}</p>

                    {r.adminNote && (
                      <p className="mt-2 text-xs text-gray-400 italic">
                        <span className="font-medium not-italic text-gray-500">Admin note:</span> {r.adminNote}
                      </p>
                    )}

                    <p className="text-xs text-gray-400 mt-2">
                      {format(new Date(r.createdAt), 'dd MMM yyyy, HH:mm')}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col gap-2 flex-shrink-0">
                    {r.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleModerate(r.id, 'APPROVED')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleModerate(r.id, 'REJECTED')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </>
                    )}
                    {r.status === 'APPROVED' && (
                      <button
                        onClick={() => featureMutation.mutate(r.id)}
                        disabled={featureMutation.isPending}
                        className={clsx(
                          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                          r.featured
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-gray-100 hover:bg-purple-100 text-gray-600 hover:text-purple-700',
                        )}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {r.featured ? 'Unfeature' : 'Feature'}
                      </button>
                    )}
                    {r.status === 'REJECTED' && (
                      <button
                        onClick={() => handleModerate(r.id, 'APPROVED')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm('Delete this review permanently?')) {
                          deleteMutation.mutate(r.id);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <span className="px-4 py-2 text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}

      {/* Moderate with note modal */}
      {noteModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {noteModal.action === 'APPROVED' ? '✅ Approve Review' : '❌ Reject Review'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {noteModal.action === 'REJECTED'
                ? 'Optionally add a note explaining why this review was rejected (visible to admins only).'
                : 'Optionally add an admin note before approving.'}
            </p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Admin note (optional)..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setNoteModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmModerate}
                disabled={moderateMutation.isPending}
                className={clsx(
                  'px-5 py-2 text-sm font-semibold text-white rounded-xl transition-colors',
                  noteModal.action === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600',
                )}
              >
                {moderateMutation.isPending ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo lightbox */}
      {photoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPhotoModal(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <Image
              src={photoModal}
              alt="Customer photo"
              width={800}
              height={600}
              className="w-full h-auto rounded-2xl object-contain max-h-[80vh]"
            />
            <button
              onClick={() => setPhotoModal(null)}
              className="absolute top-3 right-3 w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
