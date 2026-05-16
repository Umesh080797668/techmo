'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { systemApi, parseApiError } from '@/lib/api';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { Lock, LockOpen } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface SystemUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  active: boolean;
  locked: boolean;
  roles: string[];
  lastLoginAt: string | null;
  createdAt: string;
}

interface CreateUserForm {
  username: string;
  email: string;
  password: string;
  fullName: string;
  roleName: string;
}

const ROLES = ['MANAGER', 'CASHIER', 'TECHNICIAN', 'SUPER_ADMIN', 'HR_ADMIN'];

const roleBadge: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  MANAGER:     'bg-green-100 text-green-700',
  CASHIER:     'bg-yellow-100 text-yellow-700',
  TECHNICIAN:  'bg-orange-100 text-orange-700',
  HR_ADMIN:    'bg-blue-100 text-blue-700',
};

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function SystemPage() {
  const { user, isRole } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [lockdownReason, setLockdownReason] = useState('');
  const [resetPasswordUser, setResetPasswordUser] = useState<SystemUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Guard — this page is SUPER_ADMIN only
  if (!isRole('SUPER_ADMIN')) {
    router.replace('/dashboard');
    return null;
  }

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['system-users'],
    queryFn: () => systemApi.listUsers().then(r => r.data as SystemUser[]),
  });

  const { data: lockdownData } = useQuery({
    queryKey: ['lockdown-status'],
    queryFn: () => systemApi.lockdownStatus().then(r => r.data as { lockdown: boolean; reason: string | null }),
    refetchInterval: 15000,
  });

  // ─── Mutations ────────────────────────────────────────────────────────────
  const createUserMutation = useMutation({
    mutationFn: (data: CreateUserForm) => systemApi.createUser(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['system-users'] });
      toast.success('User created successfully');
      setShowCreate(false);
      reset();
    },
    onError: (err) => toast.error(parseApiError(err).message),
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ id, roleName }: { id: string; roleName: string }) =>
      systemApi.assignRole(id, roleName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['system-users'] });
      toast.success('Role updated');
      setSelectedUser(null);
    },
    onError: (err) => toast.error(parseApiError(err).message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? systemApi.deactivateUser(id) : systemApi.activateUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['system-users'] });
      toast.success('User status updated');
    },
    onError: (err) => toast.error(parseApiError(err).message),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      systemApi.resetPassword(id, newPassword),
    onSuccess: () => {
      toast.success('Password reset successfully');
      setResetPasswordUser(null);
      setNewPassword('');
    },
    onError: (err) => toast.error(parseApiError(err).message),
  });

  const lockdownMutation = useMutation({
    mutationFn: (activate: boolean) =>
      activate
        ? systemApi.activateLockdown(lockdownReason || undefined)
        : systemApi.deactivateLockdown(),
    onSuccess: (_, activate) => {
      qc.invalidateQueries({ queryKey: ['lockdown-status'] });
      toast.success(activate ? 'System locked down' : 'Lockdown lifted');
      setLockdownReason('');
    },
    onError: (err) => toast.error(parseApiError(err).message),
  });

  // ─── Create user form ─────────────────────────────────────────────────────
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateUserForm>();

  const users = usersData ?? [];
  const isLocked = lockdownData?.lockdown ?? false;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">System Management</h1>
          <p className="page-subtitle">SUPER_ADMIN only — manage users, roles, and system state.</p>
        </div>
      </div>

      {/* ── Lockdown Panel ─────────────────────────────────────────────────── */}
      <div className={`card p-6 border-2 ${isLocked ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              {isLocked ? <Lock className="w-5 h-5 text-red-500" /> : <LockOpen className="w-5 h-5 text-green-500" />}
              {isLocked ? 'System Locked Down' : 'System Operational'}
            </h2>
            {isLocked && lockdownData?.reason && (
              <p className="text-sm text-red-600 mt-1">Reason: {lockdownData.reason}</p>
            )}
          </div>
          <span className={`self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold ${isLocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {isLocked ? 'READ-ONLY' : 'NORMAL'}
          </span>
        </div>
        {!isLocked && (
          <input
            type="text"
            className="input mb-3 text-sm"
            placeholder="Lockdown reason (optional)"
            value={lockdownReason}
            onChange={e => setLockdownReason(e.target.value)}
          />
        )}
        <button
          onClick={() => lockdownMutation.mutate(!isLocked)}
          disabled={lockdownMutation.isPending}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 select-none cursor-pointer disabled:opacity-50 ${
            isLocked
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {lockdownMutation.isPending
            ? 'Processing…'
            : isLocked
            ? 'Lift Lockdown'
            : 'Activate Lockdown'}
        </button>
      </div>

      {/* ── Users Panel ──────────────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-800">
            Staff Accounts <span className="text-slate-400 text-base font-normal">({users.length})</span>
          </h2>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary text-sm px-4 py-2"
          >
            + New User
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-slate-400">Loading users…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                  <th className="text-left py-2 pr-4 font-medium">User</th>
                  <th className="text-left py-2 pr-4 font-medium">Role</th>
                  <th className="text-left py-2 pr-4 font-medium">Status</th>
                  <th className="text-left py-2 pr-4 font-medium">Last Login</th>
                  <th className="text-right py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const isSelf = u.username === user?.username;
                  const isSuperAdmin = u.roles.includes('SUPER_ADMIN');
                  return (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-800">{u.fullName}</p>
                        <p className="text-xs text-slate-400">@{u.username} · {u.email}</p>
                      </td>
                      <td className="py-3 pr-4">
                        {u.roles.map(r => (
                          <span
                            key={r}
                            className={`inline-block px-2 py-0.5 rounded text-xs font-semibold mr-1 ${roleBadge[r] ?? 'bg-slate-100 text-slate-600'}`}
                          >
                            {r}
                          </span>
                        ))}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs font-medium ${u.active ? 'text-green-600' : 'text-red-500'}`}>
                          {u.active ? 'Active' : 'Inactive'}
                        </span>
                        {u.locked && <span className="ml-2 text-xs text-orange-500">Locked</span>}
                      </td>
                      <td className="py-3 pr-4 text-slate-500 text-xs">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isSuperAdmin && !isSelf && (
                            <>
                              <button
                                onClick={() => setSelectedUser(u)}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Role
                              </button>
                              <button
                                onClick={() => toggleActiveMutation.mutate({ id: u.id, active: u.active })}
                                disabled={toggleActiveMutation.isPending}
                                className={`text-xs hover:underline ${u.active ? 'text-red-500' : 'text-green-600'}`}
                              >
                                {u.active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => setResetPasswordUser(u)}
                                className="text-xs text-orange-500 hover:underline"
                              >
                                Reset Pwd
                              </button>
                            </>
                          )}
                          {isSelf && (
                            <span className="text-xs text-slate-400 italic">You</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create User Modal ─────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="modal-title mb-4">Create New User</h3>
            <form
              onSubmit={handleSubmit(data => createUserMutation.mutate(data))}
              className="space-y-4"
            >
              <div>
                <label className="label">Full Name</label>
                <input className="input" {...register('fullName', { required: 'Required' })} />
                {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName.message}</p>}
              </div>
              <div>
                <label className="label">Username</label>
                <input className="input" {...register('username', { required: 'Required' })} />
                {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username.message}</p>}
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" {...register('email', { required: 'Required' })} />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  className="input"
                  {...register('password', { required: 'Required', minLength: { value: 8, message: 'Min 8 chars' } })}
                />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" {...register('roleName', { required: 'Required' })}>
                  <option value="">Select role…</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {errors.roleName && <p className="text-xs text-red-500 mt-1">{errors.roleName.message}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createUserMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createUserMutation.isPending ? 'Creating…' : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); reset(); }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Change Role Modal ─────────────────────────────────────────────────── */}
      {selectedUser && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="modal-title mb-1">Change Role</h3>
            <p className="text-sm text-slate-500 mb-4">@{selectedUser.username}</p>
            <div className="space-y-2">
              {ROLES.map(r => (
                <button
                  key={r}
                  onClick={() => assignRoleMutation.mutate({ id: selectedUser.id, roleName: r })}
                  disabled={assignRoleMutation.isPending || selectedUser.roles.includes(r)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    selectedUser.roles.includes(r)
                      ? 'border-blue-300 bg-blue-50 text-blue-700 cursor-default'
                      : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700'
                  }`}
                >
                  {r} {selectedUser.roles.includes(r) && '✓'}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="btn-secondary w-full mt-4 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ──────────────────────────────────────────────── */}
      {resetPasswordUser && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="modal-title mb-1">Reset Password</h3>
            <p className="text-sm text-slate-500 mb-4">@{resetPasswordUser.username}</p>
            <input
              type="password"
              className="input mb-4"
              placeholder="New password (min 8 chars)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                onClick={() => resetPasswordMutation.mutate({ id: resetPasswordUser.id, newPassword })}
                disabled={resetPasswordMutation.isPending || newPassword.length < 8}
                className="btn-primary flex-1 text-sm"
              >
                {resetPasswordMutation.isPending ? 'Resetting…' : 'Reset'}
              </button>
              <button
                onClick={() => { setResetPasswordUser(null); setNewPassword(''); }}
                className="btn-secondary flex-1 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
