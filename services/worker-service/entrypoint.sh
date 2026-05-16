#!/bin/bash
set -e

MODEL_PATH="${PHI3_MODEL_PATH:-/app/models/llama-3.2-1b.gguf}"
MODEL_REPO="${PHI3_MODEL_REPO:-bartowski/Llama-3.2-1B-Instruct-GGUF}"
MODEL_FILE="${PHI3_MODEL_FILE:-Llama-3.2-1B-Instruct-Q4_K_M.gguf}"

if [ ! -f "$MODEL_PATH" ]; then
    echo "[worker] Llama-3.2-1B model not found at $MODEL_PATH"
    echo "[worker] Downloading ~770 MB from HuggingFace (one-time, cached in Docker volume) ..."
    python - <<PYEOF
import os, sys, time, urllib.request, shutil
from huggingface_hub import hf_hub_url

model_path = os.environ.get("PHI3_MODEL_PATH", "/app/models/llama-3.2-1b.gguf")
model_repo = os.environ.get("PHI3_MODEL_REPO", "bartowski/Llama-3.2-1B-Instruct-GGUF")
model_file = os.environ.get("PHI3_MODEL_FILE", "Llama-3.2-1B-Instruct-Q4_K_M.gguf")
tmp_path   = model_path + ".tmp"

os.makedirs(os.path.dirname(model_path) or ".", exist_ok=True)

# Resolve the direct CDN download URL (no auth needed for public models)
url = hf_hub_url(repo_id=model_repo, filename=model_file)
print(f"[worker] Resolved URL, starting download ...", flush=True)

CHUNK  = 4 * 1024 * 1024   # 4 MB chunks
REPORT = 15                 # print a line every 15 seconds

start = time.time()
last_report = start
downloaded  = 0

try:
    req = urllib.request.Request(url, headers={"User-Agent": "huggingface_hub/0.22"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        total = int(resp.headers.get("Content-Length", 0))
        total_mb = total / 1024 / 1024
        print(f"[worker] File size: {total_mb:.0f} MB", flush=True)

        with open(tmp_path, "wb") as f:
            while True:
                chunk = resp.read(CHUNK)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)

                now = time.time()
                if now - last_report >= REPORT:
                    pct     = downloaded / total * 100 if total else 0
                    speed   = downloaded / (now - start) / 1024 / 1024
                    eta_sec = (total - downloaded) / (downloaded / (now - start)) if downloaded else 0
                    eta_min = eta_sec / 60
                    print(
                        f"[worker] {downloaded/1024/1024:.0f} / {total_mb:.0f} MB  "
                        f"({pct:.1f}%)  {speed:.1f} MB/s  ETA ~{eta_min:.0f} min",
                        flush=True
                    )
                    last_report = now

    shutil.move(tmp_path, model_path)
    elapsed = (time.time() - start) / 60
    size_mb = os.path.getsize(model_path) / 1024 / 1024
    print(f"[worker] ✓ Download complete: {size_mb:.0f} MB in {elapsed:.1f} min", flush=True)

except Exception as e:
    if os.path.exists(tmp_path):
        os.remove(tmp_path)
    print(f"[worker] ✗ Download failed: {e}", flush=True)
    print("[worker]   AI features will be degraded. Continuing server startup ...", flush=True)
PYEOF
else
    echo "[worker] ✓ Llama-3.2-1B found ($(du -sh $MODEL_PATH | cut -f1)) — skipping download."
fi

exec "$@"
