# ===================================================
# Dockerfile — LearnFlow Transcription Microservice
# ===================================================
# Build:  docker build -t learnflow-transcribe .
# Run:    docker run -p 8000:8000 learnflow-transcribe
# Env:    docker run -p 8000:8000 -e WHISPER_MODEL=small learnflow-transcribe

# ─── Stage 1: Base Image ──────────────────────────
# python:3.11-slim = ~150MB (vs 3.11-bullseye ~900MB)
FROM python:3.11-slim AS base

# Metadate
LABEL maintainer="LearnFlow Team"
LABEL description="Transcription microservice cu Whisper + FastAPI"

# Variabile de mediu pentru Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    # Whisper descarcă modelele în ~/.cache/whisper
    XDG_CACHE_HOME=/app/.cache \
    # Configurare serviciu (suprascrisă la runtime)
    WHISPER_MODEL=base \
    MAX_DURATION_SEC=3600 \
    MAX_FILE_SIZE_MB=500 \
    EXECUTOR_WORKERS=2 \
    CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"

# Port expus
EXPOSE 8000

# ─── Stage 2: System Dependencies ────────────────
FROM base AS system-deps

# Instalăm ffmpeg (inclusiv ffprobe) și yt-dlp dependencies
# --no-install-recommends reduce dimensiunea imaginii
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ─── Stage 3: Python Dependencies ────────────────
FROM system-deps AS python-deps

WORKDIR /app

# Copiem doar requirements.txt mai întâi (cache layer Docker)
COPY requirements.txt .

# Instalăm dependențele Python
# --no-cache-dir reduce dimensiunea imaginii cu ~100MB
RUN pip install --upgrade pip && \
    pip install --no-cache-dir \
        # CPU-only PyTorch — evităm pachetele CUDA (~1.5GB saved)
        torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# ─── Stage 4: Pre-download Whisper model ─────────
FROM python-deps AS model-download

# Descărcăm modelul Whisper în imagine (evităm download la fiecare container start)
# ARG permite suprascrierea la build: docker build --build-arg MODEL=small .
ARG MODEL=base
RUN python -c "import whisper; whisper.load_model('${MODEL}')"

# ─── Stage 5: Final Image ────────────────────────
FROM model-download AS final

WORKDIR /app

# Creăm utilizator non-root pentru securitate
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Directoare pentru cache și temp files
RUN mkdir -p /app/.cache/whisper /tmp/learnflow && \
    chown -R appuser:appuser /app /tmp/learnflow

# Copiem codul aplicației
COPY --chown=appuser:appuser main.py .

# Opțional: fișier .env dacă există
COPY --chown=appuser:appuser .env* ./

USER appuser

# Health check — Docker va marca containerul unhealthy după 3 eșecuri
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Comandă de start
# --workers 1: Whisper e heavy, un singur process per container
# Scalează orizontal cu mai multe containere, nu mai mulți workers
CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1", \
     "--log-level", "info", \
     "--no-access-log"]
