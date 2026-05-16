'use client';
import { useEffect } from 'react';
import { ServerCrash, WifiOff } from 'lucide-react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Report silently via Sentry / GlitchTip — never log to console
  useEffect(() => {
    try {
      const Sentry = (globalThis as any).__sentry ?? (globalThis as any).Sentry;
      if (Sentry?.captureException) Sentry.captureException(error);
    } catch {
      // ignore — telemetry must never throw
    }
  }, [error]);

  const msg = (error?.message ?? '').toLowerCase();
  const is502 =
    msg.includes('502') ||
    msg.includes('bad gateway') ||
    msg.includes('econnrefused') ||
    msg.includes('503');

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-[#0f1117] px-4 font-sans">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div
            className={`absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-3xl ${
              is502 ? 'bg-amber-600/8' : 'bg-red-600/8'
            }`}
          />
        </div>

        <div className="relative z-10 text-center max-w-md">
          <div
            className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 ${
              is502 ? 'bg-amber-500/15' : 'bg-red-500/15'
            }`}
          >
            {is502 ? (
              <WifiOff className="w-10 h-10 text-amber-400" />
            ) : (
              <ServerCrash className="w-10 h-10 text-red-400" />
            )}
          </div>

          <div
            className={`text-9xl font-black text-transparent bg-clip-text bg-gradient-to-br mb-2 select-none ${
              is502 ? 'from-amber-500 to-amber-500/30' : 'from-red-500 to-red-500/30'
            }`}
          >
            {is502 ? '502' : '500'}
          </div>

          <h1 className="text-2xl font-bold text-white mb-3">
            {is502 ? 'Service Unavailable' : 'Internal Server Error'}
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-2">
            {is502
              ? 'The backend service is temporarily unreachable. Please wait a moment and try again.'
              : 'An unexpected error occurred. The issue has been logged and the team has been notified.'}
          </p>

          {error.digest && (
            <p className="text-xs text-slate-600 font-mono bg-slate-800 px-3 py-1.5 rounded-lg inline-block mt-1 mb-4">
              Ref: {error.digest}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
            >
              ↺ Try Again
            </button>
            <a
              href="/dashboard"
              className="px-5 py-2.5 rounded-xl bg-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-600 transition-colors"
            >
              ← Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
