'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Zap, CheckCircle2 } from 'lucide-react';

interface LoginForm {
  username: string;
  password: string;
}

export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') ?? '/dashboard';
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  // Already logged in
  useEffect(() => {
    if (!isLoading && user) {
      router.replace(from);
    }
  }, [user, isLoading, router, from]);

  const onSubmit = async (data: LoginForm) => {
    setSubmitting(true);
    try {
      const result = await login(data.username, data.password);
      // Cookie is set inside AuthContext.login() — no need to duplicate here.
      toast.success('Welcome back!');
      if (result?.mustChangePassword) {
        router.replace('/force-change-password');
      } else {
        router.replace(from);
      }
    } catch (err: any) {
      // err.message is always a clean string — AuthContext normalises AxiosError
      // into a plain Error before re-throwing, so no raw objects reach here.
      toast.error(err?.message ?? 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  };

  // Show the login form immediately to avoid SSR → client visual flip.
  // While the auth provider performs the initial silent refresh we
  // keep inputs disabled to prevent user interaction.
  const disabled = isLoading || submitting;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-96 bg-sidebar text-white p-10">
        <div>
          <div className="flex items-center gap-2 mb-12">
            <Zap className="w-7 h-7 text-accent" />
            <span className="text-2xl font-bold">TechMo</span>
          </div>
          <h2 className="text-3xl font-bold leading-snug mb-4">
            Enterprise Retail &amp; Service Management
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            POS, inventory, repairs, loyalty, HR and more — all in one platform.
          </p>
        </div>
        <div className="space-y-3 text-sm text-slate-400">
          {['POS Checkout', 'Inventory Control', 'Repair Ticketing', 'Loyalty Program', 'HR & Payroll'].map(f => (
            <div key={f} className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 lg:hidden">
            <Zap className="w-8 h-8 text-primary mx-auto" />
            <h1 className="text-2xl font-bold text-slate-800 mt-2">TechMo Admin</h1>
          </div>

          <div className="card p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-1">Sign In</h2>
            <p className="text-sm text-slate-500 mb-6">Enter your credentials to access the system.</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="label">Username</label>
                <input
                  type="text"
                  autoComplete="username"
                  autoFocus={!isLoading}
                  className={`input ${errors.username ? 'border-red-300 focus:ring-red-200' : ''}`}
                  placeholder="Enter username"
                  disabled={disabled}
                  {...register('username', { required: 'Username is required' })}
                />
                {errors.username && (
                  <p className="text-xs text-red-500 mt-1">{errors.username.message}</p>
                )}
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className={`input pr-10 ${errors.password ? 'border-red-300 focus:ring-red-200' : ''}`}
                    placeholder="Enter password"
                    disabled={disabled}
                    {...register('password', { required: 'Password is required' })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
                )}
                <p className="text-xs text-slate-400 mt-1.5">New staff member? Use the temporary password shared by your admin.</p>
              </div>

              <button
                type="submit"
                disabled={disabled}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2"
              >
                {(isLoading || submitting) ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isLoading ? 'Preparing…' : 'Signing in…'}
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs text-center text-slate-400">
                TechMo Enterprise System · Access restricted to authorized staff only
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
