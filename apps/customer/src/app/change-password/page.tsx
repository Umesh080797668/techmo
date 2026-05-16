'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { customerAuthApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import AuthShell from '@/components/auth/AuthShell';

export default function ChangePasswordPage() {
  const { customer, isLoading, updateCustomer } = useCustomerAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showCurrent, setShowCurrent] = useState(true); // visible by default so customer can see admin-given pw
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // If customer doesn't need to change password, redirect to dashboard
  useEffect(() => {
    if (!isLoading && customer && !customer.mustChangePassword) {
      router.replace('/dashboard');
    }
  }, [customer, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await customerAuthApi.changePassword(currentPassword, newPassword);
      updateCustomer({ mustChangePassword: false });
      toast.success('Password set! Welcome to TechMo.');
      router.replace('/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.message ?? 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !customer) {
    return (
      <AuthShell>
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <KeyRound className="w-7 h-7 text-amber-400" />
        </div>
        <h1 className="text-xl font-bold text-white">Set Your Password</h1>
        <p className="text-sm text-slate-400 mt-1.5">
          Your account was created by TechMo staff. Please set a new password to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current (admin-given) password */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Current Password</label>
          <p className="text-xs text-slate-500 mb-1.5">This is the temporary password given to you by TechMo staff.</p>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="input pr-10"
              placeholder="Enter the password you received"
              autoFocus
              required
            />
            <button
              type="button"
              onClick={() => setShowCurrent(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              tabIndex={-1}
            >
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* New password */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="input pr-10"
              placeholder="Choose a strong password (min. 6 chars)"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowNew(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              tabIndex={-1}
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm New Password</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="input pr-10"
              placeholder="Repeat your new password"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {confirmPassword && newPassword && confirmPassword !== newPassword && (
            <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
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

      <p className="text-xs text-center text-slate-500 mt-5">
        Signed in as <span className="text-slate-300 font-medium">{customer.name}</span>
      </p>
    </AuthShell>
  );
}
