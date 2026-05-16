'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeesApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Settings2 } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'badge-gray',
  APPROVED: 'badge-blue',
  PAID: 'badge-green',
};

type EditModal = { id: string; name: string; commission: string; deductions: string } | null;

export default function PayrollPage() {
  const qc = useQueryClient();

  const now = new Date();
  const [month, setMonth] = useState(format(now, 'yyyy-MM'));
  const [calcModal, setCalcModal] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [editModal, setEditModal] = useState<EditModal>(null);

  const from = format(startOfMonth(new Date(month + '-01')), 'yyyy-MM-dd');
  const to = format(endOfMonth(new Date(month + '-01')), 'yyyy-MM-dd');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['payroll', month],
    queryFn: () => employeesApi.listPayroll({ month }).then(r => r.data),
  });

  const payrolls: any[] = data?.data ?? data ?? [];

  const approveMutation = useMutation({
    mutationFn: (id: string) => employeesApi.approvePayroll(id),
    onSuccess: () => { toast.success('Payroll approved'); refetch(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Approve failed'),
  });

  const paidMutation = useMutation({
    mutationFn: (id: string) => employeesApi.markPaid(id),
    onSuccess: () => { toast.success('Marked as paid'); refetch(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Mark paid failed'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, commission, deductions }: { id: string; commission: number; deductions: number }) =>
      employeesApi.updatePayroll(id, { commissionEarned: commission, deductions }),
    onSuccess: () => { toast.success('Payroll adjusted'); setEditModal(null); refetch(); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Adjust failed'),
  });

  const handleCalculate = async () => {
    setCalcLoading(true);
    try {
      const [yearNum, monthNum] = month.split('-').map(Number);
      const empRes = await employeesApi.list({ limit: 100 });
      const employees = empRes.data?.data ?? empRes.data ?? [];
      for (const emp of employees) {
        await employeesApi.calculatePayroll({ employeeId: emp.id, year: yearNum, month: monthNum }).catch(() => {});
      }
      toast.success('Payroll calculated for all employees');
      refetch();
    } catch (e) {
      toast.error('Calculation failed for some employees');
    } finally {
      setCalcLoading(false);
      setCalcModal(false);
    }
  };

  const handleEditSave = () => {
    if (!editModal) return;
    const commission = parseFloat(editModal.commission);
    const deductions = parseFloat(editModal.deductions);
    if (isNaN(commission) || isNaN(deductions)) {
      toast.error('Enter valid numbers');
      return;
    }
    editMutation.mutate({ id: editModal.id, commission, deductions });
  };

  const totalGross = payrolls.reduce((s: number, p: any) => s + Number(p.baseSalary ?? 0) + Number(p.commissionEarned ?? 0), 0);
  const totalNet = payrolls.reduce((s: number, p: any) => s + Number(p.netPay ?? 0), 0);
  const totalDeductions = payrolls.reduce((s: number, p: any) => s + Number(p.deductions ?? 0), 0);

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payroll</h1>
          <p className="page-subtitle">{month}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input w-40 text-sm" />
          <button onClick={() => setCalcModal(true)} className="btn-secondary flex items-center gap-2"><Settings2 className="w-4 h-4" /> Calculate</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Gross Total', value: `LKR ${totalGross.toLocaleString()}`, color: 'text-primary' },
          { label: 'Total Deductions', value: `LKR ${totalDeductions.toLocaleString()}`, color: 'text-red-600' },
          { label: 'Net Payout', value: `LKR ${totalNet.toLocaleString()}`, color: 'text-green-600' },
        ].map(c => (
          <div key={c.label} className="card p-5">
            <p className="text-xs text-slate-500 mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="table-card">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr>
              {['Employee', 'Period', 'Base', 'Allowance', 'Commission', 'Deductions', 'Net', 'Status', ''].map(h => (
                <th key={h} className="table-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={9} className="table-td text-center py-10 text-slate-400">Loading…</td></tr>
            )}
            {!isLoading && payrolls.length === 0 && (
              <tr>
                <td colSpan={9} className="table-td text-center py-10">
                  <div className="text-slate-400">
                    <p>No payroll records for {month}</p>
                    <p className="text-xs mt-1">Click "Calculate" to generate payroll for this period</p>
                  </div>
                </td>
              </tr>
            )}
            {payrolls.map((p: any) => (
              <tr key={p.id} className="table-tr">
                <td className="table-td">
                  <div className="font-medium">{p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : '—'}</div>
                  <div className="text-xs text-slate-400">{p.employee?.position}</div>
                </td>
                <td className="table-td text-xs text-slate-400">
                  {p.month && p.year
                    ? `${String(p.month).padStart(2,'0')}/${p.year}`
                    : '—'}
                </td>
                <td className="table-td">LKR {Number(p.baseSalary ?? 0).toLocaleString()}</td>
                <td className="table-td text-slate-500">
                  {Number(p.allowance ?? 0) > 0 ? `+LKR ${Number(p.allowance).toLocaleString()}` : '—'}
                </td>
                <td className="table-td text-green-600">
                  {Number(p.commissionEarned ?? 0) > 0 ? `+LKR ${Number(p.commissionEarned).toLocaleString()}` : '—'}
                </td>
                <td className="table-td text-red-500">
                  {Number(p.deductions ?? 0) > 0 ? `-LKR ${Number(p.deductions).toLocaleString()}` : '—'}
                </td>
                <td className="table-td font-bold">LKR {Number(p.netPay ?? 0).toLocaleString()}</td>
                <td className="table-td">
                  <span className={`badge ${STATUS_COLORS[p.status] ?? 'badge-gray'}`}>{p.status}</span>
                </td>
                <td className="table-td">
                  <div className="flex gap-2 items-center">
                    {p.status === 'DRAFT' && (
                      <>
                        <button
                          onClick={() => setEditModal({
                            id: p.id,
                            name: p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : p.id,
                            commission: String(Number(p.commissionEarned ?? 0)),
                            deductions: String(Number(p.deductions ?? 0)),
                          })}
                          className="text-xs text-amber-600 hover:underline">Edit</button>
                        <button onClick={() => approveMutation.mutate(p.id)}
                          disabled={approveMutation.isPending}
                          className="text-xs text-primary hover:underline">Approve</button>
                      </>
                    )}
                    {p.status === 'APPROVED' && (
                      <button onClick={() => paidMutation.mutate(p.id)}
                        disabled={paidMutation.isPending}
                        className="text-xs text-green-600 hover:underline">Mark Paid</button>
                    )}
                    {p.status === 'PAID' && (
                      <span className="text-xs text-slate-400">✓ Paid</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>

      {/* Edit Commission / Deductions Modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-panel max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title mb-1">Adjust Payroll</h3>
            <p className="text-sm text-slate-500 mb-4">{editModal.name}</p>

            <div className="space-y-4">
              <div>
                <label className="label">Commission Earned (LKR)</label>
                <p className="text-xs text-slate-400 mb-1">Auto-calculated from sales; override manually if needed</p>
                <input
                  type="number"
                  min="0"
                  value={editModal.commission}
                  onChange={e => setEditModal(m => m ? { ...m, commission: e.target.value } : m)}
                  className="input w-full"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="label">Deductions (LKR)</label>
                <p className="text-xs text-slate-400 mb-1">EPF, ETF, salary advance, loan recovery, etc.</p>
                <input
                  type="number"
                  min="0"
                  value={editModal.deductions}
                  onChange={e => setEditModal(m => m ? { ...m, deductions: e.target.value } : m)}
                  className="input w-full"
                  placeholder="0"
                />
              </div>

              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <p className="text-slate-500 text-xs mb-1">Preview Net Pay</p>
                <p className="font-bold text-slate-800">
                  LKR {(
                    payrolls.find(p => p.id === editModal.id)
                      ? Number(payrolls.find(p => p.id === editModal.id)!.baseSalary) +
                        Number(payrolls.find(p => p.id === editModal.id)!.allowance) +
                        (parseFloat(editModal.commission) || 0) -
                        (parseFloat(editModal.deductions) || 0)
                      : 0
                  ).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={handleEditSave} disabled={editMutation.isPending} className="btn-primary flex-1">
                {editMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setEditModal(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Calculate Confirm Modal */}
      {calcModal && (
        <div className="modal-overlay" onClick={() => setCalcModal(false)}>
          <div className="modal-panel max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title mb-2">Calculate Payroll</h3>
            <p className="text-sm text-slate-500 mb-1">Period: <strong>{from} to {to}</strong></p>
            <p className="text-sm text-slate-500 mb-5">This will generate/update payroll records for all active employees. Existing DRAFT records will be overwritten.</p>
            <div className="flex gap-3">
              <button onClick={handleCalculate} disabled={calcLoading} className="btn-primary flex-1">
                {calcLoading ? 'Calculating…' : 'Calculate All'}
              </button>
              <button onClick={() => setCalcModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
