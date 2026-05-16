import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function AuthenticatedNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fadeIn">
      {/* Icon badge */}
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-indigo-50 mb-6">
        <FileQuestion className="w-10 h-10 text-indigo-500" />
      </div>

      {/* Code */}
      <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-indigo-300 mb-3 select-none">
        404
      </div>

      {/* Message */}
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Page Not Found</h1>
      <p className="text-slate-500 text-sm leading-relaxed max-w-sm mb-8">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        Check the URL or navigate back to the dashboard.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors inline-flex items-center justify-center gap-2"
        >
          ← Back to Dashboard
        </Link>
        <Link
          href="/pos"
          className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors inline-flex items-center justify-center gap-2"
        >
          Open POS
        </Link>
      </div>
    </div>
  );
}
