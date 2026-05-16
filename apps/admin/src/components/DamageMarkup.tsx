'use client';

/**
 * DamageMarkup — Canvas-based visual damage annotation tool.
 *
 * Technicians can draw/annotate directly on a repair photo to highlight:
 *   - Cracks, scratches, dents
 *   - Water damage areas
 *   - Missing components
 *   - Pre-existing damage (before taking the device in)
 *
 * Output: annotated image as a base64 data URL, ready to upload to Cloudinary
 * alongside the standard repair photo timeline.
 *
 * Tools available:
 *   ✏️  Freehand pen (red by default)
 *   ⬜  Rectangle highlight
 *   ⭕  Circle highlight
 *   🔤  Text label
 *   ↩️  Undo (step-back via snapshot stack)
 *   🗑  Clear all
 *   💾  Export annotated image
 *
 * Props:
 *   imageUrl  — the background photo URL (before/drop-off photo)
 *   onExport  — callback with the annotated image as data URL
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Tool = 'pen' | 'rect' | 'circle' | 'text';

export interface DamageMarkupProps {
  imageUrl: string;
  onExport: (dataUrl: string) => void;
  className?: string;
}

interface DrawState {
  isDrawing:  boolean;
  startX:     number;
  startY:     number;
}

// ─── Pure coordinate helpers (no synthetic event wrapping) ───────────────────

function coordsFromMouse(e: React.MouseEvent, canvas: HTMLCanvasElement) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width  / r.width),
    y: (e.clientY - r.top)  * (canvas.height / r.height),
  };
}

function coordsFromTouch(touch: Touch, canvas: HTMLCanvasElement) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (touch.clientX - r.left) * (canvas.width  / r.width),
    y: (touch.clientY - r.top)  * (canvas.height / r.height),
  };
}

// ─── Color palette ────────────────────────────────────────────────────────────

const COLORS = [
  { label: 'Red',    value: '#ef4444' },
  { label: 'Amber',  value: '#f59e0b' },
  { label: 'Blue',   value: '#3b82f6' },
  { label: 'Green',  value: '#22c55e' },
  { label: 'White',  value: '#ffffff' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function DamageMarkup({ imageUrl, onExport, className = '' }: DamageMarkupProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const overlayRef  = useRef<HTMLCanvasElement>(null);  // live-preview layer
  const bgImageRef  = useRef<HTMLImageElement | null>(null);
  const drawState   = useRef<DrawState>({ isDrawing: false, startX: 0, startY: 0 });
  const snapshots   = useRef<ImageData[]>([]);

  const [tool, setTool]         = useState<Tool>('pen');
  const [color, setColor]       = useState('#ef4444');
  const [lineWidth, setLineWidth] = useState(3);
  const [textInput, setTextInput] = useState('');
  const [pendingText, setPendingText] = useState<{ x: number; y: number } | null>(null);

  // ── Load background image ─────────────────────────────────────────────────

  useEffect(() => {
    if (!canvasRef.current || !overlayRef.current) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas  = canvasRef.current!;
      const overlay = overlayRef.current!;

      // Constrain to max 700px wide while keeping aspect ratio
      const maxW = 700;
      const ratio = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
      canvas.width   = overlay.width  = img.naturalWidth  * ratio;
      canvas.height  = overlay.height = img.naturalHeight * ratio;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      bgImageRef.current = img;
      snapshots.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // ── Snapshot for undo ─────────────────────────────────────────────────────

  const saveSnapshot = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;
    snapshots.current.push(ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
    if (snapshots.current.length > 30) snapshots.current.shift();
  }, []);

  const undo = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || snapshots.current.length < 2) return;
    snapshots.current.pop();
    ctx.putImageData(snapshots.current[snapshots.current.length - 1], 0, 0);
  }, []);

  // ── Style helper ──────────────────────────────────────────────────────────

  const applyStyle = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
    ctx.lineWidth   = lineWidth;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
  }, [color, lineWidth]);

  // ── Core drawing logic (accepts raw coordinates) ──────────────────────────

  const onDrawStart = useCallback((x: number, y: number) => {
    drawState.current = { isDrawing: true, startX: x, startY: y };
    if (tool === 'pen') {
      const ctx = canvasRef.current!.getContext('2d')!;
      applyStyle(ctx);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    if (tool === 'text') setPendingText({ x, y });
  }, [tool, applyStyle]);

  const onDrawMove = useCallback((x: number, y: number) => {
    if (!drawState.current.isDrawing) return;
    const canvas  = canvasRef.current!;
    const overlay = overlayRef.current!;

    if (tool === 'pen') {
      const ctx = canvas.getContext('2d')!;
      applyStyle(ctx);
      ctx.lineTo(x, y);
      ctx.stroke();
      return;
    }

    const { startX, startY } = drawState.current;
    const octx = overlay.getContext('2d')!;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    applyStyle(octx);
    octx.globalAlpha = 0.7;
    if (tool === 'rect') {
      octx.strokeRect(startX, startY, x - startX, y - startY);
    } else if (tool === 'circle') {
      const rx = Math.abs(x - startX) / 2;
      const ry = Math.abs(y - startY) / 2;
      const cx = startX + (x - startX) / 2;
      const cy = startY + (y - startY) / 2;
      octx.beginPath();
      octx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      octx.stroke();
    }
  }, [tool, applyStyle]);

  const onDrawEnd = useCallback((x: number, y: number) => {
    if (!drawState.current.isDrawing) return;
    drawState.current.isDrawing = false;
    const canvas  = canvasRef.current!;
    const overlay = overlayRef.current!;
    const { startX, startY } = drawState.current;

    if (tool === 'rect' || tool === 'circle') {
      saveSnapshot();
      const ctx = canvas.getContext('2d')!;
      applyStyle(ctx);
      if (tool === 'rect') {
        ctx.strokeRect(startX, startY, x - startX, y - startY);
      } else {
        const rx = Math.abs(x - startX) / 2;
        const ry = Math.abs(y - startY) / 2;
        const cx = startX + (x - startX) / 2;
        const cy = startY + (y - startY) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      overlay.getContext('2d')!.clearRect(0, 0, overlay.width, overlay.height);
    }
    if (tool === 'pen') saveSnapshot();
  }, [tool, applyStyle, saveSnapshot]);

  // ── React mouse handlers ──────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { x, y } = coordsFromMouse(e, canvasRef.current!);
    onDrawStart(x, y);
  }, [onDrawStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const { x, y } = coordsFromMouse(e, canvasRef.current!);
    onDrawMove(x, y);
  }, [onDrawMove]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const { x, y } = coordsFromMouse(e, canvasRef.current!);
    onDrawEnd(x, y);
  }, [onDrawEnd]);

  // ── Non-passive touch listeners (via useEffect) ───────────────────────────
  // React registers onTouchStart/Move/End as passive, preventing preventDefault.
  // We attach native listeners with { passive: false } to block scroll while drawing.

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      const { x, y } = coordsFromTouch(t, canvas);
      onDrawStart(x, y);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      const { x, y } = coordsFromTouch(t, canvas);
      onDrawMove(x, y);
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      // changedTouches — touches[] is empty on touchend
      const t = e.changedTouches[0];
      if (!t) return;
      const { x, y } = coordsFromTouch(t, canvas);
      onDrawEnd(x, y);
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd,   { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
    };
  }, [onDrawStart, onDrawMove, onDrawEnd]);

  // ── Place text label ──────────────────────────────────────────────────────

  const commitText = useCallback(() => {
    if (!pendingText || !textInput.trim() || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    saveSnapshot();
    ctx.fillStyle = color;
    ctx.font = `bold ${lineWidth * 5 + 10}px sans-serif`;
    ctx.fillText(textInput.trim(), pendingText.x, pendingText.y);
    setPendingText(null);
    setTextInput('');
  }, [pendingText, textInput, color, lineWidth, saveSnapshot]);

  // ── Export ────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onExport(dataUrl);
  }, [onExport]);

  // ── Clear ─────────────────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bgImageRef.current) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bgImageRef.current, 0, 0, canvas.width, canvas.height);
    snapshots.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const tools: { id: Tool; icon: string; label: string }[] = [
    { id: 'pen',    icon: '✏', label: 'Pen'       },
    { id: 'rect',   icon: '▭', label: 'Rectangle' },
    { id: 'circle', icon: '○', label: 'Circle'    },
    { id: 'text',   icon: 'T',  label: 'Text'      },
  ];

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-zinc-900 border border-zinc-700">
        {/* Tools */}
        <div className="flex gap-1">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={t.label}
              className={`px-2.5 py-1.5 rounded-lg text-sm transition-colors
                ${tool === t.id ? 'bg-indigo-600 text-white' : 'bg-zinc-700 text-white hover:bg-zinc-600'}`}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-zinc-700 mx-1" />

        {/* Colors */}
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setColor(c.value)}
              title={c.label}
              className={`w-6 h-6 rounded-full border-2 transition-transform
                ${color === c.value ? 'border-white scale-125' : 'border-transparent hover:scale-110'}`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>

        <div className="w-px h-6 bg-zinc-700 mx-1" />

        {/* Line width */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-zinc-400">Size:</span>
          {[2, 4, 7].map((w) => (
            <button
              key={w}
              onClick={() => setLineWidth(w)}
              className={`rounded-full transition-all
                ${lineWidth === w ? 'bg-indigo-500' : 'bg-zinc-600 hover:bg-zinc-500'}`}
              style={{ width: `${w * 3 + 8}px`, height: `${w * 3 + 8}px` }}
            />
          ))}
        </div>

        <div className="ml-auto flex gap-1">
          <button onClick={undo}        title="Undo"  className="px-2 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-sm">↩️</button>
          <button onClick={handleClear} title="Clear" className="px-2 py-1.5 rounded-lg bg-zinc-700 hover:bg-red-800 text-sm flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white text-sm font-medium"
          >
            Save Markup
          </button>
        </div>
      </div>

      {/* Text input (appears when text tool + click) */}
      {pendingText && (
        <div className="flex gap-2 items-center">
          <input
            autoFocus
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') { setPendingText(null); setTextInput(''); } }}
            placeholder="Type label then Enter…"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button onClick={commitText} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm">Place</button>
          <button onClick={() => { setPendingText(null); setTextInput(''); }} className="px-2 py-1.5 rounded-lg bg-zinc-700 text-white text-sm">✕</button>
        </div>
      )}

      {/* Canvas stack */}
      <div className="relative rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 cursor-crosshair">
        {/* Base canvas — mouse handlers here; touch is attached non-passively via useEffect */}
        <canvas
          ref={canvasRef}
          className="block max-w-full"
          style={{ touchAction: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        {/* Overlay canvas (live shape preview) */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0 pointer-events-none"
        />
      </div>

      <p className="text-xs text-zinc-500">
        Annotations are saved to the repair record alongside the original photo.
        Customers can see the annotated version in their portal photo timeline.
      </p>
    </div>
  );
}
