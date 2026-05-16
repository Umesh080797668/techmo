/**
 * Server-side WhatsApp deep-link builder for the API Gateway.
 *
 * Section 5.3 – WhatsApp Notifications  (ENTERPRISE_ECOMMERCE_SYSTEM.md)
 *
 * All functions return a `https://wa.me/...` deep-link URL.
 * The gateway never sends messages directly — it builds and returns the URL
 * so the authenticated admin client can open it in the browser.
 */

export type RepairStatus =
  | 'RECEIVED'
  | 'PENDING_DIAGNOSIS'
  | 'AWAITING_PARTS'
  | 'UNDER_REPAIR'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'CANCELLED';

// ── Status message templates ─────────────────────────────────────────────────

const STATUS_TEMPLATES: Record<RepairStatus, (ctx: StatusCtx) => string> = {
  RECEIVED: ({ name, ticket, device }) =>
    `Hi ${name}! 👋 We've received your *${device}* for repair.\n\nTicket: *${ticket}*\n\nWe'll start the diagnosis shortly and keep you updated. Thank you for choosing TechMo! 🙌`,

  PENDING_DIAGNOSIS: ({ name, ticket, device }) =>
    `Hi ${name}! 🔍 Our technician is currently diagnosing your *${device}*.\n\nTicket: *${ticket}*\n\nWe'll share an update with the repair estimate soon.`,

  AWAITING_PARTS: ({ name, ticket, device }) =>
    `Hi ${name}! 📦 We're waiting for parts to arrive for your *${device}* repair.\n\nTicket: *${ticket}*\n\nWe'll notify you as soon as the parts are in and repairs begin.`,

  UNDER_REPAIR: ({ name, ticket, device }) =>
    `Hi ${name}! 🔧 Great news — repairs have begun on your *${device}*!\n\nTicket: *${ticket}*\n\nOur technician is working on it now. We'll let you know when it's ready.`,

  READY_FOR_PICKUP: ({ name, ticket, device, trackUrl }) =>
    `Hi ${name}! ✅ Your *${device}* is repaired and ready for pickup!\n\nTicket: *${ticket}*\n\nPlease visit our service centre at your earliest convenience.${trackUrl ? `\n\n📍 Track your repair: ${trackUrl}` : ''}\n\nThank you for choosing TechMo! 💙`,

  COMPLETED: ({ name, ticket, device }) =>
    `Hi ${name}! 🎉 Thank you for picking up your *${device}*.\n\nTicket: *${ticket}*\n\nWe hope the repair meets your expectations. Don't hesitate to reach out if you need any help. — Team TechMo 💙`,

  CANCELLED: ({ name, ticket, device }) =>
    `Hi ${name}, your repair ticket *${ticket}* for *${device}* has been cancelled.\n\nIf this was unexpected or you have questions, please contact us and we'll be happy to help.`,
};

interface StatusCtx {
  name:      string;
  ticket:    string;
  device:    string;
  trackUrl?: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Builds a WhatsApp URL pre-filled with a repair status update message.
 */
export function buildRepairStatusLink(
  phone: string,
  customerName: string,
  ticketNumber: string,
  status: RepairStatus,
  device: string,
  trackingToken?: string,
): string {
  const trackUrl = trackingToken
    ? `${process.env.MARKETING_URL ?? 'https://techmo.lk'}/track/${trackingToken}`
    : undefined;

  const template = STATUS_TEMPLATES[status];
  const message  = template
    ? template({ name: customerName, ticket: ticketNumber, device, trackUrl })
    : `Hi ${customerName}, your repair ticket ${ticketNumber} has been updated to *${status}*.`;

  return buildWhatsAppLink(phone, message);
}

/**
 * Builds a WhatsApp URL pre-filled with a review request message.
 */
export function buildReviewRequestLink(
  phone: string,
  customerName: string,
  ticketNumber?: string,
): string {
  const REVIEW_URL =
    process.env.GOOGLE_REVIEW_URL ?? 'https://g.page/r/XXXXXXXXXXXXXXXX/review';

  const refNote = ticketNumber ? ` (Ref: ${ticketNumber})` : '';
  const message = [
    `Hi ${customerName}! 👋`,
    '',
    `Thank you for choosing TechMo for your recent repair${refNote}. We hope your device is working perfectly! 🙌`,
    '',
    `If you had a great experience, we'd love it if you could leave us a Google Review:`,
    '',
    `👉 ${REVIEW_URL}`,
    '',
    `Thank you — Team TechMo 💙`,
  ].join('\n');

  return buildWhatsAppLink(phone, message);
}

/**
 * Builds a WhatsApp URL pre-filled with a warranty expiry reminder.
 */
export function buildWarrantyExpiryLink(
  phone: string,
  customerName: string,
  deviceName: string,
  expiryDate: string,
): string {
  const message = [
    `Hi ${customerName}! ⚠️`,
    '',
    `This is a friendly reminder that the warranty on your *${deviceName}* expires on *${expiryDate}*.`,
    '',
    `Visit TechMo before expiry for a complimentary device checkup and to discuss extended coverage options.`,
    '',
    `📍 techmo.lk — Team TechMo 💙`,
  ].join('\n');

  return buildWhatsAppLink(phone, message);
}

/**
 * Builds a WhatsApp URL pre-filled with a device upgrade campaign message.
 */
export function buildUpgradeCampaignLink(
  phone: string,
  customerName: string,
  deviceName: string,
): string {
  const message = [
    `Hi ${customerName}! 📱`,
    '',
    `Thinking of upgrading your *${deviceName}*? TechMo has amazing trade-in offers this month!`,
    '',
    `Get the best value for your old device and a great deal on the latest models. 🌟`,
    '',
    `Visit us or reply here to find out more — Team TechMo 💙`,
  ].join('\n');

  return buildWhatsAppLink(phone, message);
}

/**
 * Builds a WhatsApp URL pre-filled with a reservation follow-up message.
 */
export function buildReservationFollowUpLink(
  phone: string,
  customerName: string,
  productName: string,
  reservedUntil: string,
): string {
  const message = [
    `Hi ${customerName}! 👋`,
    '',
    `Just a reminder that your reserved *${productName}* is available for pickup until *${reservedUntil}*.`,
    '',
    `Please visit us at your earliest convenience to complete the purchase. If you'd like to extend the reservation, just let us know!`,
    '',
    `— Team TechMo 💙`,
  ].join('\n');

  return buildWhatsAppLink(phone, message);
}

// ── Core helper ───────────────────────────────────────────────────────────────

/**
 * Constructs a wa.me deep-link from a phone number and message text.
 * Phone numbers are sanitised to digits only before embedding.
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  const sanitised = phone.replace(/\D/g, '');
  return `https://wa.me/${sanitised}?text=${encodeURIComponent(message)}`;
}
