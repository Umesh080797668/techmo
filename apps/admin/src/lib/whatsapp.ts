/**
 * WhatsApp utilities — build pre-filled wa.me deep-links for TechMo staff.
 */

/** Store owner / manager WhatsApp number (no + prefix). */
export const STORE_WHATSAPP = '94704124816';

/** Open a pre-filled WhatsApp chat. */
export function openWhatsApp(phone: string, message: string) {
  const digits = phone.replace(/\D/g, '');
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${digits}?text=${encoded}`, '_blank');
}

/** Build a repair status notification WhatsApp link. */
export function repairStatusWhatsApp(
  phone: string,
  customerName: string,
  ticketNumber: string,
  device: string,
  status: string,
  qrToken: string,
  marketingUrl = 'https://techmo.lk',
): string {
  const statusLabel = status.replace(/_/g, ' ');
  const trackingUrl = `${marketingUrl}/track/${qrToken}`;
  const msg =
    `Hi ${customerName} 👋\n\n` +
    `Your *${device}* repair (${ticketNumber}) status is now:\n` +
    `✅ *${statusLabel}*\n\n` +
    `Track live: ${trackingUrl}\n\n` +
    `_TechMo Electronics — Professional Repair Service_`;
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
}

/** Build a review request WhatsApp link for a completed repair. */
export function repairReviewWhatsApp(
  phone: string,
  customerName: string,
  ticketNumber: string,
  device: string,
): string {
  const msg =
    `Hi ${customerName} 😊\n\n` +
    `Your *${device}* has been repaired! (${ticketNumber})\n\n` +
    `We'd love to hear your feedback — please leave us a quick Google Review:\n` +
    `👉 https://g.page/r/techmo/review\n\n` +
    `Thank you for choosing TechMo! 🙏`;
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
}

/** Build a device upgrade reminder WhatsApp link. */
export function upgradeReminderWhatsApp(
  phone: string,
  customerName: string,
  device: string,
  tradeInValue: number,
): string {
  const msg =
    `Hi ${customerName} 📱\n\n` +
    `It's been a while since you got your *${device}*!\n\n` +
    `💰 Estimated trade-in value: *LKR ${tradeInValue.toLocaleString()}*\n\n` +
    `Visit TechMo today to explore the latest upgrades and get the best deal! 🚀\n` +
    `📍 techmo.lk`;
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
}

/**
 * Build a courier dispatch notification WhatsApp link.
 * Sent by staff after saving the tracking number — gives the customer their
 * sign-on-delivery link so they can confirm receipt via the tracking page.
 */
export function courierDispatchWhatsApp(
  phone: string,
  customerName: string,
  ticketNumber: string,
  device: string,
  carrier: string,
  trackingNumber: string,
  qrToken: string,
  marketingUrl = 'https://techmo.lk',
): string {
  const trackUrl = `${marketingUrl}/track/${qrToken}`;
  const carrierLabel: Record<string, string> = {
    slpost: 'Sri Lanka Post',
    dhl: 'DHL Express',
    fedex: 'FedEx',
    '17track': '17TRACK',
  };
  const carrierName = carrierLabel[carrier] ?? carrier.toUpperCase();
  const msg =
    `Hi ${customerName} 👋\n\n` +
    `Great news! Your *${device}* repair (${ticketNumber}) is complete and has been dispatched via *${carrierName}*.\n\n` +
    `📦 Tracking: *${trackingNumber}*\n\n` +
    `Once you receive your device, please open the link below and sign to confirm delivery:\n` +
    `👉 ${trackUrl}\n\n` +
    `_TechMo Electronics — Professional Repair Service_`;
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
}

/** Build an abandoned reservation follow-up WhatsApp link. */
export function reservationFollowUpWhatsApp(
  phone: string,
  customerName: string,
  productName: string,
  expiresAt: string,
): string {
  const msg =
    `Hi ${customerName} 👋\n\n` +
    `Just a reminder — you have a reservation for *${productName}* at TechMo.\n\n` +
    `⏳ Reservation expires: ${expiresAt}\n\n` +
    `Come in soon to claim your device before we release it! 📦\n` +
    `📞 Call us: +94704124816`;
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
}
