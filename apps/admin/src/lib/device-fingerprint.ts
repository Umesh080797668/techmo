/**
 * device-fingerprint.ts
 * ----------------------
 * On-device fraud detection using Canvas Fingerprinting + Client Hints API.
 *
 * Detects "Impossible Employee Actions":
 *   - A Manager PIN entered on a device that has never been seen in the shop
 *   - Triggers a Telegram alert via n8n webhook
 *
 * The fingerprint is:
 *   1. Generated once on the first trusted login (stored in localStorage)
 *   2. Checked on every sensitive action (manager PIN, large discount, void)
 *   3. Compared against the list of previously seen device fingerprints
 *
 * All processing happens 100% client-side — $0 compute cost.
 */

const KNOWN_DEVICES_KEY = 'techmo_known_devices';
const FINGERPRINT_KEY   = 'techmo_device_fp';

// ─── Canvas fingerprint ──────────────────────────────────────────────────────

function canvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width  = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d')!;

    // Text rendering varies subtly across GPU / driver / OS
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f6f';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('TechMo 🔑 Ω', 2, 15);
    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.fillText('TechMo 🔑 Ω', 4, 17);

    return canvas.toDataURL();
  } catch {
    return 'canvas-unavailable';
  }
}

// ─── Simple hash (djb2) ──────────────────────────────────────────────────────

function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32-bit int
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ─── Client Hints (User-Agent CH) ───────────────────────────────────────────

interface UAData {
  platform?: string;
  brands?: Array<{ brand: string; version: string }>;
  mobile?: boolean;
}

async function getClientHints(): Promise<UAData> {
  // navigator.userAgentData is available in Chromium 90+
  const uad = (navigator as Navigator & { userAgentData?: { getHighEntropyValues: (hints: string[]) => Promise<UAData>; mobile?: boolean; brands?: Array<{ brand: string; version: string }> } }).userAgentData;
  if (uad?.getHighEntropyValues) {
    try {
      return await uad.getHighEntropyValues(['platform', 'brands', 'mobile']);
    } catch {}
  }
  return {};
}

// ─── Build fingerprint ───────────────────────────────────────────────────────

export interface DeviceFingerprint {
  fpHash: string;          // short hash for display / storage
  platform: string;
  language: string;
  timeZone: string;
  screenRes: string;
  colorDepth: number;
  touchPoints: number;
  mobile: boolean;
  canvasHash: string;
  createdAt: string;
}

export async function buildFingerprint(): Promise<DeviceFingerprint> {
  const hints = await getClientHints();

  const platform   = hints.platform  ?? navigator.platform ?? 'unknown';
  const language   = navigator.language;
  const timeZone   = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const screenRes  = `${screen.width}×${screen.height}`;
  const colorDepth = screen.colorDepth;
  const touchPoints = navigator.maxTouchPoints;
  const mobile     = hints.mobile ?? ('ontouchstart' in window);
  const canvasHash = djb2(canvasFingerprint());

  const raw = `${platform}|${language}|${timeZone}|${screenRes}|${colorDepth}|${touchPoints}|${canvasHash}`;
  const fpHash = djb2(raw);

  return { fpHash, platform, language, timeZone, screenRes, colorDepth, touchPoints, mobile, canvasHash, createdAt: new Date().toISOString() };
}

// ─── Trust store (localStorage) ─────────────────────────────────────────────

export function getTrustedFingerprints(): DeviceFingerprint[] {
  try {
    return JSON.parse(localStorage.getItem(KNOWN_DEVICES_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function trustCurrentDevice(fp: DeviceFingerprint): void {
  const list = getTrustedFingerprints();
  if (!list.some(d => d.fpHash === fp.fpHash)) {
    list.push(fp);
    localStorage.setItem(KNOWN_DEVICES_KEY, JSON.stringify(list.slice(-20))); // keep last 20
  }
  localStorage.setItem(FINGERPRINT_KEY, JSON.stringify(fp));
}

export function getCurrentFingerprint(): DeviceFingerprint | null {
  try {
    return JSON.parse(localStorage.getItem(FINGERPRINT_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function isDeviceTrusted(fp: DeviceFingerprint): boolean {
  const trusted = getTrustedFingerprints();
  return trusted.some(d => d.fpHash === fp.fpHash);
}

// ─── Alert hook ─────────────────────────────────────────────────────────────

export interface FraudCheckResult {
  trusted: boolean;
  fingerprint: DeviceFingerprint;
}

/**
 * Call this at the start of every sensitive action (manager PIN, large discount, void).
 *
 * If the device is unknown, fires a webhook to n8n which sends a Telegram alert.
 *
 * @returns `{ trusted, fingerprint }`
 */
export async function checkDeviceBeforeAction(
  actionLabel: string,
  staffId: string,
  n8nWebhookUrl?: string,
): Promise<FraudCheckResult> {
  const fp = await buildFingerprint();
  const trusted = isDeviceTrusted(fp);

  if (!trusted && n8nWebhookUrl) {
    // Fire-and-forget — don't block the UI
    fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'UNKNOWN_DEVICE_SENSITIVE_ACTION',
        action: actionLabel,
        staffId,
        fingerprint: fp,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      }),
    }).catch(() => {});
  }

  return { trusted, fingerprint: fp };
}

/**
 * Call once after a successful admin login on a trusted device to mark it.
 */
export async function registerDeviceOnLogin(): Promise<void> {
  const fp = await buildFingerprint();
  trustCurrentDevice(fp);
}
