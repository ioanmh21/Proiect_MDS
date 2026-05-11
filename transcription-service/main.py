"""
main.py — LearnFlow Transcription Microservice
===============================================
FastAPI microserviciu pentru transcriere audio/video cu Whisper.

Endpoint-uri:
  POST /transcribe   — primește URL YouTube sau fișier multipart
  GET  /health       — health check

Arhitectura:
  • Whisper rulează în ThreadPoolExecutor (CPU-bound, nu blochează event loop)
  • yt-dlp download rulează în executor separat
  • CORS activat pentru Next.js (localhost:3000)
  • Temp files curățate automat după procesare

Rulare locală:
  uvicorn main:app --reload --host 0.0.0.0 --port 8000

Rulare Docker:
  docker build -t learnflow-transcribe .
  docker run -p 8000:8000 learnflow-transcribe
"""

import os
import sys
import json
import shutil
import asyncio
import tempfile
import subprocess
import time
import logging
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from pathlib import Path
from typing import Optional, Annotated

import whisper
from fastapi import (
    FastAPI, HTTPException, UploadFile, File, Form,
    BackgroundTasks, Request, status
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, HttpUrl, field_validator

# ─────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("transcription-service")

# ─────────────────────────────────────────────────────────────────
# Configurare din variabile de mediu
# ─────────────────────────────────────────────────────────────────

WHISPER_MODEL_NAME: str = os.getenv("WHISPER_MODEL", "base")
MAX_DURATION_SECONDS: int = int(os.getenv("MAX_DURATION_SEC", "3600"))
MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "500"))
ALLOWED_ORIGINS: list[str] = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

# Număr de thread-uri pentru executor (Whisper + yt-dlp)
EXECUTOR_WORKERS: int = int(os.getenv("EXECUTOR_WORKERS", "2"))

# ─────────────────────────────────────────────────────────────────
# Stare globală — model Whisper încărcat o singură dată la startup
# ─────────────────────────────────────────────────────────────────

class AppState:
    whisper_model: Optional[whisper.Whisper] = None
    executor: Optional[ThreadPoolExecutor] = None
    startup_time: float = 0.0

app_state = AppState()

# ─────────────────────────────────────────────────────────────────
# Lifespan — startup / shutdown
# ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Încarcă modelul Whisper și executor-ul la startup; le curăță la shutdown."""
    logger.info(f"[Startup] Încarc modelul Whisper '{WHISPER_MODEL_NAME}'...")
    t0 = time.time()

    loop = asyncio.get_event_loop()
    app_state.executor = ThreadPoolExecutor(max_workers=EXECUTOR_WORKERS)

    try:
        app_state.whisper_model = await loop.run_in_executor(
            app_state.executor,
            partial(whisper.load_model, WHISPER_MODEL_NAME)
        )
        app_state.startup_time = time.time() - t0
        logger.info(
            f"[Startup] Model '{WHISPER_MODEL_NAME}' gata în "
            f"{app_state.startup_time:.1f}s"
        )
    except Exception as e:
        logger.error(f"[Startup] Nu s-a putut încărca Whisper: {e}")
        raise

    yield  # ← aplicația rulează

    logger.info("[Shutdown] Opresc executor-ul...")
    app_state.executor.shutdown(wait=False)

# ─────────────────────────────────────────────────────────────────
# Aplicația FastAPI
# ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="LearnFlow Transcription Service",
    description="Microserviciu de transcriere audio/video cu OpenAI Whisper.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS — permite Next.js dev server și orice origine adăugată în .env
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────
# Modele Pydantic
# ─────────────────────────────────────────────────────────────────

class TranscribeUrlRequest(BaseModel):
    """Body pentru POST /transcribe cu URL YouTube."""
    url: str

    @field_validator("url")
    @classmethod
    def validate_youtube_url(cls, v: str) -> str:
        import re
        pattern = re.compile(
            r"(https?://)?(www\.)?"
            r"(youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)"
            r"[A-Za-z0-9_\-]{11}"
        )
        if not pattern.search(v):
            raise ValueError(
                f"URL invalid: '{v}'. Furnizează un URL YouTube valid."
            )
        return v


class TranscriptSegment(BaseModel):
    """Un segment de transcriere cu timestamps."""
    start: float
    end: float
    text: str


