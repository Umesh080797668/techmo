"""
Microsoft Phi-3 Mini Local LLM Integration — worker-service
=============================================================
Runs Microsoft Phi-3-mini-4k-instruct (Q4 GGUF) locally via llama-cpp-python.
Model is downloaded automatically from HuggingFace Hub on first use.

Features:
  1. Repair Sentiment Analysis
  2. Audit Log Summarisation
  3. Repair Advice

Environment variables:
  PHI3_MODEL_PATH    — path to GGUF file (default: /app/models/phi3-mini.gguf)
  PHI3_MODEL_REPO    — HuggingFace repo  (default: microsoft/Phi-3-mini-4k-instruct-gguf)
  PHI3_MODEL_FILE    — filename in repo  (default: Phi-3-mini-4k-instruct-q4.gguf)
  PHI3_N_CTX         — context window   (default: 4096)
  PHI3_N_THREADS     — CPU threads      (default: 4)
  PHI3_N_GPU_LAYERS  — GPU layers       (default: 0 = CPU-only)
"""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
from typing import Literal

logger = logging.getLogger(__name__)

# ─── Robust JSON extraction ───────────────────────────────────────────────────

def _extract_json(raw: str) -> dict:
    """
    Robustly extract a JSON object from raw LLM output.
    Handles:
      - Preamble text before the opening brace ("Sure! Here is:\n{...}")
      - Trailing commentary after the closing brace
      - Double-quoted keys like  ""confidence"  →  "confidence"
      - Truncated JSON (missing closing brace)
    Raises ValueError if no JSON object can be found.
    """
    # 1. Find first '{' … last '}'
    start = raw.find('{')
    end   = raw.rfind('}')
    if start == -1:
        raise ValueError("No JSON object found in LLM output")
    # If truncated (no closing brace) try adding one
    fragment = raw[start:] if end == -1 else raw[start:end + 1]

    # 2. Fix double-quote artifact: ""key" → "key"  (LLM sometimes wraps key names in double quotes)
    fragment = re.sub(r'""(\w+)"', r'"\1"', fragment)

    # 3. Attempt parse — if still broken, try stripping trailing incomplete member
    try:
        return json.loads(fragment)
    except json.JSONDecodeError:
        # Remove last partial key-value pair and close the object
        trimmed = re.sub(r',\s*"[^"]*"\s*:[^}]*$', '', fragment)
        if not trimmed.endswith('}'):
            trimmed += '}'
        return json.loads(trimmed)  # let this raise if still broken

# ─── Config ───────────────────────────────────────────────────────────────────

PHI3_MODEL_PATH:    str = os.getenv("PHI3_MODEL_PATH",    "/app/models/llama-3.2-1b.gguf")
PHI3_MODEL_REPO:    str = os.getenv("PHI3_MODEL_REPO",    "bartowski/Llama-3.2-1B-Instruct-GGUF")
PHI3_MODEL_FILE:    str = os.getenv("PHI3_MODEL_FILE",    "Llama-3.2-1B-Instruct-Q4_K_M.gguf")
PHI3_N_CTX:         int = int(os.getenv("PHI3_N_CTX",     "2048"))
PHI3_N_THREADS:     int = int(os.getenv("PHI3_N_THREADS",  "4"))
PHI3_N_GPU_LAYERS:  int = int(os.getenv("PHI3_N_GPU_LAYERS", "0"))

_llm = None  # module-level singleton

# ─── Model bootstrap ──────────────────────────────────────────────────────────

