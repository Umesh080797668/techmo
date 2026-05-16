'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi, shiftsApi, systemApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Clock, Users, CalendarDays, CheckCircle2, Copy, RefreshCw } from 'lucide-react';

// SUPER_ADMIN is intentionally excluded — that role can only be assigned from the System page
const ROLES = ['CASHIER', 'TECHNICIAN', 'MANAGER', 'HR_ADMIN'];
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'badge-red',
  MANAGER: 'badge-blue',
  CASHIER: 'badge-green',
  TECHNICIAN: 'badge-amber',
  HR_ADMIN: 'badge-indigo',
};

const empName = (e: any) => `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim() || e.email || '—';

const genPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#$!';
  const all = upper + lower + digits + special;
  const rand = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
  const base = [rand(upper), rand(lower), rand(digits), rand(special),
    ...Array.from({ length: 6 }, () => rand(all))];
  return base.sort(() => Math.random() - 0.5).join('');
};

export default function EmployeesPage() {
  const { user, isRole } = useAuth();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'employees' | 'shifts'>('employees');
  const [createModal, setCreateModal] = useState(false);
  const [clockModal, setClockModal] = useState(false);
  const [attModal, setAttModal] = useState<any | null>(null);
  const [shiftModal, setShiftModal] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    employeeId: '', date: '', startTime: '', endTime: '', label: '',
  });
  const [createForm, setCreateForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', position: 'CASHIER', baseSalary: '', department: '', password: genPassword(),
  });
  const [credModal, setCredModal] = useState<{ email: string; password: string } | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '', lastName: '', phone: '', position: 'CASHIER', baseSalary: '', department: '', password: '',
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; message: string; onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });
  const [createLoading, setCreateLoading] = useState(false);

  const openEdit = (e: any) => {
    setEditTarget(e);
    setEditForm({ firstName: e.firstName ?? '', lastName: e.lastName ?? '', phone: e.phone ?? '', position: e.position ?? 'CASHIER', baseSalary: String(e.baseSalary ?? ''), department: e.department ?? '', password: '' });
    setEditModal(true);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['employees', { search, page }],
    queryFn: () => employeesApi.list({ search: search || undefined, page, limit: 20 }).then(r => r.data),
  });

  const { data: attData } = useQuery({
    queryKey: ['attendance', attModal?.id],
    queryFn: () => employeesApi.attendance(attModal!.id).then(r => r.data),
    enabled: !!attModal,
  });

  const { data: shiftsData, isLoading: shiftsLoading } = useQuery({
    queryKey: ['shifts', activeTab],
    queryFn: () => shiftsApi.list({ limit: 100 }).then(r => r.data),
    enabled: activeTab === 'shifts',
  });

  const createShiftMut = useMutation({
    mutationFn: (data: any) => shiftsApi.create(data),
    onSuccess: () => {
      toast.success('Shift created');
      qc.invalidateQueries({ queryKey: ['shifts'] });
      setShiftModal(false);
      setShiftForm({ employeeId: '', date: '', startTime: '', endTime: '', label: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const deleteShiftMut = useMutation({
    mutationFn: (id: string) => shiftsApi.delete(id),
    onSuccess: () => { toast.success('Shift removed'); qc.invalidateQueries({ queryKey: ['shifts'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const employees: any[] = data?.data ?? data ?? [];
  const total: number = data?.total ?? employees.length;

  const createMutation = useMutation({
    mutationFn: async () => {
      // Step 1: create login account in auth service
      const authRes = await systemApi.createUser({
        username: createForm.email,
        email: createForm.email,
        password: createForm.password,
        fullName: `${createForm.firstName} ${createForm.lastName}`.trim(),
        roleName: createForm.position,
      });
      const userId: string = authRes.data?.id;
      // Step 2: create employee record linked to auth user
      return employeesApi.create({
        ...createForm,
        baseSalary: Number(createForm.baseSalary),
        userId,
      });
    },
    onSuccess: () => {
      setCredModal({ email: createForm.email, password: createForm.password });
      toast.success('Employee created — they can now log in with their email and password');
      qc.invalidateQueries({ queryKey: ['employees'] });
      setCreateModal(false);
      setCreateForm({ firstName: '', lastName: '', email: '', phone: '', position: 'CASHIER', baseSalary: '', department: '', password: genPassword() });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Create failed'),
  });

  const clockInMutation = useMutation({
    mutationFn: () => employeesApi.clockIn(user!.id),
    onSuccess: () => { toast.success('Clocked in successfully'); setClockModal(false); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const clockOutMutation = useMutation({
    mutationFn: () => employeesApi.clockOutByEmployee(user!.id),
    onSuccess: () => { toast.success('Clocked out successfully'); setClockModal(false); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const payload: any = { ...editForm, baseSalary: Number(editForm.baseSalary) };
      if (!payload.password) delete payload.password;
      return employeesApi.update(editTarget!.id, payload);
    },
    onSuccess: () => {
      toast.success('Employee updated');
      qc.invalidateQueries({ queryKey: ['employees'] });
      setEditModal(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => employeesApi.delete(id),
    onSuccess: () => {
      toast.success('Employee deleted');
      qc.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Delete failed'),
  });

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-subtitle">{total.toLocaleString()} team members</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name / email…" className="input w-full sm:w-52 text-sm" />
          <button onClick={() => setClockModal(true)} className="btn-secondary flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> Clock In / Out
          </button>
          {isRole('SUPER_ADMIN', 'MANAGER', 'HR_ADMIN') && (
            <>
              {activeTab === 'shifts' && (
                <button onClick={() => setShiftModal(true)} className="btn-secondary">+ Add Shift</button>
              )}
              <button onClick={() => setCreateModal(true)} className="btn-primary">+ Add Employee</button>
            </>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="seg-switcher">
        {(['employees', 'shifts'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? 'seg-btn-on' : 'seg-btn-off'}
          >
            {tab === 'employees' ? <><Users className="w-3.5 h-3.5" /> Employees</> : <><CalendarDays className="w-3.5 h-3.5" /> Shift Schedule</>}
          </button>
        ))}
      </div>
      {activeTab === 'employees' && (
      <div className="table-card">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr>
              {['Name', 'Email', 'Phone', 'Role', 'Dept', 'Base Salary', 'Status', ''].map(h => (
                <th key={h} className="table-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="table-td text-center py-10 text-slate-400">Loading…</td></tr>
            )}
            {!isLoading && employees.length === 0 && (
              <tr><td colSpan={8} className="table-td text-center py-10 text-slate-400">No employees found</td></tr>
            )}
            {employees.map((e: any) => (
              <tr key={e.id} className="table-tr">
                <td className="table-td">
                  <div className="font-medium">{empName(e)}</div>
                  {e.employeeCode && <div className="text-xs text-slate-400 font-mono">{e.employeeCode}</div>}
                </td>
                <td className="table-td text-slate-500">{e.email}</td>
                <td className="table-td font-mono">{e.phone ?? '—'}</td>
                <td className="table-td">
                  <span className={`badge ${ROLE_COLORS[e.position] ?? 'badge-gray'}`}>{e.position || '—'}</span>
                </td>
                <td className="table-td text-slate-500">{e.department ?? '—'}</td>
                <td className="table-td">LKR {Number(e.baseSalary ?? 0).toLocaleString()}</td>
                <td className="table-td">
                  <span className={`badge ${e.isActive ? 'badge-green' : 'badge-red'}`}>
                    {e.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="table-td">
                  <div className="flex gap-2">
                    <button onClick={() => setAttModal(e)} className="text-xs text-primary hover:underline">
                      Attendance
                    </button>
                    {isRole('SUPER_ADMIN', 'MANAGER', 'HR_ADMIN') && (
                      <>
                        <button onClick={() => openEdit(e)} className="text-xs text-blue-600 hover:underline">Edit</button>
                        <button
                          onClick={() => setConfirmDialog({
                            open: true,
                            title: 'Delete Employee',
                            message: `Delete ${empName(e)}? This cannot be undone.`,
                            onConfirm: () => { deleteMutation.mutate(e.id); setConfirmDialog(d => ({ ...d, open: false })); },
                          })}
                          className="text-xs text-red-500 hover:underline">Delete</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      )}

      {/* Shifts Tab */}
      {activeTab === 'shifts' && (
        <div className="table-card">
          {shiftsLoading ? (
            <div className="p-8 text-center text-slate-400">Loading shifts…</div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[580px] text-sm">
              <thead>
                <tr>
                  {['Employee', 'Label', 'Start', 'End', ''].map(h => (
                    <th key={h} className="table-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {((shiftsData?.data ?? shiftsData ?? []) as any[]).length === 0 && (
                  <tr><td colSpan={5} className="table-td text-center py-10 text-slate-400">No shifts scheduled</td></tr>
                )}
                {((shiftsData?.data ?? shiftsData ?? []) as any[]).map((s: any) => (
                  <tr key={s.id} className="table-tr">
                    <td className="table-td font-medium">
                      {s.employee ? empName(s.employee) : s.employeeId}
                    </td>
                    <td className="table-td">
                      <span className="badge badge-gray">{s.label ?? 'Shift'}</span>
                    </td>
                    <td className="table-td font-mono">
                      {s.shiftStart ? format(new Date(s.shiftStart), 'dd MMM HH:mm') : '—'}
                    </td>
                    <td className="table-td font-mono">
                      {s.shiftEnd ? format(new Date(s.shiftEnd), 'dd MMM HH:mm') : '—'}
                    </td>
                    <td className="table-td">
                      {isRole('SUPER_ADMIN', 'MANAGER', 'HR_ADMIN') && (
                        <button
                          onClick={() => setConfirmDialog({
                            open: true,
                            title: 'Remove Shift',
                            message: 'Are you sure you want to remove this shift?',
                            onConfirm: () => { deleteShiftMut.mutate(s.id); setConfirmDialog(d => ({ ...d, open: false })); },
                          })}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'employees' && total > 20 && (
        <div className="flex items-center justify-center gap-1.5">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="page-btn">← Prev</button>
          <span className="text-xs text-slate-400 tabular self-center px-1">Page {page}</span>
          <button disabled={employees.length < 20} onClick={() => setPage(p => p + 1)} className="page-btn">Next →</button>
        </div>
      )}

      {/* Shift Create Modal */}
      {shiftModal && (
        <div className="modal-overlay" onClick={() => setShiftModal(false)}>
          <div className="modal-panel max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900 mb-5">Schedule Shift</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Employee *</label>
                <select value={shiftForm.employeeId} onChange={e => setShiftForm(f => ({ ...f, employeeId: e.target.value }))} className="input">
                  <option value="">— Select Employee —</option>
                  {employees.map((e: any) => <option key={e.id} value={e.id}>{empName(e)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Shift Start *</label>
                <input type="datetime-local" value={shiftForm.startTime} onChange={e => setShiftForm(f => ({ ...f, startTime: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Shift End *</label>
                <input type="datetime-local" value={shiftForm.endTime} onChange={e => setShiftForm(f => ({ ...f, endTime: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Label</label>
                <input value={shiftForm.label} onChange={e => setShiftForm(f => ({ ...f, label: e.target.value }))} className="input" placeholder="Morning, Evening…" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => createShiftMut.mutate({
                  employeeId: shiftForm.employeeId,
                  shiftStart: shiftForm.startTime,
                  shiftEnd: shiftForm.endTime,
                  label: shiftForm.label || undefined,
                })}
                disabled={createShiftMut.isPending || !shiftForm.employeeId || !shiftForm.startTime || !shiftForm.endTime}
                className="btn-primary flex-1">
                {createShiftMut.isPending ? 'Saving…' : 'Create Shift'}
              </button>
              <button onClick={() => setShiftModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Clock Modal */}
      {clockModal && (
        <div className="modal-overlay" onClick={() => setClockModal(false)}>
          <div className="modal-panel max-w-xs p-6 text-center" onClick={e => e.stopPropagation()}>
            <Clock className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 mb-1">Attendance</h3>
            <p className="text-sm text-slate-500 mb-6">{user?.name ?? user?.username}</p>
            <div className="flex gap-3">
              <button onClick={() => clockInMutation.mutate()} disabled={clockInMutation.isPending}
                className="btn-primary flex-1">Clock In</button>
              <button onClick={() => clockOutMutation.mutate()} disabled={clockOutMutation.isPending}
                className="btn-secondary flex-1">Clock Out</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Employee Modal */}
      {createModal && (
        <div className="modal-overlay" onClick={() => setCreateModal(false)}>
          <div className="modal-panel max-w-lg overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900 mb-5">Add Employee</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">First Name *</label>
                <input value={createForm.firstName} onChange={e => setCreateForm(f => ({ ...f, firstName: e.target.value }))} className="input" placeholder="Kasun" />
              </div>
              <div>
                <label className="label">Last Name *</label>
                <input value={createForm.lastName} onChange={e => setCreateForm(f => ({ ...f, lastName: e.target.value }))} className="input" placeholder="Perera" />
              </div>
              <div>
                <label className="label">Email *</label>
                <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Phone *</label>
                <input value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Position / Role</label>
                <select value={createForm.position} onChange={e => setCreateForm(f => ({ ...f, position: e.target.value }))} className="input">
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Department</label>
                <input value={createForm.department} onChange={e => setCreateForm(f => ({ ...f, department: e.target.value }))} className="input" placeholder="Sales, Repairs…" />
              </div>
              <div className="col-span-2">
                <label className="label">Base Salary (LKR) *</label>
                <input type="number" value={createForm.baseSalary} onChange={e => setCreateForm(f => ({ ...f, baseSalary: e.target.value }))} className="input" />
              </div>
              <div className="col-span-2">
                <label className="label">Login Password <span className="text-slate-400 font-normal">(auto-generated)</span></label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={createForm.password}
                    readOnly
                    className="input flex-1 bg-slate-50 cursor-default font-mono tracking-wide select-all"
                  />
                  <button
                    type="button"
                    onClick={() => setCreateForm(f => ({ ...f, password: genPassword() }))}
                    className="btn-secondary px-3 text-xs whitespace-nowrap flex items-center gap-1.5"
                    title="Generate a new password">
                    <RefreshCw className="w-3 h-3" /> New
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Share this password with the employee — they can change it after first login.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !createForm.firstName || !createForm.email || !createForm.baseSalary || !createForm.phone}
                className="btn-primary flex-1">{createMutation.isPending ? 'Creating…' : 'Create Employee'}</button>
              <button onClick={() => setCreateModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editModal && editTarget && (
        <div className="modal-overlay" onClick={() => setEditModal(false)}>
          <div className="modal-panel max-w-lg overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900 mb-5">Edit Employee — {empName(editTarget)}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">First Name *</label>
                <input value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Last Name *</label>
                <input value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Phone *</label>
                <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Position / Role</label>
                <select value={editForm.position} onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))} className="input">
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Department</label>
                <input value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} className="input" placeholder="Sales, Repairs…" />
              </div>
              <div>
                <label className="label">Base Salary (LKR) *</label>
                <input type="number" value={editForm.baseSalary} onChange={e => setEditForm(f => ({ ...f, baseSalary: e.target.value }))} className="input" />
              </div>
              <div className="col-span-2">
                <label className="label">New Password <span className="text-slate-400 font-normal">(leave blank to keep unchanged)</span></label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                  className="input"
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                />
                {editForm.password && editForm.password.length < 8 && (
                  <p className="text-xs text-amber-500 mt-1">Must be at least 8 characters</p>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending || !editForm.firstName || !editForm.lastName || !editForm.phone || !editForm.baseSalary || (!!editForm.password && editForm.password.length < 8)}
                className="btn-primary flex-1">
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setEditModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance History Modal */}
      {attModal && (
        <div className="modal-overlay" onClick={() => setAttModal(null)}>
          <div className="modal-panel max-w-md p-6 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900 mb-1">Attendance</h3>
            <p className="text-sm text-slate-500 mb-4">{empName(attModal)}</p>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              {!attData && <p className="text-slate-400 text-sm py-4">Loading…</p>}
              {Array.isArray(attData) && attData.length === 0 && <p className="text-slate-400 text-sm py-4">No records found</p>}
              {(Array.isArray(attData) ? attData : []).map((a: any) => (
                <div key={a.id} className="flex justify-between items-center py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{a.clockIn ? format(new Date(a.clockIn), 'EEE dd MMM yyyy') : '—'}</p>
                    <p className="text-xs text-slate-400">
                      In: {a.clockIn ? format(new Date(a.clockIn), 'HH:mm') : '—'} → Out: {a.clockOut ? format(new Date(a.clockOut), 'HH:mm') : 'Active'}
                    </p>
                  </div>
                  <span className={`badge ${a.clockOut ? 'badge-green' : 'badge-amber'}`}>
                    {a.clockOut ? `${Number(a.hoursWorked ?? 0).toFixed(1)}h` : 'Working'}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={() => setAttModal(null)} className="btn-secondary mt-4">Close</button>
          </div>
        </div>
      )}
      {credModal && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-sm p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 mb-1">Employee Account Created</h3>
            <p className="text-sm text-slate-500 mb-5">Share these login credentials with the employee.</p>
            <div className="bg-slate-50 rounded-xl p-4 text-left space-y-3 mb-5">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Email (Username)</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-slate-800 flex-1 break-all">{credModal.email}</span>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(credModal!.email); toast.success('Copied'); }} className="text-xs text-primary hover:underline whitespace-nowrap">Copy</button>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Password</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-800 flex-1 tracking-wide">{credModal.password}</span>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(credModal!.password); toast.success('Copied'); }} className="text-xs text-primary hover:underline whitespace-nowrap">Copy</button>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => { navigator.clipboard.writeText(`Email: ${credModal.email}\nPassword: ${credModal.password}`); toast.success('Credentials copied!'); }} className="btn-primary w-full mb-2 flex items-center justify-center gap-1.5"><Copy className="w-4 h-4" /> Copy Both</button>
            <button type="button" onClick={() => setCredModal(null)} className="btn-secondary w-full">Done</button>
            <p className="text-xs text-slate-400 mt-4">Employee will be prompted to change their password on first login.</p>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        danger
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(d => ({ ...d, open: false }))}
      />
    </div>
  );
}
