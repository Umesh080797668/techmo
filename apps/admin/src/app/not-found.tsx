import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1117] px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-indigo-600/8 blur-3xl" />
      </div>
      <div className="relative z-10 text-center max-w-md">
        <div className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-br from-indigo-500 to-indigo-500/30 mb-2 select-none">
          404
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Page Not Found</h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-8">
          The page you were looking for doesn't exist. It may have been moved or the URL is incorrect.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors inline-flex items-center justify-center gap-2"
          >
            ← Back to Dashboard
          </Link>
          <Link
            href="/pos"
            className="px-5 py-2.5 rounded-xl bg-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-600 transition-colors inline-flex items-center justify-center gap-2"
          >
            Open POS
          </Link>
        </div>
      </div>
    </div>
  );
}
