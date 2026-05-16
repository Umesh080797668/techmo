'use client';
import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '@/lib/api';
import { format } from 'date-fns';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ArrowLeft, User, Phone, Mail, Briefcase, DollarSign, Clock, Calendar, Edit2,
} from 'lucide-react';
import clsx from 'clsx';

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'badge-red', MANAGER: 'badge-blue', CASHIER: 'badge-green', TECHNICIAN: 'badge-amber',
};

const ATT_STATUS_COLOR: Record<string, string> = {
  PRESENT: 'badge-success', ABSENT: 'badge-danger', LATE: 'badge-warning', HALF_DAY: 'badge-info',
};

const empName = (e: any) => `${e?.firstName ?? ''} ${e?.lastName ?? ''}`.trim() || e?.email || '—';

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'attendance' | 'shifts' | 'payroll'>('attendance');
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesApi.get(id).then(r => r.data),
  });

  const { data: attData } = useQuery({
    queryKey: ['employee-att', id],
    queryFn: () => employeesApi.attendance(id).then(r => r.data),
    enabled: activeTab === 'attendance',
  });

  const { data: shiftsData } = useQuery({
    queryKey: ['employee-shifts', id],
    queryFn: () => employeesApi.shifts(id).then(r => r.data),
    enabled: activeTab === 'shifts',
  });

  const { data: payrollData } = useQuery({
    queryKey: ['employee-payroll', id],
    queryFn: () => employeesApi.listPayroll({ employeeId: id, limit: 12 }).then(r => r.data),
    enabled: activeTab === 'payroll',
  });

  const updateMutation = useMutation({
    mutationFn: () => employeesApi.update(id, editForm),
    onSuccess: () => {
      toast.success('Employee updated');
      qc.invalidateQueries({ queryKey: ['employee', id] });
      setEditModal(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  });

  const clockInMutation = useMutation({
    mutationFn: () => employeesApi.clockIn(id),
    onSuccess: () => { toast.success('Clocked in'); qc.invalidateQueries({ queryKey: ['employee-att', id] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Clock-in failed'),
  });

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="skeleton h-8 w-64 rounded" />
      <div className="skeleton h-40 rounded-2xl" />
      <div className="skeleton h-64 rounded-2xl" />
    </div>
  );

  if (!employee) return (
    <div className="text-center py-20 text-slate-500">
      <p>Employee not found</p>
      <Link href="/employees" className="text-indigo-500 text-sm hover:underline mt-2 block">← Back</Link>
    </div>
  );

  const attendance = attData?.items ?? attData?.data ?? attData ?? [];
  const shifts = shiftsData?.items ?? shiftsData?.data ?? shiftsData ?? [];
  const payroll = payrollData?.items ?? payrollData?.data ?? payrollData ?? [];

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/employees" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Employees
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-600 font-medium">{empName(employee)}</span>
      </div>

      {/* Header card */}
      <div className="card flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-600 flex-shrink-0">
          {(employee.firstName ?? employee.email ?? '?').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="page-title">{empName(employee)}</h1>
            <span className={clsx('badge', ROLE_COLORS[employee.position] ?? 'badge-gray')}>{employee.position || '—'}</span>
            {employee.isActive === false && <span className="badge badge-danger">Inactive</span>}
          </div>
          <div className="flex flex-wrap gap-4 mt-1.5 text-sm text-slate-500">
            {employee.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{employee.email}</span>}
            {employee.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{employee.phone}</span>}
            {employee.department && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{employee.department}</span>}
          </div>
          {employee.baseSalary && (
            <div className="flex items-center gap-1.5 mt-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium text-slate-700">
                LKR {Number(employee.baseSalary).toLocaleString()} / month
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => {
            setEditForm({
              firstName: employee.firstName ?? '',
              lastName: employee.lastName ?? '',
              email: employee.email ?? '',
              phone: employee.phone ?? '',
              department: employee.department ?? '',
              baseSalary: employee.baseSalary ?? '',
              position: employee.position ?? '',
            });
            setEditModal(true);
          }}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
          <button onClick={() => clockInMutation.mutate()} className="btn-primary flex items-center gap-1.5 text-sm" disabled={clockInMutation.isPending}>
            <Clock className="w-3.5 h-3.5" /> Clock In
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex gap-1 border-b border-slate-200 mb-4">
          {([
            { key: 'attendance', label: 'Attendance', icon: Clock },
            { key: 'shifts',     label: 'Shifts',     icon: Calendar },
            { key: 'payroll',    label: 'Payroll',    icon: DollarSign },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={clsx('flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
                activeTab === key
                  ? 'text-indigo-600 border-b-2 border-indigo-600 -mb-px'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {/* Attendance */}
        {activeTab === 'attendance' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr>
                <th className="table-th text-left">Date</th>
                <th className="table-th text-left">Clock In</th>
                <th className="table-th text-left">Clock Out</th>
                <th className="table-th text-right">Hours</th>
                <th className="table-th">Status</th>
              </tr></thead>
              <tbody>
                {attendance.length === 0 && (
                  <tr><td colSpan={5} className="table-td text-center text-slate-400 py-8">No attendance records</td></tr>
                )}
                {attendance.map((att: any) => (
                  <tr key={att.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="table-td font-medium">{att.clockIn ? format(new Date(att.clockIn), 'dd MMM yyyy') : '—'}</td>
                    <td className="table-td text-slate-600">{att.clockIn ? format(new Date(att.clockIn), 'HH:mm') : '—'}</td>
                    <td className="table-td text-slate-600">{att.clockOut ? format(new Date(att.clockOut), 'HH:mm') : <span className="badge badge-amber text-xs">Active</span>}</td>
                    <td className="table-td text-right">{att.hoursWorked ? `${Number(att.hoursWorked).toFixed(1)}h` : '—'}</td>
                    <td className="table-td text-center">
                      <span className={clsx('badge', att.clockOut ? 'badge-green' : 'badge-amber')}>
                        {att.clockOut ? 'Done' : 'Working'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Shifts */}
        {activeTab === 'shifts' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr>
                <th className="table-th text-left">Date</th>
                <th className="table-th text-left">Type</th>
                <th className="table-th text-left">Start</th>
                <th className="table-th text-left">End</th>
                <th className="table-th">Notes</th>
              </tr></thead>
              <tbody>
                {shifts.length === 0 && (
                  <tr><td colSpan={5} className="table-td text-center text-slate-400 py-8">No shifts assigned</td></tr>
                )}
                {shifts.map((s: any) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="table-td">{s.shiftStart ? format(new Date(s.shiftStart), 'dd MMM yyyy') : '—'}</td>
                    <td className="table-td"><span className="badge badge-gray">{s.label ?? 'Shift'}</span></td>
                    <td className="table-td text-slate-600">{s.shiftStart ? format(new Date(s.shiftStart), 'HH:mm') : '—'}</td>
                    <td className="table-td text-slate-600">{s.shiftEnd ? format(new Date(s.shiftEnd), 'HH:mm') : '—'}</td>
                    <td className="table-td text-slate-500 text-xs">{s.label ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Payroll */}
        {activeTab === 'payroll' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr>
                <th className="table-th text-left">Period</th>
                <th className="table-th text-right">Base</th>
                <th className="table-th text-right">OT</th>
                <th className="table-th text-right">Deductions</th>
                <th className="table-th text-right">Net Pay</th>
                <th className="table-th">Status</th>
              </tr></thead>
              <tbody>
                {payroll.length === 0 && (
                  <tr><td colSpan={6} className="table-td text-center text-slate-400 py-8">No payroll records</td></tr>
                )}
                {payroll.map((p: any) => (
                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="table-td text-xs">
                      {p.periodFrom ? format(new Date(p.periodFrom), 'dd MMM') : '—'} – {p.periodTo ? format(new Date(p.periodTo), 'dd MMM yyyy') : '—'}
                    </td>
                    <td className="table-td text-right">LKR {(p.baseSalary ?? 0).toLocaleString()}</td>
                    <td className="table-td text-right text-emerald-600">+{(p.overtimePay ?? 0).toLocaleString()}</td>
                    <td className="table-td text-right text-red-500">−{(p.deductions ?? 0).toLocaleString()}</td>
                    <td className="table-td text-right font-semibold">LKR {(p.netPay ?? 0).toLocaleString()}</td>
                    <td className="table-td text-center"><span className="badge badge-success">{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editModal && (
        <div className="modal-overlay">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="modal-title mb-4">Edit Employee</h2>
            <div className="space-y-3">
              {[
                { field: 'firstName', label: 'First Name', type: 'text' },
                { field: 'lastName', label: 'Last Name', type: 'text' },
                { field: 'email', label: 'Email', type: 'email' },
                { field: 'phone', label: 'Phone', type: 'tel' },
                { field: 'department', label: 'Department', type: 'text' },
                { field: 'position', label: 'Position / Role', type: 'text' },
                { field: 'baseSalary', label: 'Base Salary (LKR)', type: 'number' },
              ].map(({ field, label, type }) => (
                <div key={field}>
                  <label className="label">{label}</label>
                  <input className="input" type={type} value={editForm[field] ?? ''} onChange={e => setEditForm({ ...editForm, [field]: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => updateMutation.mutate()} className="btn-primary flex-1" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setEditModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
