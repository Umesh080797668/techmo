"""Telegram Bot notification service for TechMo customer communication."""
import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

TELEGRAM_API = "https://api.telegram.org/bot{token}"


def _bot_url(path: str) -> str:
    return f"https://api.telegram.org/bot{settings.telegram_bot_token}/{path}"


async def send_message(chat_id: str, text: str, parse_mode: str = "HTML") -> dict:
    """Send a Telegram message to a chat/user."""
    if not settings.telegram_bot_token:
        logger.warning("Telegram bot token not configured — skipping message send")
        return {"ok": False, "description": "Bot not configured"}

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            _bot_url("sendMessage"),
            json={"chat_id": chat_id, "text": text, "parse_mode": parse_mode},
        )
        resp.raise_for_status()
        return resp.json()


async def send_repair_status_update(
    chat_id: str,
    ticket_number: str,
    customer_name: str,
    device: str,
    status: str,
    qr_token: str,
) -> dict:
    """Pre-formatted repair status notification via Telegram."""
    status_emoji = {
        "PENDING_DIAGNOSIS": "🔍",
        "AWAITING_PARTS": "📦",
        "UNDER_REPAIR": "🔧",
        "READY_FOR_PICKUP": "✅",
        "COMPLETED": "🎉",
        "CANCELLED": "❌",
    }.get(status, "📋")

    status_label = status.replace("_", " ").title()
    tracking_url = f"{settings.marketing_url}/track/{qr_token}"

    text = (
        f"<b>TechMo Repair Update</b> {status_emoji}\n\n"
        f"Hi <b>{customer_name}</b>! Your repair is now:\n"
        f"<b>{status_label}</b>\n\n"
        f"📱 Device: {device}\n"
        f"🎫 Ticket: <code>{ticket_number}</code>\n\n"
        f"🔗 Track live: {tracking_url}\n\n"
        f"<i>TechMo Electronics — Professional Repair Service</i>"
    )

    return await send_message(chat_id, text)


async def send_upgrade_reminder(
    chat_id: str,
    customer_name: str,
    device: str,
    months_owned: int,
    trade_in_value: float,
) -> dict:
    """Device upgrade reminder push via Telegram."""
    text = (
        f"<b>Upgrade Reminder 📱</b>\n\n"
        f"Hi <b>{customer_name}</b>!\n"
        f"You've had your <b>{device}</b> for {months_owned} months.\n\n"
        f"💰 Estimated trade-in value: <b>LKR {trade_in_value:,.0f}</b>\n\n"
        f"Visit TechMo today to explore the latest upgrades and get the best deal! 🚀\n"
        f"📍 <a href='https://techmo.lk'>techmo.lk</a>"
    )
    return await send_message(chat_id, text)


async def get_webhook_info() -> dict:
    """Get Telegram webhook configuration."""
    if not settings.telegram_bot_token:
        return {"ok": False, "description": "Bot not configured"}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(_bot_url("getWebhookInfo"))
        return resp.json()


async def set_webhook(webhook_url: str) -> dict:
    """Register a webhook URL with Telegram."""
    if not settings.telegram_bot_token:
        return {"ok": False, "description": "Bot not configured"}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            _bot_url("setWebhook"),
            json={"url": webhook_url},
        )
        return resp.json()
