'use client';
/**
 * StocktakeScanner.tsx
 * ---------------------
 * Offline-first warehouse auditor.
 * Staff walk the warehouse, scan barcodes via BarcodeDetector API or manual input,
 * and counts land in IndexedDB. Wi-Fi not required until sync.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Package, CheckCircle2, AlertTriangle, Upload } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import {
  addScan,
  bulkSyncSession,
  getPendingScans,
  stocktakeDB,
  StocktakeScan,
  StocktakeScanStatus,
  StocktakeSession,
} from '@/lib/stocktake-db';
import { useOnlineStatus } from '@/lib/use-online-status';
import { api } from '@/lib/api';

interface Props {
  branchId: string;
  staffId: string;
}

type SyncResult = { synced: number; conflicts: number; errors: number } | null;

export default function StocktakeScanner({ branchId, staffId }: Props) {
  const online = useOnlineStatus();
  const [session, setSession] = useState<StocktakeSession | null>(null);
  const [scans, setScans] = useState<StocktakeScan[]>([]);
  const [manualSku, setManualSku] = useState('');
  const [qty, setQty] = useState(1);
  const [binLocation, setBinLocation] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const rafRef = useRef<number>(0);
  const lastValueRef = useRef<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Start / load session ────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const existing = await stocktakeDB.sessions
        .where({ branchId, staffId, status: 'in-progress' })
        .first();
      if (existing) {
        setSession(existing);
        refreshScans(existing.id);
      }
    }
    init();
  }, [branchId, staffId]);

  async function startSession() {
    const s: StocktakeSession = {
      id: uuidv4(),
      branchId,
      staffId,
      startedAt: new Date(),
      totalScans: 0,
      status: 'in-progress',
    };
    await stocktakeDB.sessions.add(s);
    setSession(s);
    setScans([]);
    startCamera();
  }

  async function refreshScans(sessionId: string) {
    const rows = await stocktakeDB.scans
      .where('sessionId').equals(sessionId)
      .reverse()
      .sortBy('scannedAt');
    setScans(rows);
  }

  // ── Camera + BarcodeDetector ────────────────────────────────────────────────
  async function startCamera() {
    if (!('BarcodeDetector' in window)) return; // fallback: manual input only
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: 1280, height: 720 },
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    }
    detectorRef.current = new BarcodeDetector({
      formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'code_39', 'data_matrix'],
    });
    scanLoop();
  }

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(t => t.stop());
  }

  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const detector = detectorRef.current;
    if (!video || !canvas || !detector || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) { rafRef.current = requestAnimationFrame(scanLoop); return; }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    detector.detect(canvas).then((results: DetectedBarcode[]) => {
      if (results.length > 0) {
        const value = results[0].rawValue;
        if (value !== lastValueRef.current) {
          lastValueRef.current = value;
          handleScan(value, results[0].format);
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => { lastValueRef.current = ''; }, 1500);
        }
      }
    }).catch(() => {});
    rafRef.current = requestAnimationFrame(scanLoop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { stopCamera(); }, []);

  // ── Record a scan ───────────────────────────────────────────────────────────
  async function handleScan(sku: string, format = 'manual') {
    if (!session) return;
    navigator.vibrate?.([80, 30, 80]);
    // Audio beep
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.connect(ctx.destination);
      osc.frequency.value = 1200;
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {}

    await addScan({ sessionId: session.id, sku, barcodeFormat: format, countedQty: qty, binLocation });
    await stocktakeDB.sessions.update(session.id, { totalScans: (session.totalScans ?? 0) + 1 });
    setSession(prev => prev ? { ...prev, totalScans: (prev.totalScans ?? 0) + 1 } : prev);
    refreshScans(session.id);
    setManualSku('');
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualSku.trim()) handleScan(manualSku.trim(), 'manual');
  }

  // ── Sync ────────────────────────────────────────────────────────────────────
  async function handleSync() {
    if (!session || !online) return;
    setSyncing(true);
    try {
      const result = await bulkSyncSession(session.id, body =>
        api.post('/inventory/stocktake/bulk-sync', body).then(r => r.data as { results: Array<{ localId: number; serverQty: number; variance: number; status: StocktakeScanStatus }> }),
      );
      setSyncResult(result);
      refreshScans(session.id);
    } finally {
      setSyncing(false);
    }
  }

  async function endSession() {
    if (!session) return;
    await stocktakeDB.sessions.update(session.id, {
      status: 'completed',
      endedAt: new Date(),
    });
    stopCamera();
    setSession(null);
    setScans([]);
  }

  const pending = scans.filter(s => s.status === 'pending').length;
  const conflicts = scans.filter(s => s.status === 'conflict').length;

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2"><Package className="w-5 h-5" /> Stocktake Auditor</h2>
        <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${
          online ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-amber-500'}`} />
          {online ? 'Online' : 'Offline'}
        </span>
      </div>

      {!session ? (
        <button
          onClick={startSession}
          className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
        >
          Start New Stocktake Session
        </button>
      ) : (
        <>
          {/* Session info */}
          <div className="bg-surface border border-white/10 rounded-lg p-3 text-sm space-y-1">
            <div className="font-mono text-xs text-gray-400">{session.id.slice(0, 8)}…</div>
            <div className="flex gap-4">
              <span>Scans: <b>{session.totalScans}</b></span>
              <span className="text-amber-400">Pending sync: <b>{pending}</b></span>
              {conflicts > 0 && <span className="text-red-400">Conflicts: <b>{conflicts}</b></span>}
            </div>
          </div>

          {/* Camera feed */}
          <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
            <video ref={videoRef} className="w-full" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 border-2 border-indigo-400/40 rounded-xl pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 border-2 border-indigo-400 rounded-lg pointer-events-none" />
          </div>

          {/* Manual input */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              value={manualSku}
              onChange={e => setManualSku(e.target.value)}
              placeholder="SKU / barcode (manual)"
              className="flex-1 border border-white/20 rounded-lg px-3 py-2 bg-surface text-sm"
            />
            <input
              type="number"
              min={1}
              value={qty}
              onChange={e => setQty(Number(e.target.value))}
              className="w-16 border border-white/20 rounded-lg px-2 py-2 bg-surface text-sm text-center"
            />
            <button type="submit" className="px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-700">
              Add
            </button>
          </form>

          {/* Bin location */}
          <input
            value={binLocation}
            onChange={e => setBinLocation(e.target.value)}
            placeholder="Bin / shelf location (optional)"
            className="w-full border border-white/20 rounded-lg px-3 py-2 bg-surface text-sm"
          />

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={!online || syncing || pending === 0}
              className="flex-1 py-2 bg-green-600 text-white rounded-lg font-semibold disabled:opacity-40 hover:bg-green-700 transition"
            >
              {syncing ? 'Syncing…' : <><Upload className="w-3.5 h-3.5 inline-block mr-1" />Sync {pending} Scans</>}
            </button>
            <button
              onClick={endSession}
              className="px-4 py-2 border border-red-400 text-red-400 rounded-lg text-sm hover:bg-red-400/10 transition"
            >
              End Session
            </button>
          </div>

          {/* Sync result */}
          {syncResult && (
            <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-green-400" /> Synced: <b>{syncResult.synced}</b></div>
              {syncResult.conflicts > 0 && <span className="text-amber-400 ml-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Conflicts: {syncResult.conflicts}</span>}
              {syncResult.errors > 0 && <span className="text-red-400 ml-2">✗ Errors: {syncResult.errors}</span>}
            </div>
          )}

          {/* Recent scans */}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {scans.slice(0, 30).map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-white/5 rounded px-3 py-1.5">
                <span className="font-mono">{s.sku}</span>
                <span className="text-gray-400">×{s.countedQty}</span>
                {s.binLocation && <span className="text-indigo-300">{s.binLocation}</span>}
                <span className={
                  s.status === 'synced' ? 'text-green-400' :
                  s.status === 'conflict' ? 'text-amber-400' :
                  s.status === 'error' ? 'text-red-400' : 'text-gray-500'
                }>
                  {s.status === 'synced' && s.variance !== undefined && s.variance !== 0
                    ? `Δ${s.variance > 0 ? '+' : ''}${s.variance}` : s.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
