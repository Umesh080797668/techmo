'use client';
import { useQuery } from '@tanstack/react-query';
import { loyaltyApi } from '@/lib/api';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { format } from 'date-fns';
import { Star, TrendingUp, ArrowUpRight, ArrowDownLeft, Gift } from 'lucide-react';
import clsx from 'clsx';

const POINT_VALUES = [
  { pts: 500,  lkr: 50 },
  { pts: 1000, lkr: 100 },
  { pts: 2500, lkr: 275 },
  { pts: 5000, lkr: 600 },
];

const TX_TYPE_COLOR: Record<string, string> = {
  EARN: 'text-emerald-400',
  REDEEM: 'text-red-400',
  BONUS: 'text-amber-400',
  EXPIRE: 'text-slate-500',
  ADJUST: 'text-blue-400',
};

export default function PointsPage() {
  const { customer } = useCustomerAuth();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['loyalty-summary'],
    queryFn: () => loyaltyApi.summary().then(r => r.data),
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['loyalty-transactions'],
    queryFn: () => loyaltyApi.transactions({ limit: 50 }).then(r => r.data),
  });

  const points = summary?.totalPoints ?? customer?.loyaltyPoints ?? 0;
  const tier = summary?.tier ?? customer?.tier ?? 'STANDARD';
  const PREMIUM_THRESHOLD = 5000;
  const progress = tier === 'PREMIUM' ? 100 : Math.min(100, (points / PREMIUM_THRESHOLD) * 100);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-white">Loyalty Points</h1>
          <p className="text-sm text-slate-400 mt-1">Track your points, tier status and redemption history.</p>
        </div>
      </div>

      {/* Balance + tier cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card bg-gradient-to-br from-primary/20 to-primary/5 border-primary/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Star className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm font-medium text-slate-300">Current Balance</p>
          </div>
          <p className="text-4xl font-bold text-white">{points.toLocaleString()}</p>
          <p className="text-sm text-slate-400 mt-1">loyalty points</p>
        </div>

        <div className={clsx(
          'card',
          tier === 'PREMIUM'
            ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/30'
            : 'bg-gradient-to-br from-slate-700/40 to-slate-700/10'
        )}>
          <div className="flex items-center gap-3 mb-4">
            <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center',
              tier === 'PREMIUM' ? 'bg-amber-500/20' : 'bg-slate-700/60'
            )}>
              <TrendingUp className={clsx('w-5 h-5', tier === 'PREMIUM' ? 'text-amber-400' : 'text-slate-400')} />
            </div>
            <p className="text-sm font-medium text-slate-300">Membership Tier</p>
          </div>
          <p className={clsx('text-3xl font-bold', tier === 'PREMIUM' ? 'text-amber-400' : 'text-white')}>
            {tier}
          </p>
          {tier === 'STANDARD' && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{points.toLocaleString()} pts</span>
                <span>{PREMIUM_THRESHOLD.toLocaleString()} pts</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-gradient-to-r from-primary to-amber-400"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {(PREMIUM_THRESHOLD - points).toLocaleString()} more pts to Premium
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Point value table */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-white">Points Value Guide</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-th text-left">Points</th>
                <th className="table-th text-right">LKR Value</th>
                <th className="table-th text-right">You have</th>
              </tr>
            </thead>
            <tbody>
              {POINT_VALUES.map(({ pts, lkr }) => (
                <tr key={pts} className={clsx(
                  'border-b border-slate-700/30 last:border-0',
                  points >= pts ? 'text-white' : 'text-slate-500'
                )}>
                  <td className="table-td font-medium">{pts.toLocaleString()} pts</td>
                  <td className="table-td text-right">LKR {lkr.toLocaleString()}</td>
                  <td className="table-td text-right">
                    {points >= pts ? (
                      <span className="badge badge-success">Available</span>
                    ) : (
                      <span className="badge badge-danger">Need {(pts - points).toLocaleString()} more</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Points can be redeemed in-store. Premium members earn 1.5× points on every purchase.
        </p>
      </div>

      {/* Transaction history */}
      <div className="card">
        <h2 className="text-sm font-semibold text-white mb-4">Transaction History</h2>
        {txLoading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : (txData?.items ?? []).length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Star className="w-8 h-8 opacity-20 mx-auto mb-2" />
            <p className="text-sm">No transactions yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {(txData?.items ?? []).map((tx: any) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 py-3 border-b border-slate-700/30 last:border-0"
              >
                <div className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  tx.type === 'EARN' || tx.type === 'BONUS'
                    ? 'bg-emerald-500/15'
                    : 'bg-red-500/15'
                )}>
                  {tx.type === 'EARN' || tx.type === 'BONUS'
                    ? <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    : <ArrowDownLeft className="w-4 h-4 text-red-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{tx.description ?? tx.type}</p>
                  <p className="text-xs text-slate-500">
                    {tx.createdAt ? format(new Date(tx.createdAt), 'dd MMM yyyy, h:mm a') : '—'}
                  </p>
                </div>
                <span className={clsx('text-sm font-semibold', TX_TYPE_COLOR[tx.type] ?? 'text-white')}>
                  {tx.type === 'EARN' || tx.type === 'BONUS' ? '+' : '−'}{Math.abs(tx.points).toLocaleString()} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