class TranscribeResponse(BaseModel):
    """Răspunsul complet al transcrierii."""
    source: str
    model: str
    language: str
    duration_seconds: Optional[float]
    transcript: str
    segments: list[TranscriptSegment]
    processing_time_seconds: float

# ─────────────────────────────────────────────────────────────────
# Funcții sincrone (rulează în ThreadPoolExecutor)
# ─────────────────────────────────────────────────────────────────

def _get_youtube_duration(url: str) -> Optional[float]:
    """Obține durata fără download complet via yt-dlp --dump-json."""
    try:
        result = subprocess.run(
            ["yt-dlp", "--dump-json", "--no-playlist", url],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            stderr = result.stderr.strip()
            if "Video unavailable" in stderr:
                raise ValueError(f"Videoclipul nu este disponibil: {url}")
            if "Private video" in stderr:
                raise ValueError(f"Videoclipul este privat: {url}")
            return None
        info = json.loads(result.stdout)
        return float(info.get("duration") or 0)
    except subprocess.TimeoutExpired:
        logger.warning("Timeout la verificarea duratei YouTube.")
        return None
    except json.JSONDecodeError:
        return None


def _download_youtube_audio(url: str, output_dir: str) -> str:
    """Descarcă audio YouTube ca MP3. Returnează calea fișierului."""
    output_template = os.path.join(output_dir, "audio.%(ext)s")
    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "--output", output_template,
        "--no-mtime",
        "--quiet",          # fără output excesiv în container
        "--no-warnings",
        url,
    ]
    logger.info(f"[yt-dlp] Download: {url}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(
            f"yt-dlp a eșuat: {result.stderr.strip()[-300:]}"
        )
    for fname in os.listdir(output_dir):
        if fname.startswith("audio") and fname.endswith(".mp3"):
            path = os.path.join(output_dir, fname)
            logger.info(f"[yt-dlp] Audio descărcat: {fname}")
            return path
    raise RuntimeError("yt-dlp a rulat dar fișierul MP3 nu a fost găsit.")


def _convert_to_wav(input_path: str, output_dir: str) -> str:
    """
    Convertește orice fișier audio/video în WAV 16kHz mono
    (format optim pentru Whisper).
    """
    dest = os.path.join(output_dir, "audio.wav")
    cmd = [
        "ffmpeg", "-i", input_path,
        "-vn",
        "-ar", "16000",
        "-ac", "1",
        "-f", "wav",
        "-y", dest,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg conversie eșuată: {result.stderr.strip()[-300:]}"
        )
    return dest


def _get_audio_duration(path: str) -> Optional[float]:
    """Obține durata unui fișier audio via ffprobe."""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_format", path],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode == 0:
            info = json.loads(result.stdout)
            return float(info.get("format", {}).get("duration", 0))
    except Exception:
        pass
    return None


def _run_whisper(audio_path: str, model: whisper.Whisper) -> dict:
    """
    Rulează transcriere Whisper sincronă.
    Funcție blocantă — trebuie apelată din executor.
    """
    logger.info(f"[Whisper] Transcriere: {os.path.basename(audio_path)}")
    result = model.transcribe(
        audio_path,
        verbose=False,          # fără output la stdout în producție
        task="transcribe",
        word_timestamps=False,
    )
    logger.info(
        f"[Whisper] Finalizat — limbă: {result.get('language', '?')}, "
        f"segmente: {len(result.get('segments', []))}"
    )
    return result


def _process_url_sync(url: str, model: whisper.Whisper) -> dict:
    """Pipeline complet sincron pentru URL YouTube. Rulează în executor."""
    with tempfile.TemporaryDirectory(prefix="learnflow_url_") as tmp:
        # 1. Verificare durată
        duration = _get_youtube_duration(url)
        if duration and duration > MAX_DURATION_SECONDS:
            raise ValueError(
                f"Videoclipul este prea lung: {duration / 60:.0f} min "
                f"(max: {MAX_DURATION_SECONDS // 60} min)"
            )

        # 2. Download audio
        mp3_path = _download_youtube_audio(url, tmp)

        # 3. Conversie WAV pentru Whisper
        wav_path = _convert_to_wav(mp3_path, tmp)
        if not duration:
            duration = _get_audio_duration(wav_path)

        # 4. Transcriere
        result = _run_whisper(wav_path, model)
        result["_duration"] = duration
        return result


