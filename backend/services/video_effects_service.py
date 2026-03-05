"""Video effects and filters via FFmpeg.

Applies color filters, blur, vignette, speed changes, and audio adjustments
using FFmpeg filter graphs.
"""

import asyncio
import logging

from core.ffmpeg_utils import get_ffmpeg_path

logger = logging.getLogger(__name__)


async def apply_effects(
    video_path: str,
    output_path: str,
    effects: dict,
    task_id: str = "",
    ws_manager=None,
) -> str:
    """Apply visual and audio effects to a video.

    Effects dict can include:
    - brightness: float (-1.0 to 1.0)
    - contrast: float (0.0 to 3.0)
    - saturation: float (0.0 to 3.0)
    - blur: float (0 to 20)
    - vignette: bool
    - speed: float (0.25 to 4.0)
    - volume: float (0.0 to 3.0)
    - fade_in: float (seconds)
    - fade_out: float (seconds)
    - grayscale: bool
    - sepia: bool
    """
    ffmpeg_path = get_ffmpeg_path()

    video_filters = _build_video_filters(effects)
    audio_filters = _build_audio_filters(effects)

    cmd = [ffmpeg_path, "-i", video_path]

    if video_filters:
        cmd += ["-vf", ",".join(video_filters)]

    if audio_filters:
        cmd += ["-af", ",".join(audio_filters)]

    cmd += [
        "-c:v", "libx264",
        "-crf", "18",
        "-c:a", "aac",
        "-movflags", "+faststart",
        "-y",
        "-progress", "pipe:1",
        output_path,
    ]

    logger.info("Applying effects: video=%s, audio=%s", video_filters, audio_filters)

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
                    await ws_manager.broadcast(task_id, "effects", progress)
            except (ValueError, IndexError):
                pass

    await process.wait()
    if process.returncode != 0:
        raise RuntimeError(f"FFmpeg effects failed (exit code {process.returncode})")

    return output_path


def _build_video_filters(effects: dict) -> list[str]:
    """Build FFmpeg video filter chain from effects dict."""
    filters = []

    # Color adjustments via eq filter
    eq_parts = []
    if "brightness" in effects:
        eq_parts.append(f"brightness={effects['brightness']}")
    if "contrast" in effects:
        eq_parts.append(f"contrast={effects['contrast']}")
    if "saturation" in effects:
        eq_parts.append(f"saturation={effects['saturation']}")
    if eq_parts:
        filters.append(f"eq={':'.join(eq_parts)}")

    if effects.get("grayscale"):
        filters.append("colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3")

    if effects.get("sepia"):
        filters.append("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131")

    if "blur" in effects and effects["blur"] > 0:
        # boxblur takes luma_radius:luma_power
        radius = max(1, int(effects["blur"]))
        filters.append(f"boxblur={radius}:{radius}")

    if effects.get("vignette"):
        filters.append("vignette")

    speed = effects.get("speed", 1.0)
    if speed != 1.0:
        filters.append(f"setpts={1/speed}*PTS")

    # Fade in/out (applied at video level)
    if "fade_in" in effects and effects["fade_in"] > 0:
        frames = int(effects["fade_in"] * 30)
        filters.append(f"fade=t=in:st=0:d={effects['fade_in']}")

    if "fade_out" in effects and effects["fade_out"] > 0:
        # fade_out needs duration knowledge - use a large start time as placeholder
        filters.append(f"fade=t=out:d={effects['fade_out']}")

    return filters


def _build_audio_filters(effects: dict) -> list[str]:
    """Build FFmpeg audio filter chain."""
    filters = []

    if "volume" in effects:
        filters.append(f"volume={effects['volume']}")

    speed = effects.get("speed", 1.0)
    if speed != 1.0:
        filters.append(f"atempo={speed}")

    if "audio_fade_in" in effects and effects["audio_fade_in"] > 0:
        filters.append(f"afade=t=in:d={effects['audio_fade_in']}")

    if "audio_fade_out" in effects and effects["audio_fade_out"] > 0:
        filters.append(f"afade=t=out:d={effects['audio_fade_out']}")

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
