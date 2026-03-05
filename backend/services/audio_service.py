"""Audio processing service — per-track volume, EQ, noise reduction via FFmpeg."""

import asyncio
import logging

from core.ffmpeg_utils import get_ffmpeg_path

logger = logging.getLogger(__name__)


async def process_audio(
    video_path: str,
    output_path: str,
    audio_settings: dict,
    task_id: str = "",
    ws_manager=None,
) -> str:
    """Apply audio processing to a video.

    audio_settings can include:
    - volume: float (0.0 to 3.0)
    - bass: float (-20 to 20 dB)
    - treble: float (-20 to 20 dB)
    - normalize: bool — loudnorm filter
    - noise_reduction: float (0.0 to 1.0) — afftdn amount
    - compressor: bool — dynamic range compression
    - fade_in: float (seconds)
    - fade_out: float (seconds)
    """
    ffmpeg_path = get_ffmpeg_path()
    filters = _build_audio_chain(audio_settings)

    if not filters:
        raise ValueError("No audio filters to apply")

    cmd = [
        ffmpeg_path,
        "-i", video_path,
        "-af", ",".join(filters),
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        "-y",
        "-progress", "pipe:1",
        output_path,
    ]

    logger.info("Audio processing: %s", filters)
    duration = await _get_duration(ffmpeg_path, video_path)

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )

    async for line in process.stdout:
        line_str = line.decode().strip()
        if line_str.startswith("out_time_ms=") and duration > 0:
            try:
                time_ms = int(line_str.split("=")[1])
                progress = min(99, (time_ms / 1_000_000 / duration) * 100)
                if ws_manager and task_id:
                    await ws_manager.broadcast(task_id, "audio", progress)
            except (ValueError, IndexError):
                pass

    await process.wait()
    if process.returncode != 0:
        raise RuntimeError(f"Audio processing failed (exit code {process.returncode})")

    return output_path


async def extract_audio(
    video_path: str,
    output_path: str,
    format: str = "wav",
) -> str:
    """Extract audio track from video."""
    ffmpeg_path = get_ffmpeg_path()

    codec_map = {"wav": "pcm_s16le", "mp3": "libmp3lame", "aac": "aac", "flac": "flac"}
    codec = codec_map.get(format, "pcm_s16le")

    cmd = [
        ffmpeg_path,
        "-i", video_path,
        "-vn",
        "-c:a", codec,
        "-y",
        output_path,
    ]

    process = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
    )
    await process.wait()

    if process.returncode != 0:
        raise RuntimeError("Audio extraction failed")

    return output_path


def _build_audio_chain(settings: dict) -> list[str]:
    """Build FFmpeg audio filter chain."""
    filters = []

    # Volume
    if "volume" in settings and settings["volume"] != 1.0:
        filters.append(f"volume={settings['volume']}")

    # EQ - bass and treble
    if "bass" in settings and settings["bass"] != 0:
        filters.append(f"bass=g={settings['bass']}:f=100")
    if "treble" in settings and settings["treble"] != 0:
        filters.append(f"treble=g={settings['treble']}:f=3000")

    # Noise reduction
    if "noise_reduction" in settings and settings["noise_reduction"] > 0:
        nr = min(97, int(settings["noise_reduction"] * 97))
        filters.append(f"afftdn=nr={nr}:nf=-25")

    # Dynamic range compression
    if settings.get("compressor"):
        filters.append("acompressor=threshold=-20dB:ratio=4:attack=5:release=50")

    # Loudness normalization
    if settings.get("normalize"):
        filters.append("loudnorm=I=-16:TP=-1.5:LRA=11")

    # Fade
    if "fade_in" in settings and settings["fade_in"] > 0:
        filters.append(f"afade=t=in:d={settings['fade_in']}")
    if "fade_out" in settings and settings["fade_out"] > 0:
        filters.append(f"afade=t=out:d={settings['fade_out']}")

    return filters


async def _get_duration(ffmpeg_path: str, video_path: str) -> float:
    ffprobe = ffmpeg_path.replace("ffmpeg", "ffprobe")
    cmd = [
        ffprobe, "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path,
    ]
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await process.communicate()
        return float(stdout.decode().strip())
    except Exception:
        return 0