def _process_file_sync(file_path: str, model: whisper.Whisper) -> dict:
    """Pipeline complet sincron pentru fișier local. Rulează în executor."""
    with tempfile.TemporaryDirectory(prefix="learnflow_file_") as tmp:
        # Conversie WAV
        wav_path = _convert_to_wav(file_path, tmp)
        duration = _get_audio_duration(wav_path)

        if duration and duration > MAX_DURATION_SECONDS:
            raise ValueError(
                f"Fișierul este prea lung: {duration / 60:.0f} min "
                f"(max: {MAX_DURATION_SECONDS // 60} min)"
            )

        result = _run_whisper(wav_path, model)
        result["_duration"] = duration
        return result


# ─────────────────────────────────────────────────────────────────
# Helper: transformă rezultatul Whisper în TranscribeResponse
# ─────────────────────────────────────────────────────────────────

def _build_response(
    whisper_result: dict,
    source: str,
    processing_time: float,
) -> TranscribeResponse:
    segments = [
        TranscriptSegment(
            start=round(seg["start"], 2),
            end=round(seg["end"], 2),
            text=seg["text"].strip(),
        )
        for seg in whisper_result.get("segments", [])
    ]
    duration = whisper_result.get("_duration")

    return TranscribeResponse(
        source=source,
        model=WHISPER_MODEL_NAME,
        language=whisper_result.get("language", "unknown"),
        duration_seconds=round(duration, 2) if duration else None,
        transcript=whisper_result.get("text", "").strip(),
        segments=segments,
        processing_time_seconds=round(processing_time, 2),
    )

# ─────────────────────────────────────────────────────────────────
# Endpoint: GET /health
# ─────────────────────────────────────────────────────────────────

@app.get(
    "/health",
    summary="Health check",
    tags=["System"],
    responses={200: {"description": "Serviciul funcționează"}}
)
async def health_check():
    """
    Verifică starea serviciului și a modelului Whisper.
    Folosit de Docker HEALTHCHECK și load balancer.
    """
    return {
        "status": "ok",
        "model": WHISPER_MODEL_NAME,
        "model_loaded": app_state.whisper_model is not None,
        "max_duration_minutes": MAX_DURATION_SECONDS // 60,
        "startup_time_seconds": round(app_state.startup_time, 2),
    }

# ─────────────────────────────────────────────────────────────────
# Endpoint: POST /transcribe
# ─────────────────────────────────────────────────────────────────

