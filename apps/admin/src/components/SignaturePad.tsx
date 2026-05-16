'use client';
/**
 * SignaturePad component — captures customer digital signature using HTML5 Canvas.
 * The signature is output as a base64 PNG data URL.
 *
 * Usage:
 *   <SignaturePad onConfirm={(dataUrl) => setSignatureDataUrl(dataUrl)} />
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { PenLine } from 'lucide-react';

interface SignaturePadProps {
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
  width?: number;
  height?: number;
}

export default function SignaturePad({
  onConfirm,
  onCancel,
  width = 480,
  height = 200,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);   // ref to avoid stale closure in native listeners
  const [isEmpty, setIsEmpty] = useState(true);

  // Set canvas resolution (HiDPI)
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(ratio, ratio);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [width, height]);

  // ── Coordinate helpers ────────────────────────────────────────────────────

  const posFromMouse = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const posFromTouch = (touch: Touch) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  // ── Mouse handlers (React synthetic — fine for mouse) ────────────────────

  const startDraw = useCallback((e: React.MouseEvent) => {
    const { x, y } = posFromMouse(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawingRef.current = true;
    setIsEmpty(false);
  }, []);

  const draw = useCallback((e: React.MouseEvent) => {
    if (!drawingRef.current) return;
    const { x, y } = posFromMouse(e);
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.lineTo(x, y);
    ctx.stroke();
  }, []);

  const stopDraw = useCallback(() => { drawingRef.current = false; }, []);

  // ── Non-passive touch listeners ───────────────────────────────────────────
  // React attaches onTouchStart/Move/End as passive, which blocks preventDefault
  // and causes "Unable to preventDefault inside passive event listener" warnings.
  // We register native listeners with { passive: false } instead.

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      const { x, y } = posFromTouch(t);
      const ctx = canvas.getContext('2d')!;
      ctx.beginPath();
      ctx.moveTo(x, y);
      drawingRef.current = true;
      setIsEmpty(false);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!drawingRef.current) return;
      const t = e.touches[0];
      if (!t) return;
      const { x, y } = posFromTouch(t);
      const ctx = canvas.getContext('2d')!;
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      drawingRef.current = false;
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   onTouchEnd,   { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
    };
  }, []);

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const ratio = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, width * ratio, height * ratio);
    setIsEmpty(true);
  };

  const confirm = () => {
    if (isEmpty) return;
    const dataUrl = canvasRef.current!.toDataURL('image/png');
    onConfirm(dataUrl);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-slate-600">Please sign in the box below to confirm device collection:</p>

      <div className="relative border-2 border-slate-300 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="touch-none cursor-crosshair block"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-300 text-sm select-none flex items-center gap-1.5"><PenLine className="w-4 h-4" /> Sign here</p>
          </div>
        )}
      </div>

      <div className="flex gap-3 w-full justify-end">
        <button
          type="button"
          onClick={clear}
          className="btn-secondary text-sm"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={isEmpty}
          className="btn-primary text-sm disabled:opacity-40"
        >
          ✓ Confirm Signature
        </button>
      </div>
    </div>
  );
}
