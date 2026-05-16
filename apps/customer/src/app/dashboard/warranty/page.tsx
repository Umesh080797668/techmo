'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { myWarrantyApi } from '@/lib/api';
import { format, isPast, differenceInDays } from 'date-fns';
import { Shield, Search, CheckCircle2, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

export default function WarrantyPage() {
  const [imei, setImei] = useState('');
  const [lookupImei, setLookupImei] = useState('');
  const [claimNote, setClaimNote] = useState('');
  const [claimType, setClaimType] = useState('PRODUCT');

  const { data: myWarranties, isLoading: myLoading } = useQuery({
    queryKey: ['my-warranties'],
    queryFn: () => myWarrantyApi.list().then(r => r.data),
  });

  const {
    data: lookupResult,
    isLoading: lookupLoading,
    refetch: doLookup,
    isError: lookupError,
  } = useQuery({
    queryKey: ['warranty-validate', lookupImei],
    queryFn: () => myWarrantyApi.validate(lookupImei).then(r => r.data),
    enabled: !!lookupImei,
    retry: false,
  });

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const val = imei.replace(/\s/g, '');
    if (val.length < 8) { toast.error('Enter a valid IMEI or serial number'); return; }
    setLookupImei(val);
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupImei || !claimNote.trim()) { toast.error('Please describe the issue'); return; }
    try {
      await myWarrantyApi.submitClaim({ imeiOrSerial: lookupImei, issueDescription: claimNote, claimType });
      toast.success('Warranty claim submitted. We\'ll contact you within 24 hours.');
      setClaimNote('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to submit claim');
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-white">Warranty</h1>
          <p className="text-sm text-slate-400 mt-1">Check warranty status by IMEI or serial number.</p>
        </div>
      </div>

      {/* IMEI Lookup */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-white">Check Warranty Status</h2>
        </div>
        <form onSubmit={handleLookup} className="flex gap-3">
          <input
            className="input flex-1"
            placeholder="Enter IMEI or serial number…"
            value={imei}
            onChange={e => setImei(e.target.value)}
          />
          <button type="submit" className="btn-primary" disabled={lookupLoading}>
            {lookupLoading ? <span className="loader" /> : 'Check'}
          </button>
        </form>

        {/* Result */}
        {lookupImei && !lookupLoading && (
          <div className="mt-4">
            {lookupError ? (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                <XCircle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">No warranty found</p>
                  <p className="text-xs mt-0.5">This IMEI/serial is not registered or is not under warranty.</p>
                </div>
              </div>
            ) : lookupResult && (
              <WarrantyResult warranty={lookupResult} />
            )}
          </div>
        )}
      </div>

      {/* Claim form (only if warranty is active) */}
      {lookupResult?.isValid && !lookupError && (
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">Submit a Warranty Claim</h2>
          <form onSubmit={handleClaim} className="space-y-4">
            <div>
              <label className="label">Claim Type</label>
              <select className="input" value={claimType} onChange={e => setClaimType(e.target.value)}>
                <option value="PRODUCT">Product Defect</option>
                <option value="REPAIR">Repair Warranty</option>
              </select>
            </div>
            <div>
              <label className="label">Describe the Issue</label>
              <textarea
                className="input min-h-[80px] resize-y"
                placeholder="Describe the problem you're experiencing…"
                value={claimNote}
                onChange={e => setClaimNote(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary">Submit Claim</button>
          </form>
        </div>
      )}

      {/* My registered warranties */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4">My Registered Warranties</h2>
        {myLoading ? (
          <div className="space-y-3">
            {[1,2].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}
          </div>
        ) : (myWarranties?.items ?? []).length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Shield className="w-8 h-8 opacity-20 mx-auto mb-2" />
            <p className="text-sm">No registered warranties yet.</p>
            <p className="text-xs mt-1">Warranties are registered when you purchase from TechMo.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(myWarranties?.items ?? []).map((w: any) => (
              <WarrantyResult key={w.id} warranty={w} compact />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WarrantyResult({ warranty, compact = false }: { warranty: any; compact?: boolean }) {
  const expiry = warranty.expiryDate ? new Date(warranty.expiryDate) : null;
  const expired = expiry ? isPast(expiry) : false;
  const daysLeft = expiry && !expired ? differenceInDays(expiry, new Date()) : 0;

  const statusColor = !expiry
    ? 'bg-slate-700/50 border-slate-600'
    : expired
    ? 'bg-red-500/10 border-red-500/30'
    : daysLeft <= 30
    ? 'bg-amber-500/10 border-amber-500/30'
    : 'bg-emerald-500/10 border-emerald-500/30';

  const Icon = expired ? XCircle : daysLeft <= 30 && !expired ? AlertTriangle : CheckCircle2;
  const iconColor = expired ? 'text-red-400' : daysLeft <= 30 && !expired ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className={clsx('flex items-start gap-3 p-4 rounded-xl border', statusColor)}>
      <Icon className={clsx('w-5 h-5 flex-shrink-0 mt-0.5', iconColor)} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <p className="text-sm font-semibold text-white">
            {warranty.productName ?? warranty.device ?? 'Device'}
          </p>
          {warranty.warrantyType && (
            <span className="badge badge-info">{warranty.warrantyType}</span>
          )}
        </div>
        {!compact && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-slate-400 mt-2">
            {warranty.imei && <span>IMEI: {warranty.imei}</span>}
            {warranty.startDate && (
              <span>From: {format(new Date(warranty.startDate), 'dd MMM yyyy')}</span>
            )}
            {expiry && (
              <span>Until: {format(expiry, 'dd MMM yyyy')}</span>
            )}
          </div>
        )}
        <p className={clsx('text-xs mt-1.5 font-medium', iconColor)}>
          {expired
            ? 'Warranty expired'
            : expiry
            ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`
            : 'No expiry date set'}
        </p>
      </div>
    </div>
  );
}
