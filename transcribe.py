#!/usr/bin/env python3
"""
transcribe.py — LearnFlow Video Transcription Pipeline
=======================================================
Utilizare:
    python transcribe.py <URL_YouTube_sau_cale_video> [--model base] [--max-duration 3600] [--output out.json]

Exemple:
    python transcribe.py "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    python transcribe.py ./lectie.mp4 --model small --output transcript.json
    python transcribe.py "https://youtu.be/abc123" --max-duration 1800

Output JSON:
    {
        "source": "<url sau cale>",
        "model": "base",
        "language": "ro",
        "duration_seconds": 312.4,
        "transcript": "Textul complet...",
        "segments": [
            { "start": 0.0, "end": 3.5, "text": "Bună ziua tuturor." },
            ...
        ]
    }
"""

import sys
import os
import re
import json
import shutil
import argparse
import tempfile
import subprocess
import time
from pathlib import Path
from typing import Optional

# ─────────────────────────────────────────────────────────────────
# Constante
# ─────────────────────────────────────────────────────────────────

DEFAULT_MODEL = "base"
DEFAULT_MAX_DURATION_SEC = 3600  # 1 oră
YOUTUBE_URL_PATTERN = re.compile(
    r"(https?://)?(www\.)?"
    r"(youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)"
    r"[A-Za-z0-9_\-]{11}"
)

# ─────────────────────────────────────────────────────────────────
# Erori custom
# ─────────────────────────────────────────────────────────────────

class TranscribeError(Exception):
    """Eroare de bază pentru pipeline."""

class InvalidSourceError(TranscribeError):
    """URL invalid sau fișier inexistent."""

class VideoDurationError(TranscribeError):
    """Videoclipul depășește durata maximă permisă."""

class CorruptFileError(TranscribeError):
    """Fișierul audio/video este corupt sau nu poate fi procesat."""

class DependencyError(TranscribeError):
    """Dependință lipsă (yt-dlp, ffmpeg, whisper)."""

# ─────────────────────────────────────────────────────────────────
# Verificare dependențe
# ─────────────────────────────────────────────────────────────────

def check_dependencies() -> None:
    """Verifică că yt-dlp, ffmpeg și whisper sunt disponibile."""
    missing = []

    if shutil.which("yt-dlp") is None:
        missing.append("yt-dlp (pip install yt-dlp)")
    if shutil.which("ffmpeg") is None:
        missing.append("ffmpeg (https://ffmpeg.org/download.html)")

    try:
        import whisper  # noqa: F401
    except ImportError:
        missing.append("openai-whisper (pip install openai-whisper)")

    if missing:
        raise DependencyError(
            "Dependințe lipsă:\n" + "\n".join(f"  • {m}" for m in missing)
        )

# ─────────────────────────────────────────────────────────────────
# Validare sursă
# ─────────────────────────────────────────────────────────────────

def is_youtube_url(source: str) -> bool:
    return bool(YOUTUBE_URL_PATTERN.search(source))

def validate_source(source: str) -> str:
    """
    Validează sursa și returnează tipul: 'youtube' sau 'file'.
    Aruncă InvalidSourceError pentru surse invalide.
    """
    if is_youtube_url(source):
        return "youtube"

    path = Path(source)
    if not path.exists():
        raise InvalidSourceError(
            f"Fișierul nu există: '{source}'\n"
            "Furnizează un URL YouTube valid sau o cale de fișier existentă."
        )
    if not path.is_file():
        raise InvalidSourceError(f"'{source}' nu este un fișier.")

    suffix = path.suffix.lower()
    video_exts = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv",
                  ".mp3", ".wav", ".m4a", ".ogg", ".opus", ".aac"}
    if suffix not in video_exts:
        raise InvalidSourceError(
            f"Format nesuportat: '{suffix}'. "
            f"Formate acceptate: {', '.join(sorted(video_exts))}"
        )
    return "file"

# ─────────────────────────────────────────────────────────────────
# Obținere durată video (înainte de download complet)
# ─────────────────────────────────────────────────────────────────

