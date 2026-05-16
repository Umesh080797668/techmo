'use client';
import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Uses btn-danger instead of btn-primary for destructive actions */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Reusable confirmation modal — replaces native browser confirm() / alert().
 *
 * Usage:
 *   const [dialog, setDialog] = useState<{ open: boolean; id?: string }>({ open: false });
 *
 *   <ConfirmDialog
 *     open={dialog.open}
 *     title="Delete item?"
 *     message="This action cannot be undone."
 *     danger
 *     onConfirm={() => { doDelete(dialog.id!); setDialog({ open: false }); }}
 *     onCancel={() => setDialog({ open: false })}
 *   />
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4"
      onClick={e => { if (e.target === overlayRef.current) onCancel(); }}
    >
      <div
        className="card w-full max-w-sm p-6 shadow-xl animate-fadeIn"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-slate-800 mb-2">{title}</h2>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed whitespace-pre-line">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={danger ? 'btn-danger' : 'btn-primary'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