@app.post(
    "/transcribe",
    response_model=TranscribeResponse,
    summary="Transcribe audio/video",
    tags=["Transcription"],
    status_code=status.HTTP_200_OK,
    responses={
        400: {"description": "Input invalid (URL greșit, fișier corupt)"},
        413: {"description": "Fișier sau video prea lung"},
        422: {"description": "Date de intrare invalide"},
        500: {"description": "Eroare internă de procesare"},
        503: {"description": "Modelul Whisper nu este disponibil"},
    }
)
async def transcribe(
    request: Request,
    # Multipart fields (opțional)
    file: Annotated[Optional[UploadFile], File(description="Fișier audio/video")] = None,
    url: Annotated[Optional[str], Form(description="URL YouTube")] = None,
):
    """
    Transcrie un videoclip sau fișier audio cu Whisper.

    **Mod 1 — URL YouTube (JSON body):**
    ```json
    POST /transcribe
    Content-Type: application/json
    { "url": "https://youtube.com/watch?v=VIDEO_ID" }
    ```

    **Mod 2 — URL YouTube (form-data):**
    ```
    POST /transcribe
    Content-Type: multipart/form-data
    url=https://youtube.com/watch?v=VIDEO_ID
    ```

    **Mod 3 — Fișier upload (form-data):**
    ```
    POST /transcribe
    Content-Type: multipart/form-data
    file=<binary>
    ```
    """
    if app_state.whisper_model is None:
        raise HTTPException(
            status_code=503,
            detail="Modelul Whisper nu este încărcat. Reîncearcă în câteva secunde."
        )

    loop = asyncio.get_event_loop()
    t_start = time.time()

    # ── Detectăm modul de input ────────────────────────────────────
    # Suportăm 3 moduri: JSON body cu {url}, form url=, form file=

    # Mod 1: JSON body
    if file is None and url is None:
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                body = await request.json()
            except Exception:
                raise HTTPException(status_code=400, detail="JSON body invalid.")

            raw_url = body.get("url")
            if not raw_url:
                raise HTTPException(
                    status_code=422,
                    detail="Câmpul 'url' sau 'file' este obligatoriu."
                )
            url = raw_url
        else:
            raise HTTPException(
                status_code=422,
                detail="Furnizează un URL YouTube (JSON sau form-data) sau un fișier."
            )

    # ── Procesare URL YouTube ──────────────────────────────────────
    if url is not None:
        # Validare URL
        import re
        yt_pattern = re.compile(
            r"(https?://)?(www\.)?"
            r"(youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)"
            r"[A-Za-z0-9_\-]{11}"
        )
        if not yt_pattern.search(url):
            raise HTTPException(
                status_code=400,
                detail=f"URL YouTube invalid: '{url}'"
            )

        logger.info(f"[/transcribe] URL request: {url}")
        try:
            whisper_result = await loop.run_in_executor(
                app_state.executor,
                partial(_process_url_sync, url, app_state.whisper_model)
            )
        except ValueError as e:
            raise HTTPException(status_code=413, detail=str(e))
        except RuntimeError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"[/transcribe] Eroare URL: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Eroare internă: {e}")

        return _build_response(whisper_result, url, time.time() - t_start)

    # ── Procesare fișier upload ────────────────────────────────────
    if file is not None:
        # Verificare tip fișier
        allowed_types = {
            "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg",
            "audio/mp4", "audio/aac", "audio/opus", "audio/webm",
            "video/mp4", "video/webm", "video/quicktime",
            "video/x-msvideo", "video/x-matroska",
            "application/octet-stream",  # fallback generic
        }
        content_type = file.content_type or "application/octet-stream"
        if content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Tip fișier nesuportat: {content_type}"
            )

        # Salvăm în temp file (suffix păstrat pentru ffmpeg)
        suffix = Path(file.filename or "audio.bin").suffix or ".bin"
        tmp_fd, tmp_path = tempfile.mkstemp(
            prefix="learnflow_upload_", suffix=suffix
        )

        try:
            # Scriere chunk-cu-chunk (evităm OOM pentru fișiere mari)
            max_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
            bytes_written = 0

            with os.fdopen(tmp_fd, "wb") as f:
                while chunk := await file.read(1024 * 1024):  # 1MB chunks
                    bytes_written += len(chunk)
                    if bytes_written > max_bytes:
                        raise HTTPException(
                            status_code=413,
                            detail=f"Fișierul depășește {MAX_FILE_SIZE_MB}MB."
                        )
                    f.write(chunk)

            logger.info(
                f"[/transcribe] File upload: {file.filename} "
                f"({bytes_written / 1024 / 1024:.1f} MB)"
            )

            try:
                whisper_result = await loop.run_in_executor(
                    app_state.executor,
                    partial(_process_file_sync, tmp_path, app_state.whisper_model)
                )
            except ValueError as e:
                raise HTTPException(status_code=413, detail=str(e))
            except RuntimeError as e:
                raise HTTPException(status_code=400, detail=str(e))
            except Exception as e:
                logger.error(f"[/transcribe] Eroare file: {e}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Eroare internă: {e}")

        finally:
            # Curățăm temp file-ul indiferent de rezultat
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

        source = file.filename or "uploaded_file"
        return _build_response(whisper_result, source, time.time() - t_start)

    # Cod inaccesibil — toate cazurile sunt tratate mai sus
    raise HTTPException(status_code=422, detail="Input necunoscut.")


# ─────────────────────────────────────────────────────────────────
# Handler global pentru erori neașteptate
# ─────────────────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Eroare neașteptată: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Eroare internă: {type(exc).__name__}: {exc}"},
    )


# ─────────────────────────────────────────────────────────────────
# Entry point pentru rulare directă
# ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
        workers=1,  # Whisper e heavy — 1 worker per container
    )
