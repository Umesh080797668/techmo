/**
 * PII Masking Utility — Gateway
 * ==============================
 * Automatically redacts personally identifiable information (PII) from
 * audit log entries and structured log output before they are written to
 * Loki / stored in the database.
 *
 * Masked fields (partial redaction — middle characters replaced with *):
 *   - Phone numbers  :  +94 771 **** 567
 *   - Email addresses:  sam***@gmail.com
 *   - IMEI numbers   :  35283 ***** 34678
 *   - NIC / ID numbers:  9728 ***** V
 *   - Credit card numbers (in case they ever appear in notes)
 *
 * Manager "View PII" action:
 *   Managers with ROLE_MANAGER can POST /audit-logs/:id/reveal-pii with their
 *   manager PIN to get the unredacted record. This action itself is audited.
 *
 * Usage:
 *   import { maskPii, maskObject } from './pii-mask';
 *
 *   // String redaction
 *   maskPii('+94771234567')      → '+94771****567'
 *   maskPii('saman@gmail.com')   → 'sam***@gmail.com'
 *
 *   // Deep-redact all string values in an object
 *   maskObject({ phone: '+94771234567', action: 'VOID' })
 *   → { phone: '+94771****567', action: 'VOID' }
 */

// ─── Regex rules ──────────────────────────────────────────────────────────────

const PII_RULES: Array<{ name: string; pattern: RegExp; replacer: (...args: string[]) => string }> = [
  {
    // Phone: international (+94771234567) or local (0771234567)
    name:    'phone',
    pattern: /(\+?\d{2,3})(\d{4})(\d{3,4})(\d{3})/g,
    replacer: (m) => {
      const prefix = m.slice(0, 5);
      const suffix = m.slice(-3);
      return `${prefix}****${suffix}`;
    },
  },
  {
    // Email: mask local part after first 3 chars
    name:    'email',
    pattern: /([a-zA-Z0-9._%+\-]{1,3})([a-zA-Z0-9._%+\-]+)(@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g,
    replacer: (_full: string, prefix: string, _middle: string, domain: string) => `${prefix}***${domain}`,
  },
  {
    // IMEI: 15 digits — mask middle 7
    name:    'imei',
    pattern: /\b(\d{5})\d{5}(\d{5})\b/g,
    replacer: (_full: string, prefix: string, suffix: string) => `${prefix}*****${suffix}`,
  },
  {
    // Sri Lanka NIC old format: 9 digits + V/X
    name:    'nic_old',
    pattern: /\b(\d{4})\d{5}([VvXx])\b/g,
    replacer: (_full: string, prefix: string, suffix: string) => `${prefix}*****${suffix}`,
  },
  {
    // Sri Lanka NIC new format: 12 digits
    name:    'nic_new',
    pattern: /\b(\d{4})\d{4}(\d{4})\b/g,
    replacer: (_full: string, prefix: string, suffix: string) => `${prefix}****${suffix}`,
  },
  {
    // Credit card: 16 digits (any separator)
    name:    'card',
    pattern: /\b(\d{4})[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?(\d{4})\b/g,
    replacer: (_full: string, prefix: string, suffix: string) => `${prefix} **** **** ${suffix}`,
  },
];

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Apply all PII redaction rules to a raw string.
 */
export function maskPii(input: string): string {
  if (typeof input !== 'string') return input;
  let result = input;
  for (const rule of PII_RULES) {
    result = result.replace(rule.pattern, (...args: string[]) => {
      // Forward full match + capture groups (exclude trailing offset + input args)
      return rule.replacer(...args.slice(0, args.length - 2));
    });
  }
  return result;
}

/**
 * Deep-traverse an object / array and mask any string values that contain PII.
 * Non-string primitive values are untouched.
 *
 * @param data     - Any JSON-serialisable value
 * @param skipKeys - Field names to skip masking (e.g. ['action', 'role'])
 */
export function maskObject(
  data:     unknown,
  skipKeys: string[] = ['action', 'role', 'resource', 'method', 'url', 'status'],
): unknown {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map((item) => maskObject(item, skipKeys));
  }

  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (skipKeys.includes(key)) {
        result[key] = value;
      } else {
        result[key] = maskObject(value, skipKeys);
      }
    }
    return result;
  }

  if (typeof data === 'string') {
    return maskPii(data);
  }

  return data;
}

/**
 * Determine which PII types were detected in a string (for audit metadata).
 */
export function detectPiiTypes(input: string): string[] {
  const detected: string[] = [];
  for (const rule of PII_RULES) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(input)) {
      detected.push(rule.name);
    }
  }
  return detected;
}
