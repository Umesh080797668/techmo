import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    redis_url: str = "redis://localhost:6379"
    # Cloudinary (replaces local disk persistence for PDFs and QR images)
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    cloudinary_upload_preset: str = "techmo_uploads"
    # Temp directory — files are uploaded then the local copy can be purged
    generated_dir: str = "/app/generated"
    port: int = 8000

    # Telegram Bot (Customer Communication)
    telegram_bot_token: Optional[str] = None
    telegram_bot_username: Optional[str] = None

    # Store owner / manager contact
    store_whatsapp: str = "94704124816"

    # Marketing / public URL (for QR sticker links)
    marketing_url: str = "https://techmo.lk"

    # Healthchecks.io ping URL (backup watchdog)
    healthchecks_ping_url: Optional[str] = None

    # ─── Email / SMTP ────────────────────────────────────────────────────────
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_pass: Optional[str] = None
    from_email: str = "umeshbandara08@gmail.com"
    alert_email: str = "education02.imantha@gmail.com"   # destination for low-stock alerts

    class Config:
        env_file = ".env"


settings = Settings()
os.makedirs(settings.generated_dir, exist_ok=True)