def get_youtube_duration(url: str) -> Optional[float]:
    """Obține durata unui video YouTube fără să-l descarce (via yt-dlp --dump-json)."""
    print("  ℹ  Se verifică durata videoclipului...")
    try:
        result = subprocess.run(
            ["yt-dlp", "--dump-json", "--no-playlist", url],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            # URL invalid sau video indisponibil
            stderr = result.stderr.strip()
            if "Video unavailable" in stderr or "This video is not available" in stderr:
                raise InvalidSourceError(f"Videoclipul nu este disponibil: {url}")
            if "Private video" in stderr:
                raise InvalidSourceError(f"Videoclipul este privat: {url}")
            # Alt tip de eroare — continuăm fără durată
            return None

        info = json.loads(result.stdout)
        return float(info.get("duration") or 0)
    except subprocess.TimeoutExpired:
        print("  ⚠  Timeout la verificarea duratei — continuăm fără verificare.")
        return None
    except json.JSONDecodeError:
        return None

def get_file_duration(path: str) -> Optional[float]:
    """Obține durata unui fișier local via ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                path,
            ],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode != 0:
            return None
        info = json.loads(result.stdout)
        return float(info.get("format", {}).get("duration", 0))
    except Exception:
        return None

def check_duration(duration: Optional[float], max_duration: int) -> None:
    """Verifică că durata nu depășește limita."""
    if duration and duration > max_duration:
        mins = int(duration // 60)
        max_mins = int(max_duration // 60)
        raise VideoDurationError(
            f"Videoclipul este prea lung: {mins} minute "
            f"(limită: {max_mins} minute).\n"
            "Folosește --max-duration pentru a crește limita."
        )

# ─────────────────────────────────────────────────────────────────
# Download audio cu yt-dlp
# ─────────────────────────────────────────────────────────────────

def download_audio(url: str, output_dir: str) -> str:
    """
    Descarcă audio-ul unui video YouTube ca MP3 în output_dir.
    Returnează calea completă a fișierului MP3.
    Afișează progres în consolă.
    """
    output_template = os.path.join(output_dir, "audio.%(ext)s")

    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", "0",          # cea mai bună calitate
        "--output", output_template,
        "--no-mtime",
        "--progress",
        url,
    ]

    print("  ⬇  Se descarcă audio...")
    print(f"     Comandă: {' '.join(cmd)}\n")

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    for line in process.stdout:
        line = line.rstrip()
        if line:
            # Filtrăm liniile de progres relevante
            if any(kw in line for kw in ("[download]", "[ExtractAudio]", "ERROR", "WARNING")):
                print(f"     {line}")

    process.wait()

    if process.returncode != 0:
        raise InvalidSourceError(
            f"yt-dlp a eșuat (exit code {process.returncode}). "
            "Verifică URL-ul și conexiunea la internet."
        )

    # Găsim fișierul descărcat
    for fname in os.listdir(output_dir):
        if fname.startswith("audio") and fname.endswith(".mp3"):
            return os.path.join(output_dir, fname)

    raise CorruptFileError("yt-dlp a rulat cu succes dar fișierul MP3 nu a fost găsit.")

# ─────────────────────────────────────────────────────────────────
# Conversie fișier local în MP3 (dacă e necesar)
# ─────────────────────────────────────────────────────────────────

def convert_to_mp3(input_path: str, output_dir: str) -> str:
    """
    Convertește un fișier video/audio local în MP3 via ffmpeg.
    Dacă sursa e deja MP3, o copiază direct.
    """
    if input_path.lower().endswith(".mp3"):
        dest = os.path.join(output_dir, "audio.mp3")
        shutil.copy2(input_path, dest)
        return dest

    dest = os.path.join(output_dir, "audio.mp3")
    print("  🔄  Se convertește în MP3...")

    cmd = [
        "ffmpeg",
        "-i", input_path,
        "-vn",                   # fără video
        "-ar", "16000",          # 16kHz — optim pentru Whisper
        "-ac", "1",              # mono
        "-q:a", "0",             # cea mai bună calitate VBR
        "-y",                    # suprascrie fără întrebare
        dest,
    ]

    result = subprocess.run(
        cmd, capture_output=True, text=True, timeout=300
    )

    if result.returncode != 0:
        raise CorruptFileError(
            f"ffmpeg nu a putut converti fișierul:\n{result.stderr[-500:]}"
        )

    return dest

# ─────────────────────────────────────────────────────────────────
# Transcriere cu Whisper
# ─────────────────────────────────────────────────────────────────

def transcribe_audio(audio_path: str, model_name: str) -> dict:
    """
    Transcrie fișierul MP3 cu Whisper.
    Returnează dict brut de la Whisper cu 'text' și 'segments'.
    """
    import whisper

    if not os.path.exists(audio_path):
        raise CorruptFileError(f"Fișierul audio nu există: {audio_path}")

    file_size_mb = os.path.getsize(audio_path) / (1024 * 1024)
    if file_size_mb < 0.001:
        raise CorruptFileError(
            f"Fișierul audio este prea mic ({file_size_mb:.3f} MB) — probabil corupt."
        )

    print(f"\n  🎙  Se încarcă modelul Whisper '{model_name}'...")
    print("     (Prima rulare descarcă modelul ~150MB — poate dura câteva minute)\n")

    start_load = time.time()
    try:
        model = whisper.load_model(model_name)
    except Exception as e:
        raise CorruptFileError(f"Nu s-a putut încărca modelul Whisper '{model_name}': {e}")

    load_time = time.time() - start_load
    print(f"     Model încărcat în {load_time:.1f}s")
    print(f"  📝  Se transcrie ({file_size_mb:.1f} MB audio)...\n")

    start_transcribe = time.time()
    try:
        result = model.transcribe(
            audio_path,
            verbose=True,       # afișează segmentele pe măsură ce sunt procesate
            word_timestamps=False,
            task="transcribe",  # nu translate
        )
    except Exception as e:
        raise CorruptFileError(f"Transcriere eșuată: {e}")

    transcribe_time = time.time() - start_transcribe
    print(f"\n     Transcriere completă în {transcribe_time:.1f}s")

    return result

# ─────────────────────────────────────────────────────────────────
# Formatare output
# ─────────────────────────────────────────────────────────────────

def build_output(
    source: str,
    model_name: str,
    whisper_result: dict,
    duration: Optional[float],
) -> dict:
    """Construiește JSON-ul final din rezultatul Whisper."""
    segments = [
        {
            "start": round(seg["start"], 2),
            "end": round(seg["end"], 2),
            "text": seg["text"].strip(),
        }
        for seg in whisper_result.get("segments", [])
    ]

    full_transcript = whisper_result.get("text", "").strip()

    return {
        "source": source,
        "model": model_name,
        "language": whisper_result.get("language", "unknown"),
        "duration_seconds": round(duration, 2) if duration else None,
        "transcript": full_transcript,
        "segments": segments,
    }

# ─────────────────────────────────────────────────────────────────
# Pipeline principal
# ─────────────────────────────────────────────────────────────────

def run_pipeline(
    source: str,
    model_name: str = DEFAULT_MODEL,
    max_duration: int = DEFAULT_MAX_DURATION_SEC,
    output_path: Optional[str] = None,
) -> dict:
    """
    Pipeline complet: validare → download/conversie → transcriere → output.

    Args:
        source:       URL YouTube sau cale fișier local
        model_name:   Modelul Whisper (tiny/base/small/medium/large)
        max_duration: Durata maximă acceptată în secunde
        output_path:  Calea fișierului JSON de output (None = stdout)

    Returns:
        Dict cu transcript complet și segmente.

    Raises:
        InvalidSourceError, VideoDurationError, CorruptFileError, DependencyError
    """
    print("\n" + "═" * 60)
    print("  LearnFlow — Transcription Pipeline")
    print("═" * 60)
    print(f"  Sursă  : {source}")
    print(f"  Model  : Whisper {model_name}")
    print(f"  Durată max: {max_duration // 60} minute")
    print("═" * 60 + "\n")

    # ── 1. Verificare dependențe ────────────────────────────────────
    print("▶  [1/4] Verificare dependențe...")
    check_dependencies()
    print("  ✓  yt-dlp, ffmpeg și whisper sunt disponibile\n")

    # ── 2. Validare sursă ───────────────────────────────────────────
    print("▶  [2/4] Validare sursă...")
    source_type = validate_source(source)
    print(f"  ✓  Sursă validă ({source_type})\n")

    with tempfile.TemporaryDirectory(prefix="learnflow_transcribe_") as tmp_dir:
        duration: Optional[float] = None

        # ── 3a. Sursă YouTube ───────────────────────────────────────
        if source_type == "youtube":
            print("▶  [3/4] Download audio de pe YouTube...")
            duration = get_youtube_duration(source)
            check_duration(duration, max_duration)
            if duration:
                print(f"  ✓  Durată: {duration / 60:.1f} minute\n")

            audio_path = download_audio(source, tmp_dir)
            print(f"\n  ✓  Audio descărcat: {os.path.basename(audio_path)}\n")

        # ── 3b. Fișier local ─────────────────────────────────────────
        else:
            print("▶  [3/4] Procesare fișier local...")
            duration = get_file_duration(source)
            check_duration(duration, max_duration)
            if duration:
                print(f"  ✓  Durată: {duration / 60:.1f} minute")

            audio_path = convert_to_mp3(source, tmp_dir)
            print(f"  ✓  Audio pregătit: {os.path.basename(audio_path)}\n")

        # ── 4. Transcriere ──────────────────────────────────────────
        print("▶  [4/4] Transcriere cu Whisper...")
        whisper_result = transcribe_audio(audio_path, model_name)

        # ── 5. Construire output ────────────────────────────────────
        output = build_output(source, model_name, whisper_result, duration)

    # ── 6. Salvare / afișare ────────────────────────────────────────
    output_json = json.dumps(output, ensure_ascii=False, indent=2)

    if output_path:
        Path(output_path).write_text(output_json, encoding="utf-8")
        print(f"\n  ✓  Transcript salvat în: {output_path}")
    else:
        print("\n" + "═" * 60)
        print("  OUTPUT JSON")
        print("═" * 60)
        print(output_json)

    seg_count = len(output["segments"])
    word_count = len(output["transcript"].split())
    lang = output.get("language", "?")

    print("\n" + "─" * 60)
    print(f"  ✅  Transcriere finalizată!")
    print(f"     Limbă detectată : {lang}")
    print(f"     Segmente        : {seg_count}")
    print(f"     Cuvinte         : ~{word_count}")
    print("─" * 60 + "\n")

    return output

# ─────────────────────────────────────────────────────────────────
# CLI Entry Point
# ─────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        prog="transcribe.py",
        description="Transcrie un videoclip YouTube sau fisier local cu Whisper.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemple:
  python transcribe.py "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  python transcribe.py ./curs_algebra.mp4 --model small --output transcript.json
  python transcribe.py "https://youtu.be/abc123" --max-duration 1800 --model medium
        """,
    )

    parser.add_argument(
        "source",
        help="URL YouTube sau cale fisier video/audio local",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        choices=["tiny", "base", "small", "medium", "large"],
        help=f"Modelul Whisper (default: {DEFAULT_MODEL}). "
             "Modele mai mari = acuratete mai buna dar mai lent.",
    )
    parser.add_argument(
        "--max-duration",
        type=int,
        default=DEFAULT_MAX_DURATION_SEC,
        dest="max_duration",
        help=f"Durata maxima in secunde (default: {DEFAULT_MAX_DURATION_SEC} = 1 ora).",
    )
    parser.add_argument(
        "--output", "-o",
        default=None,
        help="Cale fisier JSON de output. Daca lipseste, afiseaza in stdout.",
    )

    args = parser.parse_args()

    try:
        run_pipeline(
            source=args.source,
            model_name=args.model,
            max_duration=args.max_duration,
            output_path=args.output,
        )
        sys.exit(0)

    except InvalidSourceError as e:
        print(f"\n  ❌  EROARE — Sursă invalidă:\n     {e}\n", file=sys.stderr)
        sys.exit(2)
    except VideoDurationError as e:
        print(f"\n  ❌  EROARE — Video prea lung:\n     {e}\n", file=sys.stderr)
        sys.exit(3)
    except CorruptFileError as e:
        print(f"\n  ❌  EROARE — Fișier corupt / procesare eșuată:\n     {e}\n", file=sys.stderr)
        sys.exit(4)
    except DependencyError as e:
        print(f"\n  ❌  EROARE — Dependințe lipsă:\n     {e}\n", file=sys.stderr)
        sys.exit(5)
    except KeyboardInterrupt:
        print("\n\n  ⛔  Anulat de utilizator.\n", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(f"\n  ❌  EROARE NEAȘTEPTATĂ:\n     {type(e).__name__}: {e}\n", file=sys.stderr)
        raise  # Re-raise pentru debugging


if __name__ == "__main__":
    main()
