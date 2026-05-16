'use client';
import Link from 'next/link';
import { Smartphone, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/8 blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-md">
        <div className="mb-6 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15">
          <Smartphone className="w-7 h-7 text-primary" />
        </div>

        <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-primary to-primary/40 mb-2">
          404
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
        <p className="text-slate-400 mb-8 text-sm leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard" className="btn-primary flex items-center justify-center gap-2">
            <Home className="w-4 h-4" /> Go to Dashboard
          </Link>
          <button onClick={() => history.back()} className="btn-secondary flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </div>
      </div>
    </main>
  );
}
