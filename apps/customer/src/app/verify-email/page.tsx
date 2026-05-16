'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { customerAuthApi } from '@/lib/api';
import { customerTokenStore } from '@/lib/token-store';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import toast from 'react-hot-toast';
import { MailCheck, RotateCcw, ShieldCheck, ArrowLeft } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import OtpCells from '@/components/auth/OtpCells';
import Link from 'next/link';

const EMPTY_OTP = ['', '', '', '', '', ''];

function VerifyEmailInner() {
  const router       = useRouter();
  const params       = useSearchParams();
  const { setCustomer } = useCustomerAuth();

  const email        = params.get('email') ?? '';
  const [otp, setOtp]             = useState<string[]>(EMPTY_OTP);
  const [isLoading, setLoading]   = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [sent, setSent]           = useState(true); // email was sent on register

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const resend = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await customerAuthApi.requestEmailOtp(email);
      setCountdown(60);
      setSent(true);
      toast.success('Verification email resent!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Could not resend. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) { toast.error('Enter all 6 digits'); return; }
    setLoading(true);
    try {
      const res = await customerAuthApi.verifyEmailOtp(email, code);
      const { token, customer } = res.data;
      customerTokenStore.set(token);
      setCustomer(customer);
      toast.success('Email verified! Welcome to TechMo 🎉');
      router.replace('/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Invalid or expired code. Try again.');
      setOtp(EMPTY_OTP);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      {/* Icon */}
      <div className="flex justify-center mb-5">
        <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
          <MailCheck className="w-7 h-7 text-primary" />
        </div>
      </div>

      <h1 className="text-xl font-semibold text-white text-center mb-1">Verify your email</h1>
      <p className="text-sm text-slate-400 text-center mb-1">
        We sent a 6-digit code to
      </p>
      <p className="text-sm text-primary font-medium text-center mb-6 break-all">
        {email || 'your email address'}
      </p>

      {!email && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm text-center">
          No email address found.{' '}
          <Link href="/register" className="underline">Register first</Link>.
        </div>
      )}

      <form onSubmit={verify} className="space-y-5">
        <OtpCells value={otp} onChange={setOtp} disabled={isLoading || !email} />
        <button
          type="submit"
          className="btn-primary w-full"
          disabled={isLoading || !email}
        >
          {isLoading ? <span className="loader" /> : <><ShieldCheck className="w-4 h-4" /> Verify Email</>}
        </button>
      </form>

      <div className="mt-5 text-center">
        {countdown > 0 ? (
          <p className="text-xs text-slate-500">
            Resend code in <span className="text-slate-300 font-medium">{countdown}s</span>
          </p>
        ) : (
          <button
            onClick={resend}
            disabled={isLoading}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1 mx-auto disabled:opacity-50"
          >
            <RotateCcw className="w-3 h-3" /> Resend verification email
          </button>
        )}
      </div>

      <div className="mt-5 text-center">
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

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}
