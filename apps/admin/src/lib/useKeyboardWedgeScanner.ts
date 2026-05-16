'use client';
/**
 * useKeyboardWedgeScanner
 * -----------------------
 * Detects input from USB HID barcode scanners (and Bluetooth SPP scanners)
 * that operate as "keyboard wedge" devices — they emit the barcode as rapid
 * keystrokes followed by an Enter key, faster than any human can type.
 *
 * Works on ALL desktop platforms (Windows, Linux, macOS) without any driver
 * or browser API extensions. The scanner just needs to be plugged in as a
 * USB HID device or paired as a Bluetooth keyboard.
 *
 * Algorithm:
 *   1. Monitor global `keydown` events.
 *   2. Track inter-keystroke timing.
 *   3. If characters arrive faster than `maxKeystrokeGapMs` (default 50 ms),
 *      accumulate them into a buffer — this is scanner speed.
 *   4. Fire `onScan(value)` when:
 *      a. The scanner sends an Enter / Tab character, OR
 *      b. A 100 ms silence timeout fires after ≥ `minLength` characters.
 *   5. Reset buffer if a large gap is detected (human resumed typing).
 *
 * The hook intentionally skips events when an input/textarea already has
 * focus, so it won't double-fire alongside the natural keystroke feed into
 * the focused field. The POS page uses the hook alongside its normal `<input>`
 * so that scans still work when the user's focus is elsewhere (e.g., they
 * just clicked a cart button).
 */

import { useCallback, useEffect, useRef } from 'react';

export interface KeyboardWedgeScannerOptions {
  /**
   * Called with the decoded barcode string from the scanner.
   * Value has leading/trailing whitespace trimmed.
   */
  onScan: (value: string) => void;

  /**
   * Minimum number of characters required to trigger onScan.
   * Prevents single stray keypresses from being treated as scans.
   * Default: 4
   */
  minLength?: number;

  /**
   * Maximum allowed time (ms) between consecutive keystrokes for the sequence
   * to be considered scanner input. Human typing is typically > 100 ms/char;
   * scanners emit all chars in < 50 ms.
   * Default: 50
   */
  maxKeystrokeGapMs?: number;

  /**
   * How long (ms) to wait after the last character before auto-flushing
   * the buffer (some scanners do not send an Enter).
   * Default: 100
   */
  flushTimeoutMs?: number;

  /**
   * Set to `true` to pause the hook (e.g., while a modal blocks the POS).
   * Default: false
   */
  disabled?: boolean;
}

export function useKeyboardWedgeScanner({
  onScan,
  minLength = 4,
  maxKeystrokeGapMs = 50,
  flushTimeoutMs = 100,
  disabled = false,
}: KeyboardWedgeScannerOptions): void {
  const bufferRef       = useRef<string>('');
  const lastKeyTimeRef  = useRef<number>(0);
  const flushTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFlushTimer = useCallback(() => {
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const flush = useCallback(() => {
    clearFlushTimer();
    const value = bufferRef.current.trim();
    bufferRef.current = '';
    lastKeyTimeRef.current = 0;
    if (value.length >= minLength) {
      onScan(value);
    }
  }, [clearFlushTimer, minLength, onScan]);

  const resetBuffer = useCallback(() => {
    clearFlushTimer();
    bufferRef.current = '';
    lastKeyTimeRef.current = 0;
  }, [clearFlushTimer]);

  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      // If any input/textarea/contenteditable already has focus, do not
      // intercept — the characters are already going into that element.
      // Exception: if the focused element is the POS SKU input the scanner
      // will fill it correctly via the normal onChange path.
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.tagName === 'SELECT')
      ) {
        resetBuffer();
        return;
      }

      const now   = Date.now();
      const gap   = lastKeyTimeRef.current ? now - lastKeyTimeRef.current : 0;
      lastKeyTimeRef.current = now;

      // Large inter-keystroke gap → human typing or a stray key; reset
      if (bufferRef.current.length > 0 && gap > maxKeystrokeGapMs) {
        resetBuffer();
      }

      // Terminator characters — fire immediately
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (bufferRef.current.length >= minLength) {
          e.preventDefault(); // prevent Tab from shifting focus
          flush();
        } else {
          resetBuffer();
        }
        return;
      }

      // Collect printable characters only
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        // Arm the auto-flush timer
        clearFlushTimer();
        flushTimerRef.current = setTimeout(flush, flushTimeoutMs);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      clearFlushTimer();
    };
  }, [
    disabled,
    maxKeystrokeGapMs,
    minLength,
    flush,
    resetBuffer,
    clearFlushTimer,
    flushTimeoutMs,
  ]);
}
