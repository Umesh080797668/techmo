'use client';

/**
 * Kiosk Mode — Self-Service Customer Check-In
 * =============================================
 * A simplified, touch-optimised view designed for a tablet at the storefront.
 * Staff-facing menu is hidden; customers interact directly to:
 *   1. Check in a device for repair
 *   2. Check existing repair status by phone number or ticket ref
 *   3. Browse walk-in availability (optional)
 *
 * To enter kiosk mode: Admin → Settings → Kiosk Mode → "Launch on this device"
 * To exit: press the hidden triple-tap sequence on the TechMo logo (3 taps in 1 s)
 *          → prompts manager PIN
 *
 * Route: /kiosk  (no auth required — public-facing page, no staff data exposed)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Smartphone, Wrench, Search, CheckCircle2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Screen =
  | 'welcome'
  | 'checkin-phone'
  | 'checkin-device'
  | 'checkin-confirm'
  | 'checkin-done'
  | 'track-input'
  | 'track-result'
  | 'exit-pin';

interface RepairStatusResult {
  ticketRef: string;
  device: string;
  status: string;
  updatedAt: string;
  statusSteps: string[];
  currentStep: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REPAIR_STEPS = [
  'Pending Diagnosis',
  'Awaiting Parts',
  'Under Repair',
  'Ready for Pickup',
  'Completed',
];

// ─── Sub-screens ──────────────────────────────────────────────────────────────

function WelcomeScreen({ onCheckIn, onTrack }: { onCheckIn: () => void; onTrack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-10 px-8">
      <div className="text-center">
        <Smartphone className="w-16 h-16 text-white mx-auto mb-2" />
        <h1 className="text-4xl font-bold text-white tracking-tight">Welcome to TechMo</h1>
        <p className="mt-2 text-lg text-zinc-400">Your trusted electronics service centre</p>
      </div>

      <div className="grid grid-cols-2 gap-6 w-full max-w-lg">
        <button
          onClick={onCheckIn}
          className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-indigo-600 hover:bg-indigo-500
                     text-white transition-all active:scale-95 shadow-xl shadow-indigo-900/40"
        >
          <Wrench className="w-12 h-12" />
          <span className="text-xl font-semibold">Drop Off<br />for Repair</span>
        </button>

        <button
          onClick={onTrack}
          className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-zinc-800 hover:bg-zinc-700
                     text-white border border-zinc-600 transition-all active:scale-95"
        >
          <Search className="w-12 h-12" />
          <span className="text-xl font-semibold">Track My<br />Repair</span>
        </button>
      </div>

      <p className="text-zinc-600 text-sm">Tap a card to get started</p>
    </div>
  );
}

function NumPad({
  value,
  onChange,
  label,
  maxLength = 12,
  type = 'phone',
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  maxLength?: number;
  type?: 'phone' | 'pin' | 'text';
}) {
  const keys = ['1','2','3','4','5','6','7','8','9','⌫','0','✓'];
  const handleKey = (k: string) => {
    if (k === '⌫') { onChange(value.slice(0, -1)); return; }
    if (k === '✓') return;
    if (value.length < maxLength) onChange(value + k);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xs mx-auto">
      <p className="text-zinc-400 text-lg">{label}</p>
      <div className="w-full rounded-2xl bg-zinc-800 border border-zinc-600 px-6 py-4 text-center font-mono text-2xl text-white tracking-widest min-h-[56px]">
        {type === 'pin' ? '•'.repeat(value.length) : (value || <span className="text-zinc-600">—</span>)}
      </div>
      <div className="grid grid-cols-3 gap-3 w-full">
        {keys.map((k) => (
          <button
            key={k}
            onClick={() => handleKey(k)}
            className={`h-16 rounded-2xl text-xl font-semibold transition-all active:scale-95
              ${k === '✓' ? 'bg-indigo-600 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-white'}
              ${k === '⌫' ? 'text-red-400' : ''}
            `}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function KioskPage() {
  const router = useRouter();

  // Gateway base URL — all fetch calls must go through the API gateway, NOT relative URLs
  const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'http://localhost:3000';

  // Map DB repair status enum → REPAIR_STEPS index
  const STATUS_TO_STEP: Record<string, number> = {
    RECEIVED: 0, PENDING_DIAGNOSIS: 0,
    AWAITING_PARTS: 1,
    UNDER_REPAIR: 2,
    READY_FOR_PICKUP: 3,
    COMPLETED: 4,
  };

  const [screen, setScreen]     = useState<Screen>('welcome');
  const [phone, setPhone]       = useState('');
  const [device, setDevice]     = useState('');
  const [fault, setFault]       = useState('');
  const [trackInput, setTrackInput] = useState('');
  const [trackResult, setTrackResult] = useState<RepairStatusResult | null>(null);
  const [trackError, setTrackError]   = useState('');
  const [pin, setPin]           = useState('');
  const [pinError, setPinError] = useState('');
  const [ticketRef, setTicketRef] = useState('');
  const [loading, setLoading]   = useState(false);
  const [idleMs,   setIdleMs]   = useState(60_000);

  // ── Load kiosk config (idle timeout) from gateway on mount ───────────────
  useEffect(() => {
    fetch(`${GATEWAY}/api/v1/admin/kiosk/config`)
      .then(r => r.json())
      .then(d => { if (d?.idleSeconds > 0) setIdleMs(d.idleSeconds * 1000); })
      .catch(() => { /* keep default 60 s */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Triple-tap easter egg to exit kiosk ──────────────────────────────────
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleLogoTap = useCallback(() => {
    tapCount.current += 1;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 1000);
    if (tapCount.current >= 3) {
      tapCount.current = 0;
      setScreen('exit-pin');
    }
  }, []);

  // ── Track repair status ──────────────────────────────────────────────────
  const handleTrack = async () => {
    if (!trackInput.trim()) return;
    setLoading(true);
    setTrackError('');
    try {
      const res = await fetch(
        `${GATEWAY}/api/v1/repairs/public/track?ref=${encodeURIComponent(trackInput.trim())}`,
      );
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      // Backend returns { ticketNumber, deviceBrand, deviceModel, status, statusHistory }
      // Map to the shape the UI expects
      setTrackResult({
        ticketRef: data.ticketNumber ?? trackInput.trim(),
        device: [data.deviceBrand, data.deviceModel].filter(Boolean).join(' ') || 'Unknown Device',
        status: data.status ?? '',
        updatedAt: data.statusHistory?.at(-1)?.createdAt ?? '',
        statusSteps: REPAIR_STEPS,
        currentStep: STATUS_TO_STEP[data.status] ?? 0,
      });
      setScreen('track-result');
    } catch {
      setTrackError('No repair found for that reference or phone number.');
    } finally {
      setLoading(false);
    }
  };

  // ── Submit check-in ──────────────────────────────────────────────────────
  const handleCheckInSubmit = async () => {
    if (!phone || !device || !fault) return;
    setLoading(true);
    try {
      const res = await fetch(`${GATEWAY}/api/v1/repairs/kiosk-checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, device, fault }),
      });
      const data = await res.json();
      setTicketRef(data.ticketRef ?? 'TK-???');
      setScreen('checkin-done');
    } catch {
      // Still show done screen — staff can create ticket manually
      setTicketRef('—');
      setScreen('checkin-done');
    } finally {
      setLoading(false);
    }
  };

  // ── Verify exit PIN ──────────────────────────────────────────────────────
  const handlePinSubmit = async () => {
    try {
      const res = await fetch(`${GATEWAY}/api/v1/admin/kiosk/validate-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.valid) {
          router.push('/dashboard');
        } else {
          setPinError('Incorrect PIN. Try again.');
          setPin('');
        }
      } else {
        setPinError('Incorrect PIN. Try again.');
        setPin('');
      }
    } catch {
      setPinError('Could not verify PIN — check network.');
    }
  };

  // Auto-reset to welcome after configured idle period
  useEffect(() => {
    const timer = setTimeout(() => {
      if (screen !== 'welcome') {
        setScreen('welcome');
        setPhone(''); setDevice(''); setFault('');
        setTrackInput(''); setTrackResult(null); setTrackError('');
        setPin(''); setPinError('');
      }
    }, idleMs);
    return () => clearTimeout(timer);
  }, [screen, phone, device, fault, trackInput, pin, idleMs]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-zinc-950 text-white flex flex-col select-none"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <button onClick={handleLogoTap} className="flex items-center gap-2">
          <span className="text-indigo-400 font-bold text-xl tracking-tight">TechMo</span>
        </button>
        {screen !== 'welcome' && (
          <button
            onClick={() => {
              setScreen('welcome');
              setPhone(''); setDevice(''); setFault('');
              setTrackInput(''); setTrackResult(null); setTrackError('');
            }}
            className="text-zinc-500 text-sm hover:text-white transition-colors"
          >
            ← Back
          </button>
        )}
      </header>

      {/* Body */}
      <main className="flex-1 flex flex-col">
        {/* ── Welcome ── */}
        {screen === 'welcome' && (
          <WelcomeScreen
            onCheckIn={() => setScreen('checkin-phone')}
            onTrack={() => setScreen('track-input')}
          />
        )}

        {/* ── Check-In: Phone ── */}
        {screen === 'checkin-phone' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
            <h2 className="text-2xl font-bold">Enter Your Phone Number</h2>
            <NumPad
              value={phone}
              onChange={setPhone}
              label="Mobile number (international format)"
              maxLength={12}
              type="phone"
            />
            <button
              disabled={phone.length < 9}
              onClick={() => setScreen('checkin-device')}
              className="w-full max-w-xs py-4 rounded-2xl bg-indigo-600 disabled:opacity-40 text-white font-semibold text-lg transition-all active:scale-95"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── Check-In: Device & Fault ── */}
        {screen === 'checkin-device' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 max-w-lg mx-auto w-full">
            <h2 className="text-2xl font-bold">Tell us about your device</h2>
            <div className="w-full space-y-3">
              <input
                type="text"
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                placeholder="Device model (e.g. Samsung Galaxy S23)"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 text-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <textarea
                value={fault}
                onChange={(e) => setFault(e.target.value)}
                placeholder="Describe the issue (e.g. cracked screen, won't charge…)"
                rows={4}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 text-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <button
              disabled={!device || !fault}
              onClick={handleCheckInSubmit}
              className="w-full py-4 rounded-2xl bg-indigo-600 disabled:opacity-40 text-white font-semibold text-lg transition-all active:scale-95"
            >
              {loading ? 'Submitting…' : 'Submit Check-In →'}
            </button>
          </div>
        )}

        {/* ── Check-In: Done ── */}
        {screen === 'checkin-done' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
            <CheckCircle2 className="w-20 h-20 text-indigo-400" />
            <h2 className="text-3xl font-bold">You're checked in!</h2>
            <p className="text-zinc-400 text-lg">
              A staff member will be with you shortly. Your reference number:
            </p>
            <div className="text-5xl font-bold text-indigo-400 font-mono">{ticketRef}</div>
            <p className="text-zinc-500 text-sm">
              Please keep this reference to track your repair status.
            </p>
            <button
              onClick={() => { setScreen('welcome'); setPhone(''); setDevice(''); setFault(''); setTicketRef(''); }}
              className="mt-4 px-8 py-3 rounded-2xl bg-zinc-700 text-white font-medium text-base transition-all active:scale-95"
            >
              Done
            </button>
          </div>
        )}

        {/* ── Track: Input ── */}
        {screen === 'track-input' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 max-w-lg mx-auto w-full">
            <h2 className="text-2xl font-bold">Track Your Repair</h2>
            <input
              type="text"
              value={trackInput}
              onChange={(e) => setTrackInput(e.target.value)}
              placeholder="Enter ticket ref (e.g. TK-456) or phone number"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-2xl px-5 py-4 text-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {trackError && <p className="text-red-400 text-sm">{trackError}</p>}
            <button
              disabled={!trackInput || loading}
              onClick={handleTrack}
              className="w-full py-4 rounded-2xl bg-indigo-600 disabled:opacity-40 text-white font-semibold text-lg transition-all active:scale-95"
            >
              {loading ? 'Searching…' : 'Search →'}
            </button>
          </div>
        )}

        {/* ── Track: Result ── */}
        {screen === 'track-result' && trackResult && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 max-w-lg mx-auto w-full">
            <h2 className="text-2xl font-bold">Repair Status</h2>
            <div className="w-full rounded-2xl bg-zinc-800 border border-zinc-700 p-6 space-y-4">
              <div className="flex justify-between">
                <span className="text-zinc-400">Ticket</span>
                <span className="font-mono font-bold text-indigo-400">{trackResult.ticketRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Device</span>
                <span className="font-medium">{trackResult.device}</span>
              </div>
            </div>
            {/* Progress stepper */}
            <div className="w-full space-y-2">
              {REPAIR_STEPS.map((step, i) => {
                const done    = i < trackResult.currentStep;
                const current = i === trackResult.currentStep;
                return (
                  <div key={step} className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                        ${done    ? 'bg-green-600 text-white' : ''}
                        ${current ? 'bg-indigo-600 text-white ring-4 ring-indigo-400/30' : ''}
                        ${!done && !current ? 'bg-zinc-700 text-zinc-500' : ''}
                      `}
                    >
                      {done ? '✓' : i + 1}
                    </div>
                    <span className={current ? 'text-white font-semibold' : done ? 'text-zinc-400' : 'text-zinc-600'}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => { setScreen('welcome'); setTrackInput(''); setTrackResult(null); }}
              className="w-full py-3 rounded-2xl bg-zinc-700 text-white font-medium transition-all active:scale-95"
            >
              Done
            </button>
          </div>
        )}

        {/* ── Exit PIN ── */}
        {screen === 'exit-pin' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
            <h2 className="text-xl font-bold text-amber-400">Manager PIN Required</h2>
            <NumPad
              value={pin}
              onChange={setPin}
              label="Enter 4-digit manager PIN"
              maxLength={4}
              type="pin"
            />
            {pinError && <p className="text-red-400 text-sm">{pinError}</p>}
            <div className="flex gap-3 w-full max-w-xs">
              <button
                onClick={() => { setScreen('welcome'); setPin(''); setPinError(''); }}
                className="flex-1 py-3 rounded-2xl bg-zinc-700 text-white font-medium"
              >
                Cancel
              </button>
              <button
                disabled={pin.length < 4}
                onClick={handlePinSubmit}
                className="flex-1 py-3 rounded-2xl bg-indigo-600 disabled:opacity-40 text-white font-semibold"
              >
                Exit Kiosk
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-6 py-3 text-center text-zinc-700 text-xs border-t border-zinc-900">
        TechMo Service Centre · Touch the logo 3 times to exit kiosk mode
      </footer>
    </div>
  );
}
