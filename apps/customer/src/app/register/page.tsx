'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { customerAuthApi } from '@/lib/api';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, UserPlus, CheckCircle2, XCircle } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';

interface FormState {
  name:            string;
  phone:           string;
  email:           string;
  address:         string;
  password:        string;
  confirmPassword: string;
}

const INIT: FormState = { name: '', phone: '', email: '', address: '', password: '', confirmPassword: '' };

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
  if (pw.length >= 8)         s++;
  if (/[A-Z]/.test(pw))       s++;
  if (/[0-9]/.test(pw))       s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s; // 0–4
}

const STRENGTH_LABEL  = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLOR  = ['', 'bg-red-500', 'bg-amber-500', 'bg-yellow-400', 'bg-green-500'];

export default function RegisterPage() {
  const router = useRouter();
  const { setCustomer } = useCustomerAuth();

  const [form, setForm]         = useState<FormState>(INIT);
  const [showPw, setShowPw]     = useState(false);
  const [showCp, setShowCp]     = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [errors, setErrors]     = useState<Partial<FormState>>({});

  const score = strengthScore(form.password);
  const rules = {
    length:  form.password.length >= 8,
    upper:   /[A-Z]/.test(form.password),
    number:  /[0-9]/.test(form.password),
    special: /[^A-Za-z0-9]/.test(form.password),
  };

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<FormState> = {};
    if (!form.name.trim())         e.name = 'Full name is required';
    if (form.phone.replace(/\D/g, '').length < 9) e.phone = 'Valid phone number required';
    if (!form.email.includes('@')) e.email = 'Valid email address required';
    if (score < 2)                 e.password = 'Password is too weak';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await customerAuthApi.register({
        name:     form.name.trim(),
        phone:    form.phone.trim(),
        email:    form.email.trim().toLowerCase(),
        password: form.password,
        address:  form.address.trim() || undefined,
      });

      // Server may auto-login OR require email verification
      if (res.data.requiresEmailVerification) {
        toast.success('Account created! Please verify your email.');
        router.push(`/verify-email?email=${encodeURIComponent(form.email.trim())}`);
        return;
      }

      if (res.data.token) {
        localStorage.setItem('techmo_customer_token', res.data.token);
        setCustomer(res.data.customer);
        toast.success('Welcome to TechMo!');
        router.replace('/dashboard');
      }
    } catch (err: any) {
      const msg: string = err?.response?.data?.message ?? 'Registration failed.';
      if (msg.toLowerCase().includes('email')) setErrors((er) => ({ ...er, email: msg }));
      else if (msg.toLowerCase().includes('phone')) setErrors((er) => ({ ...er, phone: msg }));
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      footerHref="/login"
      footerText="Already have an account?"
      footerLinkLabel="Sign in"
    >
      <h1 className="text-xl font-semibold text-white mb-1">Create your account</h1>
      <p className="text-sm text-slate-400 mb-6">
        Join TechMo to track repairs, orders &amp; loyalty points.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
          <input
            className={`input-dark ${errors.name ? 'border-red-500 focus:border-red-500' : ''}`}
            type="text"
            placeholder="Amara Perera"
            value={form.name}
            onChange={set('name')}
            autoFocus
            autoComplete="name"
          />
          {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
        </div>

        {/* Phone (required) */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Mobile Number <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">
              🇱🇰 +94
            </span>
            <input
              className={`input-dark pl-16 ${errors.phone ? 'border-red-500 focus:border-red-500' : ''}`}
              type="tel"
              placeholder="71 234 5678"
              value={form.phone}
              onChange={set('phone')}
              inputMode="tel"
              autoComplete="tel"
            />
          </div>
          {errors.phone && <p className="mt-1 text-xs text-red-400">{errors.phone}</p>}
        </div>

        {/* Email (required) */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Email Address <span className="text-red-400">*</span>
          </label>
          <input
            className={`input-dark ${errors.email ? 'border-red-500 focus:border-red-500' : ''}`}
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
          />
          {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
          <p className="mt-1 text-xs text-slate-500">Used for email verification and account recovery.</p>
        </div>

        {/* Address (optional) */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Address <span className="text-slate-500">(optional)</span>
          </label>
          <input
            className="input-dark"
            type="text"
            placeholder="123 Galle Road, Colombo 03"
            value={form.address}
            onChange={set('address')}
            autoComplete="street-address"
          />
          <p className="mt-1 text-xs text-slate-500">Your delivery / contact address.</p>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
          <div className="relative">
            <input
              className={`input-dark pr-11 ${errors.password ? 'border-red-500 focus:border-red-500' : ''}`}
              type={showPw ? 'text' : 'password'}
              placeholder="Create a strong password"
              value={form.password}
              onChange={set('password')}
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

          {/* Strength bar */}
          {form.password.length > 0 && (
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
          {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
          <div className="relative">
            <input
              className={`input-dark pr-11 ${errors.confirmPassword ? 'border-red-500 focus:border-red-500' : ''}`}
              type={showCp ? 'text' : 'password'}
              placeholder="Repeat your password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
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
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-400">{errors.confirmPassword}</p>
          )}
        </div>

        <button type="submit" className="btn-primary w-full mt-2" disabled={isLoading}>
          {isLoading ? <span className="loader" /> : <><UserPlus className="w-4 h-4" /> Create Account</>}
        </button>
      </form>

      <p className="mt-5 text-xs text-slate-600 text-center">
        By creating an account you agree to our{' '}
        <a href="/terms" className="text-slate-400 hover:underline">Terms</a>{' '}
        &amp;{' '}
        <a href="/privacy-policy" className="text-slate-400 hover:underline">Privacy Policy</a>.
      </p>
    </AuthShell>
  );
}
