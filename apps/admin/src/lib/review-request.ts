/**
 * Review request utility — builds a WhatsApp link asking the customer
 * to leave a Google Review after a completed repair.
 *
 * Section 5.7 of ENTERPRISE_ECOMMERCE_SYSTEM.md
 */

const GOOGLE_REVIEW_URL =
  process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL ??
  'https://g.page/r/XXXXXXXXXXXXXXXX/review';

/**
 * Builds a pre-filled WhatsApp deep-link that asks the customer to leave
 * a Google Review.  The link is opened in a new tab by the admin after
 * marking a repair as COMPLETED.
 *
 * @param phone       Customer mobile number, digits only (e.g. "94771234567")
 * @param name        Customer first name for personalisation
 * @param ticketRef   Repair ticket number for reference (e.g. "TM-20240601-001")
 */
export function buildReviewWhatsAppLink(
  phone: string,
  name: string,
  ticketRef?: string,
): string {
  const sanitised = phone.replace(/\D/g, '');
  const refNote   = ticketRef ? ` (Ref: ${ticketRef})` : '';

  const message = [
    `Hi ${name}! 👋`,
    ``,
    `Thank you for choosing TechMo for your recent repair${refNote}. We hope your device is working perfectly! 🙌`,
    ``,
    `If you had a great experience, we'd love it if you could spare a minute to leave us a Google Review — it means the world to our team 🌟`,
    ``,
    `👉 ${GOOGLE_REVIEW_URL}`,
    ``,
    `Thank you so much — Team TechMo 💙`,
  ].join('\n');

  return `https://wa.me/${sanitised}?text=${encodeURIComponent(message)}`;
}

/**
 * Programmatically opens the review WhatsApp link in a new browser tab.
 */
export function requestReview(
  phone: string,
  name: string,
  ticketRef?: string,
): void {
  window.open(buildReviewWhatsAppLink(phone, name, ticketRef), '_blank');
}
