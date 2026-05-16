from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import asyncio
import uuid
from app.ollama import (
    summarise_audit_logs, analyse_repair_sentiment, get_repair_advice,
    _is_available, PHI3_MODEL_PATH,
)

router = APIRouter()

# ─── In-memory job store ───────────────────────────────────────────────────────
# Inference runs in the SAME FastAPI process where the model is already loaded
# in RAM (by lifespan in main.py).  asyncio.create_task schedules the coroutine
# on the existing event loop; the CPU-bound llama.cpp call runs inside
# run_in_executor so it never blocks the event loop.  No RQ subprocess, no
# cold-load of the 770 MB model per job.
_ai_jobs: dict[str, dict] = {}


async def _run_job(job_id: str, coro) -> None:
    """Await an AI coroutine and store its result/error in _ai_jobs."""
    try:
        result = await coro
        _ai_jobs[job_id] = {"status": "done", "result": result}
    except Exception as exc:
        _ai_jobs[job_id] = {"status": "failed", "error": str(exc)}


# ─── Request models ────────────────────────────────────────────────────────────

class RepairSentimentRequest(BaseModel):
    technician_notes: str
    customer_complaint: str


class RepairAdviceRequest(BaseModel):
    device_model: str
    reported_fault: str


class AuditSummaryRequest(BaseModel):
    entries: List[str]


# ─── Routes ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def ai_status():
    available = await _is_available()
    return {"available": available, "model": "llama-3.2-1b", "path": PHI3_MODEL_PATH}


@router.get("/job/{job_id}")
async def get_job_result(job_id: str):
    """
    Poll for an async AI job result.
    Returns: { status: 'pending' | 'done' | 'failed', result?, error? }
    """
    job = _ai_jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found or expired")
    return job


@router.post("/repair-sentiment")
async def repair_sentiment(req: RepairSentimentRequest):
    if not await _is_available():
        return {"status": "done", "result": {
            "sentiment": "neutral", "confidence": 0.0,
            "summary": "⏳ Model still downloading — check: docker logs techmo-worker",
            "flags": [],
        }}
    job_id = str(uuid.uuid4())
    _ai_jobs[job_id] = {"status": "pending"}
    asyncio.create_task(
        _run_job(job_id, analyse_repair_sentiment(req.technician_notes, req.customer_complaint))
    )
    return {"jobId": job_id, "status": "queued"}


@router.post("/repair-advice")
async def repair_advice(req: RepairAdviceRequest):
    if not await _is_available():
        return {"status": "done", "result": {
            "likely_causes": [], "recommended_parts": [],
            "estimated_difficulty": "moderate",
            "notes": "⏳ Model still downloading — check: docker logs techmo-worker",
        }}
    job_id = str(uuid.uuid4())
    _ai_jobs[job_id] = {"status": "pending"}
    asyncio.create_task(
        _run_job(job_id, get_repair_advice(req.device_model, req.reported_fault))
    )
    return {"jobId": job_id, "status": "queued"}


@router.post("/summarise-audit-logs")
async def summarise_audit(req: AuditSummaryRequest):
    if not await _is_available():
        return {"status": "done", "result":
            f"⏳ Model still downloading ({len(req.entries)} entries). "
            f"Check: docker logs techmo-worker"}
    job_id = str(uuid.uuid4())
    _ai_jobs[job_id] = {"status": "pending"}
    asyncio.create_task(
        _run_job(job_id, summarise_audit_logs(req.entries))
    )
    return {"jobId": job_id, "status": "queued"}
