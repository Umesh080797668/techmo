"""Email notification router — sends low-stock alerts and other transactional emails."""

import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class LowStockAlertPayload(BaseModel):
    sku: str
    productId: Optional[str] = None
    currentQty: int
    threshold: int
    location: Optional[str] = "Main Store"


def _send_email(subject: str, html_body: str, text_body: str) -> None:
    """Send an email via SMTP using settings from config. Raises on failure."""
    if not settings.smtp_user or not settings.smtp_pass:
        logger.warning("SMTP credentials not configured — skipping email send")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.from_email
    msg["To"] = settings.alert_email

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_pass)
        server.sendmail(settings.from_email, [settings.alert_email], msg.as_string())

    logger.info(f"Email sent: {subject} → {settings.alert_email}")


@router.post("/low-stock")
async def low_stock_alert(payload: LowStockAlertPayload):
    """
    Called by the inventory-service whenever a product's quantity drops at or
    below its low-stock threshold.  Sends an email alert to the configured
    ALERT_EMAIL address.
    """
    subject = f"⚠️ Low Stock Alert — {payload.sku}"

    now_str = datetime.now().strftime("%d %b %Y %H:%M")

    html_body = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: Arial, sans-serif; background: #f8fafc; margin: 0; padding: 20px; }}
    .card {{ background: #fff; border-radius: 12px; padding: 32px; max-width: 560px;
             margin: 0 auto; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }}
    .badge {{ display: inline-block; background: #fee2e2; color: #dc2626;
              font-weight: 700; padding: 4px 12px; border-radius: 20px; font-size: 13px; }}
    .row {{ display: flex; justify-content: space-between; padding: 8px 0;
            border-bottom: 1px solid #f1f5f9; font-size: 14px; }}
    .label {{ color: #64748b; }}
    .value {{ font-weight: 600; color: #1e293b; }}
    .footer {{ margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center; }}
  </style>
</head>
<body>
  <div class="card">
    <div style="margin-bottom:20px;">
      <span class="badge">⚠️ Low Stock</span>
    </div>
    <h2 style="color:#1e293b;margin:0 0 8px 0;">Stock Level Critical</h2>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px 0;">
      The following item has fallen at or below its minimum threshold.
    </p>
    <div>
      <div class="row"><span class="label">SKU</span><span class="value">{payload.sku}</span></div>
      <div class="row"><span class="label">Current Quantity</span>
        <span class="value" style="color:#dc2626;">{payload.currentQty} units</span></div>
      <div class="row"><span class="label">Minimum Threshold</span>
        <span class="value">{payload.threshold} units</span></div>
      <div class="row"><span class="label">Location</span>
        <span class="value">{payload.location}</span></div>
      <div class="row" style="border:none;"><span class="label">Detected At</span>
        <span class="value">{now_str}</span></div>
    </div>
    <div style="margin-top:24px;padding:16px;background:#fff7ed;border-radius:8px;
                border-left:4px solid #f97316;font-size:13px;color:#9a3412;">
      <strong>Action Required:</strong> Please replenish stock for <strong>{payload.sku}</strong>
      as soon as possible to avoid stockouts.
    </div>
    <div class="footer">TechMo Electronics · Automated Stock Monitor</div>
  </div>
</body>
</html>
"""

    text_body = (
        f"LOW STOCK ALERT\n"
        f"SKU: {payload.sku}\n"
        f"Current Quantity: {payload.currentQty} units\n"
        f"Minimum Threshold: {payload.threshold} units\n"
        f"Location: {payload.location}\n"
        f"Detected: {now_str}\n\n"
        f"Please replenish stock as soon as possible."
    )

    try:
        _send_email(subject, html_body, text_body)
    except Exception as exc:
        logger.error(f"Failed to send low-stock email for {payload.sku}: {exc}")
        raise HTTPException(status_code=500, detail=f"Email send failed: {str(exc)}")

    return {"ok": True, "sku": payload.sku, "alertSentTo": settings.alert_email}
