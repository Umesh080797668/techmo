'use client';

/**
 * CourierTracking — Admin UI component
 * =====================================
 * Displays live shipping status for a repair ticket's outbound courier
 * (e.g. parts ordered from supplier, device sent for warranty repair).
 *
 * Usage:
 *   <CourierTracking
 *     ticketRef="TKT-0042"
 *     trackingNumber="1234567890"
 *     carrier="dhl"
 *   />
 *
 * The component fetches from /api/v1/repairs/{ticketRef}/courier-tracking
 * which calls the backend CourierTrackingService (cached 30 min).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Package, Clock, Truck, CheckCircle2, AlertTriangle, RefreshCw, ExternalLink, type LucideIcon } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrackingEvent {
  timestamp:   string;
  location:    string;
  description: string;
  status?:     string;
}

interface TrackingData {
  trackingNumber:     string;
  carrier:            string;
  status:             'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'EXCEPTION';
  estimatedDelivery?: string;
  events:             TrackingEvent[];
  lastUpdated:        string;
}

interface CourierTrackingProps {
  ticketRef:      string;
  trackingNumber: string;
  carrier:        string;
  className?:     string;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: LucideIcon; label: string }> = {
  PENDING:    { color: 'text-zinc-400',   bg: 'bg-zinc-800',      border: 'border-zinc-700',  icon: Clock,         label: 'Pending'    },
  IN_TRANSIT: { color: 'text-blue-400',   bg: 'bg-blue-900/30',   border: 'border-blue-800',  icon: Truck,         label: 'In Transit' },
  DELIVERED:  { color: 'text-green-400',  bg: 'bg-green-900/30',  border: 'border-green-800', icon: CheckCircle2,  label: 'Delivered'  },
  EXCEPTION:  { color: 'text-red-400',    bg: 'bg-red-900/30',    border: 'border-red-800',   icon: AlertTriangle, label: 'Exception'  },
};

const CARRIER_LABELS: Record<string, string> = {
  dhl:     'DHL Express',
  fedex:   'FedEx',
  '17track':'17TRACK',
  slpost:  'Sri Lanka Post',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CourierTracking({
  ticketRef,
  trackingNumber,
  carrier,
  className = '',
}: CourierTrackingProps) {
  const [data, setData]         = useState<TrackingData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchTracking = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const res = await fetch(
        `/api/gateway/v1/repairs/${ticketRef}/courier-tracking?trackingNumber=${trackingNumber}&carrier=${carrier}`,
      );
      // 404 = ticket not found, 400 = no tracking number saved yet → friendly empty state
      if (res.status === 404 || res.status === 400) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `Server error (${res.status})`);
      }
      setData(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [ticketRef, trackingNumber, carrier]);

  useEffect(() => { fetchTracking(); }, [fetchTracking]);

  // ── Render ────────────────────────────────────────────────────────────────

  const cfg = data ? (STATUS_CONFIG[data.status] ?? STATUS_CONFIG.PENDING) : STATUS_CONFIG.PENDING;

  return (
    <div className={`rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-800/50">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-zinc-400" />
          <div>
            <p className="text-sm font-medium text-white">
              {CARRIER_LABELS[carrier] ?? carrier.toUpperCase()} Tracking
            </p>
            <p className="text-xs text-zinc-500 font-mono">{trackingNumber}</p>
          </div>
        </div>
        <button
          onClick={fetchTracking}
          disabled={loading}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-700"
          title="Refresh"
        >
          {loading
            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            : <><RefreshCw className="w-3.5 h-3.5 inline-block mr-1" />Refresh</>}
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Status badge */}
        {data && (
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${cfg.bg} ${cfg.border}`}>
            <cfg.icon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
            <div className="flex-1">
              <p className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</p>
              {data.estimatedDelivery && (
                <p className="text-xs text-zinc-500">
                  Est. delivery: {new Date(data.estimatedDelivery).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                </p>
              )}
            </div>
            {data.lastUpdated && (
              <p className="text-xs text-zinc-600">
                Updated {new Date(data.lastUpdated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}

        {/* Not-found / no tracking info yet */}
        {notFound && !loading && (
          <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
              <Package className="w-5 h-5 text-zinc-500" />
            </div>
            <p className="text-sm font-medium text-zinc-300">No tracking information yet</p>
            <p className="text-xs text-zinc-500 max-w-[220px]">
              Save a tracking number above and click <span className="text-zinc-400 font-medium">Refresh</span> to pull live carrier updates.
            </p>
          </div>
        )}

        {/* Error state (real server/network failures only) */}
        {error && !loading && (
          <div className="flex items-start gap-2.5 rounded-lg bg-red-900/20 border border-red-800/60 px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-300">Could not load tracking</p>
              <p className="text-xs text-red-400/80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-zinc-800 rounded w-3/4" />
            <div className="h-4 bg-zinc-800 rounded w-1/2" />
          </div>
        )}

        {/* Timeline */}
        {data && data.events.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {expanded ? '▲ Hide' : '▼ Show'} tracking history ({data.events.length} events)
            </button>

            {expanded && (
              <ul className="mt-3 space-y-0 relative">
                {/* Vertical line */}
                <div className="absolute left-2 top-2 bottom-2 w-px bg-zinc-800" />

                {data.events.map((ev, i) => (
                  <li key={i} className="flex gap-3 pb-4 relative">
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 z-10
                      ${i === 0
                        ? 'bg-indigo-600 border-indigo-400'
                        : 'bg-zinc-900 border-zinc-600'
                      }`}
                    />
                    <div>
                      <p className="text-sm text-white">{ev.description}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {ev.location && <span className="text-zinc-400">{ev.location} · </span>}
                        {new Date(ev.timestamp).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* No events yet (carrier returned data but timeline is empty) */}
        {data && data.events.length === 0 && (
          <p className="text-xs text-zinc-500 text-center py-2">
            No tracking events recorded yet — check back shortly.
          </p>
        )}

        {/* External link */}
        {carrier === 'dhl' && (
          <a
            href={`https://www.dhl.com/lk-en/home/tracking/tracking-freight.html?submit=1&tracking-id=${trackingNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> View on DHL website
          </a>
        )}
        {carrier === 'slpost' && (
          <a
            href={`https://www.slpost.lk/tracking/?tn=${trackingNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> Track on SL Post website
          </a>
        )}
      </div>
    </div>
  );
}
