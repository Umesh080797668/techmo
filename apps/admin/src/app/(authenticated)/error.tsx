'use client';
import { useEffect } from 'react';
import { ServerCrash, WifiOff } from 'lucide-react';

// ── Detect error category from the thrown message ──────────────────────────
type ErrorType = '502' | '500';

function detectType(error: Error): ErrorType {
  const msg = (error?.message ?? '').toLowerCase();
  if (
    msg.includes('502') ||
    msg.includes('bad gateway') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('service unavailable') ||
    msg.includes('503')
  ) {
    return '502';
  }
  return '500';
}

const CONFIG: Record<
  ErrorType,
  {
    code: string;
    Icon: React.ElementType;
    gradient: string;
    iconColor: string;
    iconBg: string;
    title: string;
    body: string;
  }
> = {
  '502': {
    code: '502',
    Icon: WifiOff,
    gradient: 'from-amber-500 to-amber-300',
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-50',
    title: 'Service Unavailable',
    body: 'The backend service is temporarily unreachable. This is usually transient — please wait a moment and try again.',
  },
  '500': {
    code: '500',
    Icon: ServerCrash,
    gradient: 'from-red-500 to-red-300',
    iconColor: 'text-red-500',
    iconBg: 'bg-red-50',
    title: 'Internal Server Error',
    body: 'Something went wrong on the server. The issue has been logged automatically and the team has been notified.',
  },
};

export default function AuthenticatedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const type = detectType(error);
  const cfg = CONFIG[type];
  const { Icon } = cfg;

  // Report silently via Sentry / GlitchTip — no console.error
  useEffect(() => {
    try {
      const Sentry = (globalThis as any).__sentry ?? (globalThis as any).Sentry;
      if (Sentry?.captureException) Sentry.captureException(error);
    } catch {
      // ignore — telemetry must never throw
    }
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fadeIn">
      {/* Icon badge */}
      <div
        className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl ${cfg.iconBg} mb-6`}
      >
        <Icon className={`w-10 h-10 ${cfg.iconColor}`} />
      </div>

      {/* Code */}
      <div
        className={`text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br ${cfg.gradient} mb-3 select-none`}
      >
        {cfg.code}
      </div>

      {/* Title / body */}
      <h1 className="text-2xl font-bold text-slate-800 mb-2">{cfg.title}</h1>
      <p className="text-slate-500 text-sm leading-relaxed max-w-sm mb-2">{cfg.body}</p>

      {/* Error digest for support reference */}
      {error.digest && (
        <p className="text-xs text-slate-400 font-mono bg-slate-100 px-3 py-1.5 rounded-lg inline-block mt-1 mb-4">
          Ref: {error.digest}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
        >
          ↺ Try Again
        </button>
        <a
          href="/dashboard"
          className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
        >
          ← Dashboard
        </a>
      </div>
    </div>
  );
}
