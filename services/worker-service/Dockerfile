# ── builder ──────────────────────────────────────────────────────────────────
FROM python:3.11-slim-bookworm AS builder
RUN apt-get update && apt-get install -y \
  libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 \
  libcairo2 libgdk-pixbuf-2.0-0 libffi-dev libxml2 libxslt1.1 \
  fonts-liberation fonts-dejavu \
  cmake g++ build-essential libopenblas-dev \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
# Install everything except llama-cpp-python / huggingface_hub first (faster layer cache)
RUN grep -v '^\s*#' requirements.txt | grep -v '^\s*$' | grep -v 'llama-cpp-python\|huggingface_hub' \
    | xargs pip install --no-cache-dir
# Compile llama-cpp-python from source (CPU-only, glibc-safe for Debian/bookworm)
RUN CMAKE_ARGS="-DLLAMA_BLAS=ON -DLLAMA_BLAS_VENDOR=OpenBLAS" \
    pip install --no-cache-dir --no-binary llama-cpp-python \
    llama-cpp-python==0.2.90 huggingface_hub==0.22.2

# ── runner ────────────────────────────────────────────────────────────────────
FROM python:3.11-slim-bookworm
RUN apt-get update && apt-get install -y \
  libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 \
  libcairo2 libgdk-pixbuf-2.0-0 libffi-dev libxml2 libxslt1.1 \
  fonts-liberation fonts-dejavu \
  libopenblas0 libgomp1 \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN mkdir -p /app/models
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY . .
RUN chmod +x /app/entrypoint.sh
EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
