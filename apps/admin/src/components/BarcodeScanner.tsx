'use client';
/**
 * BarcodeScanner — Multi-Platform Barcode Scanner
 *
 * Scanning engine selection (auto-detected at runtime):
 *  1. BarcodeDetector API  → Chrome on Android, Safari 17.4+ on iOS
 *     Fast, native, zero-dependency.
 *  2. ZXing (@zxing/browser) → Chrome/Edge/Firefox on Windows & Linux (desktops)
 *     Full software decode: Code 128, QR, EAN-13, EAN-8, UPC-A/E, Data Matrix, ITF, PDF417 …
 *  3. USB Keyboard-Wedge     → ANY platform (Windows, Linux, macOS, Android, iOS)
 *     USB/Bluetooth HID barcode guns that emit keystrokes are detected via rapid-keystroke
 *     timing (< 50 ms/char) — no driver, no camera, no API required.
 *  4. Manual entry fallback  → all browsers, all platforms.
 *
 * This component is loaded client-side only (dynamic import, ssr:false in the parent).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import { useKeyboardWedgeScanner } from '@/lib/useKeyboardWedgeScanner';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BarcodeScannerProps {
  /** Called each time a barcode is successfully decoded. */
  onScan: (value: string, format: string) => void;
  /** Optional: restrict to specific formats for BarcodeDetector (ZXing auto-detects all). */
  formats?: string[];
  /** Optional: whether the camera scanner auto-restarts after each scan (default: true). */
  continuous?: boolean;
  className?: string;
  /** When true the wedge-scanner listener is disabled (e.g. an input has focus). */
  disableWedge?: boolean;
}

type ScanRecord = { value: string; format: string; ts: Date };
type ScanEngine  = 'native' | 'zxing' | 'wedge' | 'manual';

// ─── Capability Detection ─────────────────────────────────────────────────────

