'use client';
/**
 * SerialPortReader.tsx
 * ---------------------
 * Web Serial API bridge for legacy USB/RS-232 hardware.
 * Reads data from connected scales, battery testers, or label printers
 * directly in the browser — no driver installation, no middleware.
 *
 * Compatible with: Chrome 89+, Edge 89+, Opera 75+
 * (Not supported in Firefox or Safari — component shows a graceful fallback)
 *
 * Typical use cases:
 *   - Weigh bulk parts (e.g. bag of screws) → auto-fill weight field in POS
 *   - Read battery health percentage from a tester → fill repair form
 *   - Send ESC/POS commands to a thermal printer
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Plug, Zap } from 'lucide-react';

export interface SerialMessage {
  raw: string;
  timestamp: Date;
  parsed?: Record<string, string | number>;
}

export interface ParsedWeight {
  grams: number;
  unit: string;
  stable: boolean;
}

export interface Props {
  /** Called every time a complete line arrives from the device */
  onData?: (msg: SerialMessage) => void;
  /** Called when a weight reading is parsed (device: scales) */
  onWeight?: (w: ParsedWeight) => void;
  /** Baud rate. Default 9600 (most scales/testers). */
  baudRate?: number;
  deviceLabel?: string;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export default function SerialPortReader({
  onData,
  onWeight,
  baudRate = 9600,
  deviceLabel = 'USB Device',
}: Props) {
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [log, setLog] = useState<SerialMessage[]>([]);
  const [error, setError] = useState<string>('');
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const supported = typeof navigator !== 'undefined' && 'serial' in navigator;

  const appendLog = useCallback((raw: string) => {
    const parsed = tryParseWeight(raw);
    const msg: SerialMessage = { raw, timestamp: new Date(), parsed: parsed ? { grams: parsed.grams, unit: parsed.unit, stable: Number(parsed.stable) } : undefined };
    setLog(prev => [msg, ...prev].slice(0, 50));
    onData?.(msg);
    if (parsed) onWeight?.(parsed);
  }, [onData, onWeight]);

  async function connect() {
    if (!supported) return;
    setState('connecting');
    setError('');
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate });
      portRef.current = port;
      setState('connected');
      readLoop(port);
    } catch (e: unknown) {
      setState('error');
      setError((e as Error).message ?? 'Connection failed');
    }
  }

  async function disconnect() {
    readerRef.current?.cancel().catch(() => {});
    await portRef.current?.close().catch(() => {});
    portRef.current = null;
    setState('disconnected');
  }

  useEffect(() => () => { disconnect(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function readLoop(port: SerialPort) {
    const textDecoder = new TextDecoderStream();
    port.readable!.pipeTo(textDecoder.writable as WritableStream<Uint8Array>);
    const reader = textDecoder.readable
      .pipeThrough(new TransformStream(new LineBreakTransformer()))
      .getReader();
    readerRef.current = reader as ReadableStreamDefaultReader<string>;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value.trim()) appendLog(value.trim());
      }
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        setState('error');
        setError((e as Error).message ?? 'Read error');
      }
    }
    setState('disconnected');
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const stateColor: Record<ConnectionState, string> = {
    disconnected: 'text-gray-400',
    connecting:   'text-amber-400 animate-pulse',
    connected:    'text-green-400',
    error:        'text-red-400',
  };

  if (!supported) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-900/20 p-3 text-sm text-amber-300 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        Web Serial API not supported in this browser. Use Chrome or Edge for serial device connectivity.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="font-semibold text-sm flex items-center gap-1.5"><Plug className="w-3.5 h-3.5" /> {deviceLabel}</span>
        <span className={`text-xs font-mono ${stateColor[state]}`}>● {state}</span>
        {state === 'connected' ? (
          <button onClick={disconnect} className="ml-auto text-xs px-3 py-1 border border-red-400 text-red-400 rounded hover:bg-red-400/10 transition">
            Disconnect
          </button>
        ) : (
          <button onClick={connect} disabled={state === 'connecting'} className="ml-auto text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition">
            {state === 'connecting' ? 'Connecting…' : 'Connect'}
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-500/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Most recent value (big display for weight readout) */}
      {log[0]?.parsed?.grams !== undefined && (
        <div className="text-center">
          <div className="text-4xl font-mono font-bold text-green-300">
            {log[0].parsed.grams}
            <span className="text-xl ml-1 text-gray-400">{log[0].parsed.unit}</span>
          </div>
          {!log[0].parsed.stable && <div className="text-xs text-amber-400 mt-1 flex items-center gap-1"><Zap className="w-3 h-3" /> Stabilising…</div>}
        </div>
      )}

      {/* Raw log */}
      <div className="max-h-40 overflow-y-auto space-y-0.5 font-mono text-xs text-gray-400 bg-black/30 rounded p-2">
        {log.length === 0 ? (
          <div className="text-gray-600 italic">No data received yet</div>
        ) : log.map((m, i) => (
          <div key={i}>{m.timestamp.toLocaleTimeString()} › {m.raw}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse weight output from common USB scales.
 * Most scales send lines like: "ST,GS,  +   450.20 g" or "  450.20 g"
 */
function tryParseWeight(line: string): ParsedWeight | null {
  // Stable flag: most scales prefix "ST" for stable, "US" for unstable
  const stable = !line.toUpperCase().includes('US');
  const match  = line.match(/([\d.]+)\s*(g|kg|oz|lb)/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit  = match[2].toLowerCase();
  const grams = unit === 'kg' ? value * 1000 : unit === 'oz' ? value * 28.35 : unit === 'lb' ? value * 453.6 : value;
  return { grams: Math.round(grams * 100) / 100, unit, stable };
}

/** Splits a ReadableStream<string> into lines. */
class LineBreakTransformer implements Transformer<string, string> {
  private buffer = '';
  transform(chunk: string, ctrl: TransformStreamDefaultController<string>) {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? '';
    for (const line of lines) ctrl.enqueue(line);
  }
  flush(ctrl: TransformStreamDefaultController<string>) {
    if (this.buffer) ctrl.enqueue(this.buffer);
  }
}
