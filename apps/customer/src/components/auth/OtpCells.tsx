'use client';
import { useRef, KeyboardEvent, ClipboardEvent } from 'react';

interface Props {
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
}

/** Renders 6 individual OTP digit cells. */
export default function OtpCells({ value, onChange, disabled }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, raw: string) => {
    if (!/^\d?$/.test(raw)) return;
    const next = [...value];
    next[index] = raw;
    onChange(next);
    if (raw && index < 5) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) refs.current[index + 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    if (!digits.length) return;
    const next = [...value];
    digits.forEach((d, i) => { if (i < 6) next[i] = d; });
    onChange(next);
    // Focus the cell after the last pasted digit
    const nextFocus = Math.min(digits.length, 5);
    refs.current[nextFocus]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center" role="group" aria-label="One-time password">
      {value.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          aria-label={`OTP digit ${i + 1}`}
          className="otp-cell disabled:opacity-50"
        />
      ))}
    </div>
  );
}
