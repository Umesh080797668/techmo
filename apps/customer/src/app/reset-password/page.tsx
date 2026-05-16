'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { customerAuthApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Eye, EyeOff, KeyRound, CheckCircle2, XCircle, ArrowLeft, ShieldCheck,
} from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import Link from 'next/link';

function PasswordRule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-400' : 'text-slate-500'}`}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {label}
    </li>
  );
}

function strengthScore(pw: string) {
  let s = 0;
  if (pw.length >= 8)           s++;
  if (/[A-Z]/.test(pw))         s++;
  if (/[0-9]/.test(pw))         s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLOR = ['', 'bg-red-500', 'bg-amber-500', 'bg-yellow-400', 'bg-green-500'];

function ResetPasswordInner() {
  const router   = useRouter();
  const params   = useSearchParams();
  const email    = params.get('email') ?? '';

  // Step 1 = OTP entry, Step 2 = new password entry
  const [step, setStep]           = useState<1 | 2>(1);
  const [otp, setOtp]             = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [showCp, setShowCp]       = useState(false);
  const [isLoading, setLoading]   = useState(false);
  const [success, setSuccess]     = useState(false);
  const [otpError, setOtpError]   = useState('');
  const [resendCooldown, setCooldown] = useState(0);

  const score = strengthScore(password);
  const rules = {
    length:  password.length >= 8,
    upper:   /[A-Z]/.test(password),
    number:  /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  // Guard: if no email param redirect back
  if (!email) {
    return (
      <AuthShell>
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Invalid Request</h1>
          <p className="text-sm text-slate-400 mb-6">
            No email address found. Please start the password reset process again.
          </p>
          <Link href="/forgot-password" className="btn-primary inline-flex">
            Request OTP
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell>
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-green-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Password Reset!</h1>
          <p className="text-sm text-slate-400 mb-6">
            Your password has been updated. You can now sign in with your new password.
          </p>
          <Link href="/login" className="btn-primary inline-flex">
            Sign In
          </Link>
        </div>
      </AuthShell>
    );
  }

  // ── Step 1: OTP verification ──────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setOtpError('Enter the 6-digit code from your email.');
      return;
    }
    // We don't hit an explicit verify endpoint — the OTP is verified at reset time.
    // Just advance to the password step.
    setOtpError('');
    setStep(2);
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      await customerAuthApi.forgotPassword(email);
      toast.success('A new OTP has been sent to your email.');
      setCooldown(60);
      const interval = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) { clearInterval(interval); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch {
      toast.error('Could not resend OTP. Please try again.');
    }
  };

  // ── Step 2: New password ──────────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (score < 2) { toast.error('Please choose a stronger password.'); return; }
    if (password !== confirm) { toast.error('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await customerAuthApi.resetPassword(email, otp, password);
      setSuccess(true);
    } catch (err: any) {
      const msg: string = err?.response?.data?.message ?? 'Reset failed.';
      if (msg.toLowerCase().includes('otp') || msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')) {
        // Go back to OTP step so user can re-enter
        toast.error('OTP is invalid or expired. Please try again.');
        setStep(1);
        setOtp('');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
          step >= 1 ? 'bg-primary text-white' : 'bg-slate-700 text-slate-400'
        }`}>1</div>
        <div className={`flex-1 h-0.5 rounded ${step >= 2 ? 'bg-primary' : 'bg-slate-700'}`} />
        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
          step >= 2 ? 'bg-primary text-white' : 'bg-slate-700 text-slate-400'
        }`}>2</div>
      </div>

      {/* ── STEP 1: Enter OTP ── */}
      {step === 1 && (
        <>
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-primary" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-white mb-1">Enter your OTP</h1>
          <p className="text-sm text-slate-400 mb-1">
            We sent a 6-digit code to <span className="text-white font-medium">{email}</span>.
          </p>
          <p className="text-xs text-slate-500 mb-6">Check your spam folder if you don&apos;t see it.</p>

          <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">6-Digit OTP</label>
              <input
                className={`input-dark text-center text-2xl tracking-[0.5em] font-mono ${
                  otpError ? 'border-red-500 focus:border-red-500' : ''
                }`}
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setOtpError(''); }}
                autoFocus
                autoComplete="one-time-code"
              />
              {otpError && <p className="mt-1 text-xs text-red-400">{otpError}</p>}
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={otp.length !== 6}
            >
              <ShieldCheck className="w-4 h-4" /> Verify OTP
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={handleResendOtp}
              disabled={resendCooldown > 0}
              className="text-xs text-slate-400 hover:text-white disabled:opacity-50 transition-colors"
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't receive it? Resend OTP"}
            </button>
          </div>
        </>
      )}

      {/* ── STEP 2: New Password ── */}
      {step === 2 && (
        <>
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-primary" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-white mb-1">Set new password</h1>
          <p className="text-sm text-slate-400 mb-6">Choose a strong password for your account.</p>

          <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  className="input-dark pr-11"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((n) => (
                      <div
                        key={n}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          score >= n ? STRENGTH_COLOR[score] : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${STRENGTH_COLOR[score].replace('bg-', 'text-')}`}>
                    {STRENGTH_LABEL[score]}
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    <PasswordRule ok={rules.length}  label="At least 8 characters" />
                    <PasswordRule ok={rules.upper}   label="One uppercase letter" />
                    <PasswordRule ok={rules.number}  label="One number" />
                    <PasswordRule ok={rules.special} label="One special character" />
                  </ul>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
              <div className="relative">
                <input
                  className={`input-dark pr-11 ${
                    confirm && password !== confirm ? 'border-red-500 focus:border-red-500' : ''
                  }`}
                  type={showCp ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCp(!showCp)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label={showCp ? 'Hide password' : 'Show password'}
                >
                  {showCp ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirm && password !== confirm && (
                <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={isLoading || score < 2 || password !== confirm || !password}
            >
              {isLoading ? <span className="loader" /> : <><KeyRound className="w-4 h-4" /> Reset Password</>}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => { setStep(1); setPassword(''); setConfirm(''); }}
              className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> Back to OTP
            </button>
          </div>
        </>
      )}

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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordInner />
    </Suspense>
  );
}