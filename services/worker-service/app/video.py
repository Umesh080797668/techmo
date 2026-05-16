"""
Repair Video Upload Router — Worker Service
============================================
FastAPI router that handles multipart video uploads from the Admin UI
(RepairVideoCapture.tsx) and stores them in Cloudinary.

Mount in main.py:
    from app.video import router as video_router
    app.include_router(video_router, prefix="/api/v1/worker")

Cloudinary path: techmo_uploads/repair-videos/{ticketRef}.{ext}

Environment variables required:
    CLOUDINARY_CLOUD_NAME
    CLOUDINARY_API_KEY
    CLOUDINARY_API_SECRET
"""

from __future__ import annotations

import hashlib
import hmac
import os
import time
from typing import Annotated

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ── Cloudinary config ─────────────────────────────────────────────────────────

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME", ""),
    api_key=os.getenv("CLOUDINARY_API_KEY", ""),
    api_secret=os.getenv("CLOUDINARY_API_SECRET", ""),
    secure=True,
)

# ── Router ─────────────────────────────────────────────────────────────────────

router = APIRouter(tags=["video"])

# ── Response model ────────────────────────────────────────────────────────────

class VideoUploadResponse(BaseModel):
    url:        str
    publicId:   str
    ticketRef:  str
    duration:   float | None = None
    format:     str | None   = None


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/upload-repair-video", response_model=VideoUploadResponse)
async def upload_repair_video(
    file:      Annotated[UploadFile, File(description="WebM/MP4 video file, max 50 MB")],
    ticketRef: Annotated[str,        Form(description="Repair ticket reference, e.g. TKT-0042")],
) -> JSONResponse:
    """
    Upload a post-repair proof-of-function video to Cloudinary.

    - Validates MIME type (video/webm or video/mp4 only)
    - Max file size: 50 MB
    - Stored at: techmo_uploads/repair-videos/{ticketRef}
    - Returns the Cloudinary secure URL
    """
    # ── Validate MIME type
    allowed_mimes = {"video/webm", "video/mp4", "video/quicktime"}
    content_type  = file.content_type or ""
    if content_type not in allowed_mimes:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported media type '{content_type}'. Use video/webm or video/mp4.",
        )

    # ── Read file into memory (limit: 50 MB)
    MAX_SIZE = 50 * 1024 * 1024
    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Video file exceeds 50 MB limit")

    # ── Sanitise ticketRef for use as Cloudinary public_id
    safe_ref = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in ticketRef)
    public_id = f"techmo_uploads/repair-videos/{safe_ref}"

    # ── Upload to Cloudinary
    try:
        result = cloudinary.uploader.upload(
            data,
            public_id=public_id,
            resource_type="video",
            overwrite=True,         # replace previous video for the same ticket
            format="mp4",           # transcode WebM → MP4 for broader compatibility
            transformation=[
                {"quality": "auto:good"},
                {"fetch_format": "auto"},
            ],
            tags=["repair-proof", safe_ref],
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Cloudinary upload failed: {exc}") from exc

    return JSONResponse(
        status_code=200,
        content={
            "url":       result.get("secure_url", ""),
            "publicId":  result.get("public_id", ""),
            "ticketRef": ticketRef,
            "duration":  result.get("duration"),
            "format":    result.get("format"),
        },
    )


@router.delete("/repair-video/{ticket_ref}")
async def delete_repair_video(ticket_ref: str) -> JSONResponse:
    """
    Delete a previously uploaded repair video (e.g. if ticket is voided).
    Only callable from internal services (no public exposure via gateway).
    """
    safe_ref  = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in ticket_ref)
    public_id = f"techmo_uploads/repair-videos/{safe_ref}"

    try:
        result = cloudinary.uploader.destroy(public_id, resource_type="video")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if result.get("result") != "ok":
        raise HTTPException(status_code=404, detail=f"Video not found for ticket {ticket_ref}")

    return JSONResponse({"deleted": True, "ticketRef": ticket_ref})
