'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { customerAuthApi } from '@/lib/api';
import { customerTokenStore } from '@/lib/token-store';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import toast from 'react-hot-toast';
import { ArrowRight, RotateCcw, ShieldCheck, Eye, EyeOff, Phone, Mail } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';
import OtpCells from '@/components/auth/OtpCells';

type Tab  = 'phone' | 'email';
type Step = 'input' | 'otp';

const EMPTY_OTP = ['', '', '', '', '', ''];

export default function LoginPage() {
  const router = useRouter();
  const { setCustomer, isAuthenticated } = useCustomerAuth();

  const [tab, setTab]             = useState<Tab>('phone');
  const [step, setStep]           = useState<Step>('input');
  const [isLoading, setLoading]   = useState(false);
  const [showPw, setShowPw]       = useState(false);

  // Phone-OTP state
  const [phone, setPhone]         = useState('');
  const [otp, setOtp]             = useState<string[]>(EMPTY_OTP);
  const [countdown, setCountdown] = useState(0);

  // Email-Password state
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');

  useEffect(() => { if (isAuthenticated) router.replace('/dashboard'); }, [isAuthenticated, router]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Phone OTP ──────────────────────────────────────────────────────────────
  const sendPhoneOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (phone.replace(/\D/g, '').length < 9) {
      toast.error('Enter a valid phone number'); return;
    }
    setLoading(true);
    try {
      await customerAuthApi.requestOtp(phone.trim());
      setStep('otp');
      setCountdown(60);
      toast.success('OTP sent to your phone!');
    } catch (err: any) {
      const msg: string = err?.response?.data?.message ?? '';
      if (msg.toLowerCase().includes('not found')) {
        toast.error('Phone not registered. Please sign up or visit a TechMo store.');
      } else {
        toast.error(msg || 'Could not send OTP. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) { toast.error('Enter all 6 digits'); return; }
    setLoading(true);
    try {
      const res = await customerAuthApi.verifyOtp(phone, code);
      const { token, customer } = res.data;
      // Keep access token in-memory only — never in localStorage (XSS risk).
      customerTokenStore.set(token);
      setCustomer(customer);
      toast.success(`Welcome back, ${customer.name.split(' ')[0]}!`);
      router.replace('/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Invalid OTP. Try again.');
      setOtp(EMPTY_OTP);
    } finally {
      setLoading(false);
    }
  };

  // ── Email + Password ───────────────────────────────────────────────────────
  const loginEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Email and password are required'); return; }
    setLoading(true);
    try {
      const res = await customerAuthApi.loginEmail(email.trim(), password);
      if (res.data.requiresEmailVerification) {
        toast('Please verify your email first.', { icon: '✉️' });
        router.push(`/verify-email?email=${encodeURIComponent(email.trim())}`);
        return;
      }
      const { token, customer } = res.data;
      // Keep access token in-memory only — never in localStorage (XSS risk).
      customerTokenStore.set(token);
      setCustomer(customer);
      toast.success(`Welcome back, ${customer.name.split(' ')[0]}!`);
      if (res.data.mustChangePassword) {
        router.replace('/change-password');
      } else {
        router.replace('/dashboard');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Incorrect email or password.');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (t: Tab) => {
    setTab(t); setStep('input'); setOtp(EMPTY_OTP);
    setPhone(''); setEmail(''); setPassword(''); setCountdown(0);
  };

  return (
    <AuthShell
      footerHref="/register"
      footerText="Don't have an account?"
      footerLinkLabel="Create one"
    >
      <h1 className="text-xl font-semibold text-white mb-1">Sign in to your account</h1>
      <p className="text-sm text-slate-400 mb-6">Access your repairs, orders &amp; loyalty points.</p>

      {/* ── Tab switcher ── */}
      <div className="flex rounded-xl overflow-hidden border border-slate-700 mb-6">
        {(['phone', 'email'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-primary text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/40'
            }`}
          >
            {t === 'phone' ? <Phone className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
            {t === 'phone' ? 'Phone OTP' : 'Email & Password'}
          </button>
        ))}
      </div>

      {/* ── Phone OTP: enter phone ── */}
      {tab === 'phone' && step === 'input' && (
        <form onSubmit={sendPhoneOtp} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Mobile Number</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">
                🇱🇰 +94
              </span>
              <input
                className="input-dark pl-16"
                type="tel"
                placeholder="71 234 5678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={isLoading}>
            {isLoading ? <span className="loader" /> : <>Send OTP <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
      )}

      {/* ── Phone OTP: enter code ── */}
      {tab === 'phone' && step === 'otp' && (
        <>
          <button
            onClick={() => { setStep('input'); setOtp(EMPTY_OTP); }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white mb-5 transition-colors"
          >
            ← Change number
          </button>
          <p className="text-sm text-slate-300 mb-5">
            OTP sent to <span className="text-primary font-medium">{phone}</span>
          </p>
          <form onSubmit={verifyPhoneOtp} className="space-y-5">
            <OtpCells value={otp} onChange={setOtp} disabled={isLoading} />
            <button type="submit" className="btn-primary w-full" disabled={isLoading}>
              {isLoading ? <span className="loader" /> : <><ShieldCheck className="w-4 h-4" /> Verify &amp; Sign In</>}
            </button>
          </form>
          <div className="mt-4 text-center">
            {countdown > 0 ? (
              <p className="text-xs text-slate-500">
                Resend in <span className="text-slate-300 font-medium">{countdown}s</span>
              </p>
            ) : (
              <button
                onClick={() => sendPhoneOtp()}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mx-auto"
              >
                <RotateCcw className="w-3 h-3" /> Resend OTP
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Email + Password ── */}
      {tab === 'email' && (
        <form onSubmit={loginEmail} className="space-y-4" noValidate>
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
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-slate-300">Password</label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                className="input-dark pr-11"
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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
          </div>
          <button type="submit" className="btn-primary w-full" disabled={isLoading}>
            {isLoading ? <span className="loader" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
          </button>
          <p className="text-xs text-center text-slate-500 pt-1">
            First time? Use the temporary password provided by the store.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
