'use client';

/**
 * OcrScanner — On-device OCR for ID / IMEI scanning using Tesseract.js.
 *
 * 100 % client-side — runs entirely in the browser via WebAssembly.
 * Zero server compute cost. No API keys required.
 *
 * Use cases:
 *   - Scan physical IMEI stickers on the back of phones
 *   - Extract ID/NIC numbers from customer identity documents
 *   - Read handwritten repair notes or physical invoices
 *
 * Setup: npm install tesseract.js  (in apps/admin)
 *
 * Note: Tesseract.js lazy-loads its WebAssembly engine (~5 MB) on first use.
 * A loading progress bar is shown during the first run.
 */

import React, { useCallback, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OcrScannerProps {
  /** Called with the extracted raw text once OCR completes */
  onResult: (text: string) => void;
  /** Mode: 'imei' post-processes for a 15-digit IMEI, 'id' for NIC patterns */
  mode?: 'imei' | 'id' | 'text';
  className?: string;
}

// ─── Post-processors ─────────────────────────────────────────────────────────

function extractImei(raw: string): string {
  // IMEIs are 15 consecutive digits (sometimes prefixed with spaces/dashes)
  const match = raw.replace(/\s/g, '').match(/\d{15}/);
  return match ? match[0] : raw.trim();
}

function extractNic(raw: string): string {
  // Sri Lanka NIC: 9 digits + V/X (old) or 12 digits (new)
  const match = raw.match(/\b(\d{9}[VvXx]|\d{12})\b/);
  return match ? match[1].toUpperCase() : raw.trim();
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OcrScanner({ onResult, mode = 'text', className = '' }: OcrScannerProps) {
  const fileInputRef     = useRef<HTMLInputElement>(null);
  const videoRef         = useRef<HTMLVideoElement>(null);
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const streamRef        = useRef<MediaStream | null>(null);

  const [status, setStatus]   = useState<'idle' | 'camera' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [rawText, setRawText]   = useState('');
  const [result, setResult]     = useState('');
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  // ── Run Tesseract ──────────────────────────────────────────────────────────

  const runOcr = useCallback(async (imageSource: HTMLCanvasElement | File) => {
    setStatus('processing');
    setProgress(0);

    try {
      // Lazy-load Tesseract to avoid bundle size at startup
      const { createWorker } = await import('tesseract.js');

      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const { data: { text } } = await worker.recognize(imageSource);
      await worker.terminate();

      const clean = text.replace(/\n+/g, ' ').trim();
      setRawText(clean);

      let processed = clean;
      if (mode === 'imei') processed = extractImei(clean);
      if (mode === 'id')   processed = extractNic(clean);

      setResult(processed);
      setStatus('done');
      onResult(processed);
    } catch (err) {
      setStatus('error');
      console.error('OCR failed:', err);
    }
  }, [mode, onResult]);

  // ── File upload path ───────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPreviewSrc(url);
    await runOcr(file);
  };

  // ── Camera capture path ────────────────────────────────────────────────────

  const startCamera = async () => {
    setStatus('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setStatus('error');
    }
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);

    // Show preview
    setPreviewSrc(canvas.toDataURL('image/jpeg', 0.9));

    // Stop stream
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    runOcr(canvas);
  };

  const modeLabel = mode === 'imei' ? 'IMEI sticker' : mode === 'id' ? 'ID / NIC' : 'text';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <p className="text-sm text-zinc-400">
        On-device OCR scan — <span className="text-indigo-400">{modeLabel}</span>
        &nbsp;· Powered by Tesseract.js (runs in browser, $0 server cost)
      </p>

      {/* Camera viewfinder */}
      {status === 'camera' && (
        <div className="relative rounded-xl overflow-hidden bg-zinc-900 border border-zinc-700 aspect-video max-w-md">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          <button
            onClick={captureFrame}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full
                       bg-white text-zinc-900 text-sm font-bold shadow-lg"
          >
            <Camera className="w-4 h-4 inline-block mr-1" />Capture
          </button>
        </div>
      )}

      {/* Preview of captured / uploaded image */}
      {previewSrc && status !== 'camera' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewSrc}
          alt="OCR source"
          className="max-w-xs rounded-lg border border-zinc-700 object-contain"
        />
      )}

      {/* Progress */}
      {status === 'processing' && (
        <div className="space-y-1">
          <p className="text-xs text-zinc-400">Recognising text… {progress}%</p>
          <div className="w-full bg-zinc-800 rounded-full h-1.5">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Result */}
      {status === 'done' && (
        <div className="rounded-lg border border-green-700 bg-green-950/30 p-3 space-y-2">
          <p className="text-xs font-semibold text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> OCR Result</p>
          <p className="font-mono text-sm text-white break-all">{result}</p>
          {rawText !== result && (
            <details className="text-xs text-zinc-500">
              <summary className="cursor-pointer">Raw OCR output</summary>
              <p className="mt-1 break-all">{rawText}</p>
            </details>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { navigator.clipboard.writeText(result); }}
              className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-white"
            >
              Copy
            </button>
            <button
              onClick={() => { setStatus('idle'); setPreviewSrc(null); setRawText(''); setResult(''); }}
              className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-white"
            >
              Scan Again
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <p className="text-sm text-red-400">OCR failed — check camera permissions or try uploading an image.</p>
      )}

      {/* Action buttons */}
      {(status === 'idle' || status === 'done') && (
        <div className="flex gap-2">
          <button
            onClick={startCamera}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Camera className="w-4 h-4" /> Use Camera
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium transition-colors flex items-center gap-2"
          >
            <ImageIcon className="w-4 h-4" /> Upload Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}
    </div>
  );
}
