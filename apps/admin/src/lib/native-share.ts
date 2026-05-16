/**
 * native-share.ts
 * ----------------
 * Web Share API wrapper for sharing repair completion PDFs and receipts
 * via the device's native share sheet (WhatsApp, SMS, AirDrop, etc.).
 *
 * This replaces the need for a WhatsApp Business API subscription for
 * "Repair Completed" notifications — staff simply tap Share on a tablet
 * and the device's native WhatsApp app opens with the PDF attached.
 *
 * Falls back to clipboard copy + toast on unsupported browsers.
 */

export interface ShareRepairPayload {
  ticketRef: string;
  customerName: string;
  device: string;
  pdfUrl: string;       // Cloudinary secure_url of the repair receipt PDF
  pdfBlob?: Blob;       // If provided, shares as a File attachment (requires HTTPS)
}

export interface ShareResult {
  method: 'native' | 'clipboard' | 'download' | 'unsupported';
  success: boolean;
  error?: string;
}

/**
 * Share a repair completion receipt via the Web Share API.
 *
 * @example
 * const result = await shareRepairReceipt({
 *   ticketRef: 'TK-456',
 *   customerName: 'Saman Perera',
 *   device: 'Samsung Galaxy S23',
 *   pdfUrl: 'https://res.cloudinary.com/techmo/raw/upload/techmo/receipts/TK-456.pdf',
 * });
 */
export async function shareRepairReceipt(payload: ShareRepairPayload): Promise<ShareResult> {
  const { ticketRef, customerName, device, pdfUrl, pdfBlob } = payload;

  const title = `Repair Receipt – ${ticketRef}`;
  const text  = `Hi ${customerName}! Your ${device} repair is complete. Here is your receipt from TechMo. Ref: #${ticketRef}`;

  // ── Attempt 1: native share with PDF file (requires HTTPS + FileShare support) ──
  if (navigator.share && pdfBlob) {
    try {
      const file = new File([pdfBlob], `TechMo-Receipt-${ticketRef}.pdf`, { type: 'application/pdf' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        return { method: 'native', success: true };
      }
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        // Fall through to URL share
      } else {
        return { method: 'native', success: false, error: 'User cancelled' };
      }
    }
  }

  // ── Attempt 2: native share with URL only ─────────────────────────────────
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url: pdfUrl });
      return { method: 'native', success: true };
    } catch (e: unknown) {
      if ((e as Error).name === 'AbortError') {
        return { method: 'native', success: false, error: 'User cancelled' };
      }
      // Fall through to clipboard
    }
  }

  // ── Attempt 3: copy Cloudinary URL to clipboard ───────────────────────────
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(`${text}\n\n${pdfUrl}`);
      return { method: 'clipboard', success: true };
    } catch {}
  }

  // ── Attempt 4: trigger browser download ──────────────────────────────────
  const a = document.createElement('a');
  a.href = pdfUrl;
  a.download = `TechMo-Receipt-${ticketRef}.pdf`;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return { method: 'download', success: true };
}

/**
 * Share a "Repair Completed" WhatsApp message pre-filled with the customer's number.
 * Useful when the PDF is not yet generated and you need an instant text notification.
 */
export function shareViaWhatsApp(
  phone: string,
  ticketRef: string,
  customerName: string,
  device: string,
  pdfUrl?: string,
): void {
  const msg = encodeURIComponent(
    `Hi ${customerName}! Your ${device} repair is complete at TechMo. Ref: #${ticketRef}` +
    (pdfUrl ? `\n\nReceipt: ${pdfUrl}` : '') +
    ' — Thank you for choosing TechMo! 🙏',
  );
  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank', 'noopener');
}

/** Check if native share is available (for rendering a "Share" vs "Copy Link" button) */
export function isNativeShareAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share;
}

/** Fetch a PDF from a URL and return its Blob (for file-share) */
export async function fetchPdfBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}
