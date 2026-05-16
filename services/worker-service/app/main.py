from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from app.routers import pdf, qr, health, telegram, email, ollama
from app.video import router as video_router
from app.worker import start_worker

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_worker()
    # Model is already downloaded by entrypoint.sh before uvicorn starts.
    # Trigger lazy load now so first AI request is fast.
    try:
        from app.ollama import _get_llm
        _get_llm()   # loads model into RAM at startup (no download needed here)
        logger.info("Llama-3.2-1B loaded and ready ✓")
    except Exception as exc:
        logger.warning("Phi-3 Mini load skipped: %s", exc)
    yield

app = FastAPI(
    title="TechMo Worker Service",
    description="Async PDF generation, QR codes, Cloudinary media upload, Telegram notifications",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["Health"])
app.include_router(pdf.router, prefix="/api/v1/worker/pdf", tags=["PDF"])
app.include_router(qr.router, prefix="/api/v1/worker/qr", tags=["QR Code"])
app.include_router(telegram.router, prefix="/api/v1/worker/telegram", tags=["Telegram"])
app.include_router(email.router, prefix="/api/email", tags=["Email"])
app.include_router(ollama.router, prefix="/api/v1/worker/ai", tags=["AI/Ollama"])
app.include_router(video_router, prefix="/api/v1/worker", tags=["Video"])
