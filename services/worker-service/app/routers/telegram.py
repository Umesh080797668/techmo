"""Telegram Bot router — send notifications and handle incoming webhooks."""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional
from app.services.telegram_service import (
    send_message,
    send_repair_status_update,
    send_upgrade_reminder,
    get_webhook_info,
    set_webhook,
)

router = APIRouter()


class SendMessageRequest(BaseModel):
    chat_id: str
    text: str
    parse_mode: str = "HTML"


class RepairStatusRequest(BaseModel):
    chat_id: str
    ticket_number: str
    customer_name: str
    device: str
    status: str
    qr_token: str


class UpgradeReminderRequest(BaseModel):
    chat_id: str
    customer_name: str
    device: str
    months_owned: int
    trade_in_value: float


@router.post("/send")
async def send(request: SendMessageRequest):
    """Send an arbitrary Telegram message to a chat."""
    return await send_message(request.chat_id, request.text, request.parse_mode)


@router.post("/repair-status")
async def repair_status(request: RepairStatusRequest):
    """Send a formatted repair status update to a Telegram chat."""
    return await send_repair_status_update(
        chat_id=request.chat_id,
        ticket_number=request.ticket_number,
        customer_name=request.customer_name,
        device=request.device,
        status=request.status,
        qr_token=request.qr_token,
    )


@router.post("/upgrade-reminder")
async def upgrade_reminder(request: UpgradeReminderRequest):
    """Send a device upgrade reminder to a customer via Telegram."""
    return await send_upgrade_reminder(
        chat_id=request.chat_id,
        customer_name=request.customer_name,
        device=request.device,
        months_owned=request.months_owned,
        trade_in_value=request.trade_in_value,
    )


@router.get("/webhook-info")
async def webhook_info():
    """Get current Telegram webhook configuration."""
    return await get_webhook_info()


@router.post("/set-webhook")
async def configure_webhook(webhook_url: str):
    """Register a public HTTPS URL as the Telegram bot webhook."""
    return await set_webhook(webhook_url)


@router.post("/webhook")
async def handle_webhook(request: Request):
    """
    Receive incoming Telegram webhook events (user messages to the bot).
    Commands:
      /start  — register chat_id for this customer account
      /status <ticket_number>  — quick status lookup
    """
    body = await request.json()
    message = body.get("message", {})
    chat_id = str(message.get("chat", {}).get("id", ""))
    text = message.get("text", "").strip()

    if not chat_id or not text:
        return {"ok": True}

    # Handle /start command
    if text.startswith("/start"):
        await send_message(
            chat_id,
            "👋 <b>Welcome to TechMo Bot!</b>\n\n"
            "You'll receive repair status notifications here.\n\n"
            "Commands:\n"
            "• <code>/status RPR-2024-00001</code> — check repair status\n\n"
            "<i>To link your account, share this chat ID with our staff: "
            f"<code>{chat_id}</code></i>",
        )

    # Handle /status <ticket_number>
    elif text.startswith("/status"):
        parts = text.split(maxsplit=1)
        await send_message(
            chat_id,
            f"🔍 Looking up ticket <code>{parts[1] if len(parts) > 1 else '?'}</code>...\n"
            f"Visit <a href='https://techmo.lk/track'>techmo.lk/track</a> for live status.",
        )

    return {"ok": True}
