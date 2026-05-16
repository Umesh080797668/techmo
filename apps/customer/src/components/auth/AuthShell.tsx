'use client';
import { Smartphone } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional footer link, e.g. "Already have an account? Sign in" */
  footerHref?: string;
  footerText?: string;
  footerLinkLabel?: string;
}

export default function AuthShell({
  children,
  footerHref,
  footerText,
  footerLinkLabel,
}: Props) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center group-hover:bg-primary-dark transition-colors">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">TechMo</span>
          </Link>
          <p className="mt-1.5 text-sm text-slate-400">Customer Portal</p>
        </div>

        {/* Card */}
        <div className="auth-card">{children}</div>

        {/* Footer link */}
        {footerHref && footerText && footerLinkLabel && (
          <p className="mt-6 text-center text-sm text-slate-500">
            {footerText}{' '}
            <Link href={footerHref} className="text-primary hover:underline font-medium">
              {footerLinkLabel}
            </Link>
          </p>
        )}

        <p className="mt-5 text-center text-xs text-slate-700">
          Protected by TechMo security. Your data stays private.
        </p>
      </div>
    </main>
  );
}
