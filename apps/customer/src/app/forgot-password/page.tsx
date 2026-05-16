'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { customerAuthApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Send, ArrowLeft } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const router                  = useRouter();
  const [email, setEmail]       = useState('');
  const [isLoading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) { toast.error('Enter a valid email address'); return; }
    setLoading(true);
    try {
      await customerAuthApi.forgotPassword(email.trim().toLowerCase());
    } catch {
      // Swallow errors — don't reveal whether email exists
    } finally {
      setLoading(false);
    }
    // Always redirect to OTP entry regardless of result (prevents email enumeration)
    router.push(`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`);
  };

  return (
    <AuthShell>
      <div className="flex justify-center mb-5">
        <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
          <Send className="w-6 h-6 text-primary" />
        </div>
      </div>
      <h1 className="text-xl font-semibold text-white mb-1">Forgot your password?</h1>
      <p className="text-sm text-slate-400 mb-6">
        Enter your email and we&apos;ll send you a 6-digit OTP to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
          <input
            className="input-dark"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            autoComplete="email"
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={isLoading}>
          {isLoading ? <span className="loader" /> : <><Send className="w-4 h-4" /> Send OTP</>}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