def _ensure_model_downloaded() -> None:
    """Download Phi-3 Mini GGUF from HuggingFace if not already present."""
    if os.path.exists(PHI3_MODEL_PATH):
        return
    logger.info("Downloading Phi-3 Mini from HuggingFace: %s/%s …", PHI3_MODEL_REPO, PHI3_MODEL_FILE)
    try:
        from huggingface_hub import hf_hub_download  # type: ignore
        model_dir = os.path.dirname(PHI3_MODEL_PATH) or "."
        os.makedirs(model_dir, exist_ok=True)
        downloaded = hf_hub_download(
            repo_id=PHI3_MODEL_REPO,
            filename=PHI3_MODEL_FILE,
            local_dir=model_dir,
            local_dir_use_symlinks=False,
        )
        # Move to canonical path if hub placed it under a sub-dir
        if os.path.abspath(downloaded) != os.path.abspath(PHI3_MODEL_PATH):
            shutil.move(downloaded, PHI3_MODEL_PATH)
        logger.info("Phi-3 Mini model ready at %s", PHI3_MODEL_PATH)
    except Exception as exc:
        logger.error("Model download failed: %s", exc)
        raise


def _get_llm():
    """Lazily load the Phi-3 Mini model; downloads on first call if needed."""
    global _llm
    if _llm is None:
        try:
            from llama_cpp import Llama  # type: ignore
            _ensure_model_downloaded()
            _llm = Llama(
                model_path=PHI3_MODEL_PATH,
                n_ctx=PHI3_N_CTX,
                n_threads=PHI3_N_THREADS,
                n_gpu_layers=PHI3_N_GPU_LAYERS,
                verbose=False,
                chat_format="llama-3",
            )
            logger.info("Llama-3.2-1B loaded from %s", PHI3_MODEL_PATH)
        except ImportError:
            logger.warning("llama-cpp-python not installed — AI features disabled")
            _llm = None
        except Exception as exc:
            logger.error("Failed to load Phi-3 Mini: %s", exc)
            _llm = None
    return _llm


# ─── Low-level helper ─────────────────────────────────────────────────────────

async def _generate(user_prompt: str, system: str = "") -> str:
    """Run a single-turn chat completion with Phi-3 Mini (synchronous in thread)."""
    import asyncio

    def _run() -> str:
        llm = _get_llm()
        if llm is None:
            raise RuntimeError("Phi-3 Mini is not loaded")
        messages: list[dict] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": user_prompt})
        resp = llm.create_chat_completion(
            messages=messages,
            max_tokens=512,
            temperature=0.1,
            stop=["<|end|>", "<|endoftext|>"],
        )
        return resp["choices"][0]["message"]["content"].strip()

    # Run CPU-bound inference in a thread pool so we don't block the event loop
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _run)


async def _is_available() -> bool:
    """Return True if the Phi-3 Mini GGUF file exists (model ready)."""
    return os.path.exists(PHI3_MODEL_PATH)


# ─── Feature 1: Repair Sentiment Analysis ─────────────────────────────────────

SentimentLabel = Literal["positive", "neutral", "negative"]

async def analyse_repair_sentiment(
    technician_notes: str,
    customer_complaint: str | None = None,
) -> dict:
    """
    Analyse the sentiment of a repair interaction.

    Returns:
        {
          "sentiment": "positive" | "neutral" | "negative",
          "confidence": 0.0–1.0,
          "summary": "One sentence summary of the interaction",
          "flags": ["warranty_dispute", "repeat_fault", ...]  // optional risk flags
        }
    """
    if not await _is_available():
        llm_check = _get_llm()
        if llm_check is None:
            return {"sentiment": "neutral", "confidence": 0.0, "summary": "Phi-3 Mini model is still downloading — check docker logs techmo-worker for progress.", "flags": []}

    combined = f"Technician notes: {technician_notes}"
    if customer_complaint:
        combined += f"\n\nCustomer complaint: {customer_complaint}"

    system = (
        "You are a repair shop sentiment analyser. "
        "Analyse the provided repair interaction text and respond ONLY with valid JSON "
        "matching this schema: "
        '{"sentiment":"positive"|"neutral"|"negative","confidence":number,"summary":"string","flags":["string"]}'
        " Do not include any text outside the JSON object."
    )

    raw = await _generate(combined, system=system)

    try:
        result = _extract_json(raw)
        # Validate shape
        if "sentiment" not in result:
            raise ValueError("Missing sentiment key")
        # Normalise confidence to 0-1 range (model sometimes returns 0-100)
        conf = float(result.get("confidence", 0))
        if conf > 1.0:
            conf = conf / 100
        result["confidence"] = round(conf, 2)
        return result
    except (json.JSONDecodeError, ValueError):
        # Graceful degradation — return neutral if LLM output is malformed
        return {
            "sentiment": "neutral",
            "confidence": 0.0,
            "summary": "AI could not parse the repair notes. Please check the technician notes for clarity.",
            "flags": [],
        }


