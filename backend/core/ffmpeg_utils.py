import os
import shutil
from pathlib import Path

from config import settings


def get_ffmpeg_path() -> str:
    """Resolve FFmpeg binary path with fallback chain."""

    # 1. Environment variable (set by Electron)
    env_path = settings.ffmpeg_path
    if env_path and env_path != "ffmpeg" and Path(env_path).exists():
        return env_path

    # 2. Bundled location
    bundled = Path(__file__).parent.parent.parent / "resources" / "ffmpeg" / "ffmpeg.exe"
    if bundled.exists():
        return str(bundled)

    # 3. System PATH
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg

    raise FileNotFoundError(
        "FFmpeg not found. Please download FFmpeg and ensure it's in your PATH, "
        "or place ffmpeg.exe in the resources/ffmpeg/ directory."
    )


def is_ffmpeg_available() -> bool:
    """Check if FFmpeg is available."""
    try:
        get_ffmpeg_path()
        return True
    except FileNotFoundError:
        return False
