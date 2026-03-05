import asyncio
import gc
import os
import threading
import time
import uuid
from typing import Optional

from config import settings
from core.gpu_utils import select_device


# Cache the loaded model to avoid reloading
_model_cache = {"model": None, "model_size": None}

# Model size name -> HuggingFace repo ID used by faster-whisper
_MODEL_REPOS = {
    "tiny": "Systran/faster-whisper-tiny",
    "base": "Systran/faster-whisper-base",
    "small": "Systran/faster-whisper-small",
    "medium": "Systran/faster-whisper-medium",
    "large": "Systran/faster-whisper-large-v3",
}

# Approximate download sizes in MB
_MODEL_SIZES_MB = {
    "tiny": 75,
    "base": 145,
    "small": 490,
    "medium": 1500,
    "large": 3100,
}


def _is_model_cached(model_size: str) -> bool:
    """Check if the model is already downloaded."""
    try:
        from huggingface_hub import try_to_load_from_cache
        repo_id = _MODEL_REPOS.get(model_size, f"Systran/faster-whisper-{model_size}")
        result = try_to_load_from_cache(repo_id, "model.bin")
        return result is not None
    except Exception:
        return False


def _get_or_load_model(model_size: str, device: str, compute_type: str):
    """Load or return cached Whisper model."""
    from faster_whisper import WhisperModel

    if _model_cache["model"] is not None and _model_cache["model_size"] == model_size:
        return _model_cache["model"]

    # Unload previous model
    if _model_cache["model"] is not None:
        del _model_cache["model"]
        _model_cache["model"] = None
        _model_cache["model_size"] = None
        gc.collect()
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass

    model = WhisperModel(
        model_size,
        device=device,
        compute_type=compute_type,
    )
    _model_cache["model"] = model
    _model_cache["model_size"] = model_size
    return model


class TranscriptionCancelled(Exception):
    pass


async def transcribe_audio(
    video_path: str,
    model_size: str = "small",
    language: Optional[str] = None,
    device: str = "auto",
    compute_type: str = "float16",
    vad_filter: bool = True,
    task_id: str = "",
    ws_manager=None,
    cancel_check=None,
    progress_callback=None,
) -> dict:
    """Transcribe audio from a video file using faster-whisper."""

    # Determine device and compute type
    if device == "auto":
        device, compute_type = select_device(model_size)

    loop = asyncio.get_event_loop()

    # Check if model is already cached in memory (instant)
    already_loaded = (
        _model_cache["model"] is not None
        and _model_cache["model_size"] == model_size
    )

    # Check if model needs to be downloaded from HuggingFace
    model_on_disk = already_loaded or _is_model_cached(model_size)
    size_mb = _MODEL_SIZES_MB.get(model_size, 500)

    if already_loaded:
        phase_msg = f"Model {model_size} ready. Starting transcription..."
    elif not model_on_disk:
        phase_msg = f"Downloading {model_size} model (~{size_mb}MB). This only happens once..."
    else:
        phase_msg = f"Loading {model_size} model on {device}. Please wait..."

    if progress_callback:
        progress_callback(1)
    if ws_manager and task_id:
        await ws_manager.broadcast(
            task_id, "transcription", 1,
            phase="loading_model",
            message=phase_msg,
        )

    # Shared state for progress from the thread
    segments_result = []
    transcription_info = {}
    model_loaded_event = threading.Event()

    def do_transcribe():
        # Load model (this can take 1-3 minutes on first use)
        model = _get_or_load_model(model_size, device, compute_type)
        model_loaded_event.set()

        # Notify model loaded
        if progress_callback:
            progress_callback(5)
        if ws_manager and task_id:
            asyncio.run_coroutine_threadsafe(
                ws_manager.broadcast(
                    task_id, "transcription", 5,
                    phase="transcribing",
                    message="Model loaded! Transcribing audio..."
                ),
                loop,
            )

        segments_iter, info = model.transcribe(
            video_path,
            language=language,
            word_timestamps=True,
            vad_filter=vad_filter,
            beam_size=1 if device == "cuda" else 5,
        )

        detected_language = info.language
        total_duration = info.duration or 1  # avoid division by zero

        for i, segment in enumerate(segments_iter):
            # Check for cancellation
            if cancel_check and cancel_check():
                raise TranscriptionCancelled("Transcription cancelled by user")

            seg_id = f"seg_{i:04d}"

            words = []
            if segment.words:
                for w in segment.words:
                    words.append({
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                        "word": w.word.strip(),
                        "probability": round(w.probability, 3),
                    })

            seg_data = {
                "id": seg_id,
                "start": round(segment.start, 3),
                "end": round(segment.end, 3),
                "text": segment.text.strip(),
                "words": words,
            }
            segments_result.append(seg_data)

            # Calculate progress based on how far through the audio we are
            pct = min(95, 5 + (segment.end / total_duration) * 90)

            if progress_callback:
                progress_callback(round(pct, 1))
            if ws_manager and task_id:
                asyncio.run_coroutine_threadsafe(
                    ws_manager.broadcast(
                        task_id, "transcription", round(pct, 1),
                        phase="transcribing",
                        message=f"Segment {i + 1}: {segment.text.strip()[:60]}...",
                        latest_segment=seg_data,
                    ),
                    loop,
                )

        transcription_info["detected_language"] = detected_language

    # Start transcription in a thread
    future = loop.run_in_executor(None, do_transcribe)

    # Send heartbeat progress updates while model is loading
    # so the user knows the app isn't frozen
    if not already_loaded:
        pct = 1
        elapsed = 0
        while not model_loaded_event.is_set():
            await asyncio.sleep(3)
            elapsed += 3
            # Slowly increment progress from 1% to 4% during loading
            pct = min(4, 1 + elapsed / 30)  # reaches 4% after ~90 seconds
            minutes = elapsed // 60
            seconds = elapsed % 60
            time_str = f"{minutes}m {seconds}s" if minutes > 0 else f"{seconds}s"

            if not model_on_disk:
                msg = f"Downloading {model_size} model (~{size_mb}MB)... ({time_str} elapsed)"
            else:
                msg = f"Loading {model_size} model on {device}... ({time_str} elapsed)"

            if progress_callback:
                progress_callback(round(pct, 1))
            if ws_manager and task_id:
                await ws_manager.broadcast(
                    task_id, "transcription", round(pct, 1),
                    phase="loading_model",
                    message=msg,
                )

    # Wait for transcription to finish
    await future

    if ws_manager and task_id:
        await ws_manager.broadcast(
            task_id, "transcription", 100,
            phase="complete",
            message=f"Transcription complete: {len(segments_result)} segments"
        )

    return {
        "detected_language": transcription_info.get("detected_language", "unknown"),
        "segments": segments_result,
    }
