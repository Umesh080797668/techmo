'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';

interface ChangeForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ForceChangePasswordPage() {
  const { user, isLoading, updateUser } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showCurrent, setShowCurrent] = useState(true); // default visible so they see admin-given pw
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ChangeForm>();

  // If user doesn't need to change password, redirect to dashboard
  useEffect(() => {
    if (!isLoading && user && !user.mustChangePassword) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  const onSubmit = async (data: ChangeForm) => {
    if (data.newPassword !== data.confirmPassword) return;
    setSubmitting(true);
    try {
      await authApi.changePassword(data.currentPassword, data.newPassword);
      // Clear the flag in the local user state
      updateUser({ mustChangePassword: false });
      toast.success('Password changed successfully! Welcome aboard.');
      router.replace('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to change password';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="page-title">Set Your Password</h1>
          <p className="text-sm text-slate-500 mt-2">
            Your account was created by an administrator. Please set a new password to continue.
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Current (admin-given) password */}
            <div>
              <label className="label">Current Password</label>
              <p className="text-xs text-slate-400 mb-1.5">This is the temporary password given to you by your administrator.</p>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`input pr-10 ${errors.currentPassword ? 'border-red-300 focus:ring-red-200' : ''}`}
                  placeholder="Enter the password you received"
                  autoFocus
                  {...register('currentPassword', { required: 'Current password is required' })}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-xs text-red-500 mt-1">{errors.currentPassword.message}</p>
              )}
            </div>

            {/* New password */}
            <div>
              <label className="label">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`input pr-10 ${errors.newPassword ? 'border-red-300 focus:ring-red-200' : ''}`}
                  placeholder="Choose a strong password"
                  {...register('newPassword', {
                    required: 'New password is required',
                    minLength: { value: 8, message: 'Must be at least 8 characters' },
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-xs text-red-500 mt-1">{errors.newPassword.message}</p>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="label">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`input pr-10 ${errors.confirmPassword ? 'border-red-300 focus:ring-red-200' : ''}`}
                  placeholder="Repeat your new password"
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: v => v === watch('newPassword') || 'Passwords do not match',
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  Set New Password
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-xs text-center text-slate-400 mt-4">
          Logged in as <span className="font-medium">{user.name ?? user.username}</span>
        </p>
      </div>
    </div>
  );
}
