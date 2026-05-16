'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { myReviewsApi } from '@/lib/api';
import { Star, Trash2, Clock, CheckCircle, XCircle, PlusCircle, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

// ─── Star Picker ──────────────────────────────────────────────────────────────
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          className="focus:outline-none"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star
            size={28}
            className={clsx(
              'transition-colors',
              (hovered || value) >= n ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600',
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Star Display (read-only) ─────────────────────────────────────────────────
function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={n <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600'}
        />
      ))}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    PENDING:  { label: 'Pending',  icon: <Clock size={12} />,       cls: 'bg-amber-400/10   text-amber-400   border border-amber-400/20'   },
    APPROVED: { label: 'Approved', icon: <CheckCircle size={12} />, cls: 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20' },
    REJECTED: { label: 'Rejected', icon: <XCircle size={12} />,     cls: 'bg-red-400/10     text-red-400     border border-red-400/20'     },
  };
  const { label, icon, cls } = cfg[status] ?? cfg.PENDING;
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cls)}>
      {icon}{label}
    </span>
  );
}

// ─── Submit Form ──────────────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value: 'GENERAL', label: 'General Experience' },
  { value: 'PRODUCT', label: 'Product Review' },
  { value: 'REPAIR',  label: 'Repair Service' },
];

function SubmitForm({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    rating: 0,
    title: '',
    body: '',
    photoUrl: '',
    type: 'GENERAL' as 'GENERAL' | 'PRODUCT' | 'REPAIR',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => myReviewsApi.submit({ ...form, title: form.title || undefined, photoUrl: form.photoUrl || undefined }),
    onSuccess: () => {
      setForm({ rating: 0, title: '', body: '', photoUrl: '', type: 'GENERAL' });
      setOpen(false);
      onSuccess();
    },
  });

  function validate() {
    const e: Record<string, string> = {};
    if (!form.rating) e.rating = 'Please choose a star rating.';
    if (!form.body.trim()) e.body = 'Please write something about your experience.';
    if (form.body.length > 1200) e.body = 'Maximum 1200 characters.';
    if (form.title && form.title.length > 120) e.title = 'Maximum 120 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) mutation.mutate();
  }

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity"
      >
        <span className="flex items-center gap-2 font-semibold text-white">
          <PlusCircle size={20} className="text-primary" />
          Write a Review
        </span>
        <ChevronDown
          size={18}
          className={clsx('text-slate-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <form onSubmit={submit} className="border-t border-slate-700/50 space-y-5 pt-5 mt-4">
          {/* Star rating */}
          <div>
            <label className="label">
              Rating <span className="text-red-400">*</span>
            </label>
            <StarPicker value={form.rating} onChange={(v) => setForm((f) => ({ ...f, rating: v }))} />
            {errors.rating && <p className="text-xs text-red-400 mt-1">{errors.rating}</p>}
          </div>

          {/* Type */}
          <div>
            <label className="label">Category</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))}
              className="input"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="label">
              Title <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              maxLength={120}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Summarise your experience…"
              className="input"
            />
            {errors.title && <p className="text-xs text-red-400 mt-1">{errors.title}</p>}
          </div>

          {/* Body */}
          <div>
            <label className="label">
              Your Experience <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={4}
              maxLength={1200}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Tell us about your visit or purchase…"
              className="input resize-none"
            />
            <div className="flex justify-between mt-1">
              {errors.body
                ? <p className="text-xs text-red-400">{errors.body}</p>
                : <span />
              }
              <span className="text-xs text-slate-500">{form.body.length}/1200</span>
            </div>
          </div>

          {/* Photo URL */}
          <div>
            <label className="label">
              Photo URL <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={form.photoUrl}
              onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
              placeholder="https://…"
              className="input"
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-400">
              {(mutation.error as any)?.response?.data?.message ?? 'Something went wrong. Please try again.'}
            </p>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="btn-primary w-full"
          >
            {mutation.isPending ? <span className="loader" /> : 'Submit Review'}
          </button>
        </form>
      )}
    </div>
  );
}

// ─── My Past Reviews ──────────────────────────────────────────────────────────
function ReviewCard({ review, onDelete }: { review: any; onDelete: () => void }) {
  const deleteM = useMutation({
    mutationFn: () => myReviewsApi.deleteOwn(review.id),
    onSuccess: onDelete,
  });

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          {review.title && (
            <h3 className="font-semibold text-white text-sm mb-1">{review.title}</h3>
          )}
          <StarDisplay rating={review.rating} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={review.status} />
          {review.status === 'PENDING' && (
            <button
              onClick={() => deleteM.mutate()}
              disabled={deleteM.isPending}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
              title="Delete review"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-slate-300 leading-relaxed">{review.body}</p>

      {review.photoUrl && (
        <img
          src={review.photoUrl}
          alt="Review photo"
          className="w-24 h-24 object-cover rounded-lg border border-slate-700"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}

      {review.adminNote && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-400">
          <span className="font-medium text-slate-300">Note from team: </span>{review.adminNote}
        </div>
      )}

      <p className="text-xs text-slate-500">
        {new Date(review.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        {' · '}{review.type.charAt(0) + review.type.slice(1).toLowerCase()} Review
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MyReviewsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-reviews'],
    queryFn: () => myReviewsApi.mine().then((r) => r.data),
    staleTime: 30_000,
  });

  const reviews: any[] = data?.reviews ?? data ?? [];

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['my-reviews'] });
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">My Reviews</h1>
        <p className="text-sm text-slate-400 mt-1">
          Share your experience and help others. Reviews are published after moderation.
        </p>
      </div>

      {/* Submit form */}
      <SubmitForm onSuccess={invalidate} />

      {/* Past reviews */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">
          Past Reviews
          {reviews.length > 0 && (
            <span className="ml-2 text-xs font-normal text-slate-500">({reviews.length})</span>
          )}
        </h2>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map((n) => (
              <div key={n} className="card animate-pulse space-y-3">
                <div className="flex gap-2">
                  <div className="h-4 bg-slate-700 rounded w-32" />
                  <div className="h-4 bg-slate-700 rounded w-16" />
                </div>
                <div className="h-3 bg-slate-700 rounded w-full" />
                <div className="h-3 bg-slate-700 rounded w-4/5" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl p-4">
            Could not load your reviews. Please try again later.
          </div>
        )}

        {!isLoading && !isError && reviews.length === 0 && (
          <div className="card flex flex-col items-center justify-center py-10 text-slate-500">
            <Star className="opacity-20 mb-2" size={32} />
            <p className="text-sm">You haven&apos;t written any reviews yet.</p>
            <p className="text-xs mt-1 text-slate-600">Use the form above to share your experience!</p>
          </div>
        )}

        {!isLoading && !isError && reviews.length > 0 && (
          <div className="space-y-3">
            {reviews.map((r: any) => (
              <ReviewCard key={r.id} review={r} onDelete={invalidate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