function hasNativeBarcodeDetector(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

// ─── Web Audio Beep ──────────────────────────────────────────────────────────

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(1400, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch { /* AudioContext restricted */ }
}

// ─── Native BarcodeDetector interfaces ───────────────────────────────────────

interface BarcodeDetectorResult { rawValue: string; format: string; }
interface BarcodeDetectorClass {
  new(opts?: { formats?: string[] }): {
    detect(src: HTMLCanvasElement | HTMLVideoElement | ImageBitmap): Promise<BarcodeDetectorResult[]>;
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BarcodeScanner({
  onScan,
  formats,
  continuous = true,
  className = '',
  disableWedge = false,
}: BarcodeScannerProps) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);

  // Native BarcodeDetector state
  const nativeDetectorRef  = useRef<InstanceType<BarcodeDetectorClass> | null>(null);
  const rafRef             = useRef<number | null>(null);

  // ZXing state
  const zxingReaderRef     = useRef<BrowserMultiFormatReader | null>(null);

  // Debounce
  const lastValueRef       = useRef<string>('');
  const lastScanTimeRef    = useRef<number>(0);

  const [engine]        = useState<ScanEngine>(hasNativeBarcodeDetector() ? 'native' : 'zxing');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [history, setHistory]       = useState<ScanRecord[]>([]);
  const [lastScan, setLastScan]     = useState<string | null>(null);
  const [wedgeActive, setWedgeActive] = useState(false);

  // ── Emit helper ─────────────────────────────────────────────────────────

  const emitScan = useCallback((value: string, format: string) => {
    const now = Date.now();
    if (value === lastValueRef.current && now - lastScanTimeRef.current < 1500) return;
    lastValueRef.current    = value;
    lastScanTimeRef.current = now;

    navigator.vibrate?.([80, 30, 80]);
    playBeep();

    setLastScan(value);
    setHistory(h => [{ value, format, ts: new Date() }, ...h].slice(0, 20));
    onScan(value, format);
  }, [onScan]);

  // ── USB/Bluetooth keyboard-wedge scanner ────────────────────────────────
  // Works on ALL platforms (Windows, Linux, macOS) — the scanner simply emits
  // keystrokes faster than any human can type.

  useKeyboardWedgeScanner({
    onScan: (value) => {
      setWedgeActive(true);
      emitScan(value, 'wedge');
      setTimeout(() => setWedgeActive(false), 800);
      if (!continuous) stopCamera();
    },
    disabled: disableWedge,
    minLength: 4,
  });

  // ── Stop camera / cleanup ────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    // Cancel native RAF loop
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

    // Stop ZXing — the reader stops automatically when the stream is closed below
    zxingReaderRef.current = null;

    // Release camera stream
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    setIsScanning(false);
    setError(null);
  }, []);

  // ── Start camera (native BarcodeDetector path) ────────────────────────

  const startNative = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const API = (window as any).BarcodeDetector as BarcodeDetectorClass;
      nativeDetectorRef.current = new API({
        formats: formats ?? ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e', 'data_matrix', 'pdf417'],
      });
      setIsScanning(true);
    } catch (err) {
      setError((err as Error).message ?? 'Camera access denied');
    }
  }, [formats]);

  // ── Native scan loop (rAF) ────────────────────────────────────────────

  const nativeScanLoop = useCallback(async () => {
    if (!videoRef.current || !nativeDetectorRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2) { rafRef.current = requestAnimationFrame(nativeScanLoop); return; }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    try {
      const barcodes = await nativeDetectorRef.current.detect(canvas);
      if (barcodes.length > 0) {
        const { rawValue, format } = barcodes[0];
        emitScan(rawValue, format);
        if (!continuous) { stopCamera(); return; }
      }
    } catch { /* non-fatal */ }

    rafRef.current = requestAnimationFrame(nativeScanLoop);
  }, [continuous, emitScan, stopCamera]);

  useEffect(() => {
    if (isScanning && engine === 'native') {
      rafRef.current = requestAnimationFrame(nativeScanLoop);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isScanning, engine, nativeScanLoop]);

  // ── Start camera (ZXing path — Windows / Linux / desktop) ─────────────

  const startZxing = useCallback(async () => {
    setError(null);
    try {
      // Request camera early so we can show the stream in <video>
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const reader = new BrowserMultiFormatReader();
      zxingReaderRef.current = reader;
      setIsScanning(true);

      // ZXing decodes from the live video element continuously
      await reader.decodeFromStream(stream, videoRef.current!, (result, err) => {
        if (result) {
          emitScan(result.getText(), result.getBarcodeFormat().toString());
          if (!continuous) stopCamera();
        } else if (err && !(err instanceof NotFoundException)) {
          // NotFoundException fires on every frame with no barcode — expected; ignore
          console.debug('[ZXing]', err.message);
        }
      });
    } catch (err) {
      const msg = (err as Error).message ?? 'Camera error';
      if (msg.includes('NotAllowed') || msg.includes('Permission')) {
        setError('Camera access denied. Please allow camera in browser settings.');
      } else if (msg.includes('NotFound') || msg.includes('NotReadable')) {
        setError('No camera found. Plug in a USB scanner or use manual entry below.');
      } else {
        setError(msg);
      }
      stopCamera();
    }
  }, [continuous, emitScan, stopCamera]);

  const startCamera = useCallback(() => {
    return engine === 'native' ? startNative() : startZxing();
  }, [engine, startNative, startZxing]);

  // Cleanup on unmount
  useEffect(() => () => stopCamera(), [stopCamera]);

  // ── Manual fallback ──────────────────────────────────────────────────────

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = manualInput.trim();
    if (!v) return;
    emitScan(v, 'manual');
    setManualInput('');
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const engineLabel =
    engine === 'native' ? 'Native (Android/iOS)' :
    engine === 'zxing'  ? 'ZXing (Windows/Linux)' : '';

  return (
    <div className={`flex flex-col gap-4 ${className}`}>

      {/* ── Engine badge + wedge indicator ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-900/50 border border-indigo-700/40 text-indigo-300 font-medium">
          Camera: {engineLabel}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-all ${
          wedgeActive
            ? 'bg-green-700/60 border-green-600 text-green-200 scale-105'
            : 'bg-zinc-800 border-zinc-700 text-zinc-400'
        }`}>
          USB Wedge Scanner {wedgeActive ? '✓' : '(listening)'}
        </span>
      </div>

      {/* ── Viewfinder ── */}
      <div className="relative w-full max-w-md mx-auto aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-zinc-700 shadow-lg">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />

        {/* Targeting reticle */}
        {isScanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-56 h-36">
              {(['tl','tr','bl','br'] as const).map(pos => (
                <span key={pos} className={`absolute w-7 h-7 border-[3px] border-indigo-400 ${
                  pos === 'tl' ? 'top-0 left-0 border-r-0 border-b-0 rounded-tl' :
                  pos === 'tr' ? 'top-0 right-0 border-l-0 border-b-0 rounded-tr' :
                  pos === 'bl' ? 'bottom-0 left-0 border-r-0 border-t-0 rounded-bl' :
                                 'bottom-0 right-0 border-l-0 border-t-0 rounded-br'
                }`} />
              ))}
              <div className="absolute inset-x-4 top-1/2 h-0.5 bg-indigo-400/60 animate-pulse" />
            </div>
          </div>
        )}

        {/* Last scan flash */}
        {lastScan && (
          <div key={lastScan}
            className="absolute bottom-2 inset-x-2 bg-green-600/90 text-white text-xs font-mono
                       rounded-lg px-3 py-1.5 text-center truncate">
            ✓ {lastScan}
          </div>
        )}

        {!isScanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm select-none">
            Camera off
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/90 text-red-400 text-sm px-4 text-center">
            ⚠ {error}
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="flex gap-2 justify-center">
        {!isScanning ? (
          <button onClick={startCamera}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors">
            Start Camera Scanner
          </button>
        ) : (
          <button onClick={stopCamera}
            className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium transition-colors">
            Stop Camera
          </button>
        )}
      </div>

      {/* ── USB wedge notice (desktop hint) ── */}
      {engine === 'zxing' && !isScanning && (
        <p className="text-xs text-zinc-400 text-center">
          On Windows/Linux: plug in a USB barcode scanner — it works without pressing any button. Just scan!
        </p>
      )}

      {/* ── Manual Fallback ── */}
      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <input
          type="text"
          value={manualInput}
          onChange={e => setManualInput(e.target.value)}
          placeholder="Type or paste barcode / IMEI manually…"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm
                     text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button type="submit"
          className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium transition-colors">
          Add
        </button>
      </form>

      {/* ── Scan History ── */}
      {history.length > 0 && (
        <div className="rounded-lg border border-zinc-700 overflow-hidden">
          <p className="text-xs text-zinc-500 px-3 py-1.5 bg-zinc-900 border-b border-zinc-700">
            Scan history (session)
          </p>
          <ul className="divide-y divide-zinc-800 max-h-40 overflow-y-auto">
            {history.map((rec, i) => (
              <li key={i}
                className="flex items-center justify-between px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                onClick={() => onScan(rec.value, rec.format)}>
                <span className="font-mono truncate max-w-[200px]">{rec.value}</span>
                <span className="text-zinc-500 ml-2 shrink-0">
                  {rec.format} · {rec.ts.toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