# ─── Feature 2: Audit Log Summarisation ──────────────────────────────────────

async def summarise_audit_logs(log_entries: list) -> str:
    """
    Condense a list of audit log entries into a human-readable paragraph.

    Args:
        log_entries: List of pre-formatted strings (sent from the admin frontend)
                     e.g. '[28/02/2026, 10:00] CREATE on Product (p123) by admin: note'

    Returns:
        A concise plain-text summary (2–4 sentences) suitable for a manager digest email.
    """
    if not await _is_available():
        llm_check = _get_llm()
        if llm_check is None:
            return f"⏳ Phi-3 Mini model is still downloading ({len(log_entries)} entries in view). Check progress: docker logs techmo-worker"

    if not log_entries:
        return "No audit log entries to summarise."

    # Limit to 20 entries — keeps prompt short and CPU inference fast
    truncated = log_entries[:20]
    # Entries are pre-formatted strings from the frontend — join them directly
    log_text = "\n".join(
        f"- {e}" if isinstance(e, str) else
        f"- [{e.get('timestamp', '?')}] {e.get('actor', '?')} → {e.get('action', '?')} on {e.get('target', '?')}"
        for e in truncated
    )

    system = (
        "You are a business audit summariser for a retail electronics shop. "
        "Given a list of system audit log entries, write a concise 2–4 sentence plain-text "
        "summary for a manager. Highlight unusual activity (excessive voids, permission overrides, "
        "stock adjustments after hours). Do not include any JSON or markdown."
    )

    return await _generate(log_text, system=system)


# ─── Feature 3: Repair Advice ────────────────────────────────────────────────

async def get_repair_advice(device_model: str, reported_fault: str) -> dict:
    """
    Suggest likely root causes and recommended parts for a given fault.

    Returns:
        {
          "likely_causes": ["string", ...],
          "recommended_parts": ["string", ...],
          "estimated_difficulty": "easy" | "moderate" | "hard",
          "notes": "string"
        }
    """
    if not await _is_available():
        llm_check = _get_llm()
        if llm_check is None:
            return {
                "likely_causes": [],
                "recommended_parts": [],
                "estimated_difficulty": "moderate",
                "notes": "Phi-3 Mini model is downloading in background. Check: docker logs techmo-worker",
            }

    prompt = f"Device: {device_model}\nFault: {reported_fault}"
    system = (
        "You are an expert mobile phone repair technician assistant. "
        "Given a device model and reported fault, respond ONLY with valid JSON matching: "
        '{"likely_causes":["string"],"recommended_parts":["string"],'
        '"estimated_difficulty":"easy"|"moderate"|"hard","notes":"string"}'
        " Keep responses concise and practical. Do not include text outside the JSON."
    )

    raw = await _generate(prompt, system=system)
    try:
        result = _extract_json(raw)
        # Ensure required arrays exist
        result.setdefault("likely_causes", [])
        result.setdefault("recommended_parts", [])
        result.setdefault("estimated_difficulty", "moderate")
        result.setdefault("notes", "")
        return result
    except (json.JSONDecodeError, ValueError):
        return {
            "likely_causes": [raw[:150]] if raw else [],
            "recommended_parts": [],
            "estimated_difficulty": "moderate",
            "notes": "AI returned an unparseable response — see likely_causes for raw output.",
        }
