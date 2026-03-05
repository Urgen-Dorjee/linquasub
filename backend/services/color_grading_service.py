"""Color grading via FFmpeg — lift/gamma/gain, curves, LUT import."""

import asyncio
import logging
import os

from core.ffmpeg_utils import get_ffmpeg_path

logger = logging.getLogger(__name__)


async def apply_color_grade(
    video_path: str,
    output_path: str,
    grade_settings: dict,
    task_id: str = "",
    ws_manager=None,
) -> str:
    """Apply color grading to video.

    grade_settings:
    - shadows: {r, g, b} — lift (0.0 to 2.0, 1.0 = neutral)
    - midtones: {r, g, b} — gamma
    - highlights: {r, g, b} — gain
    - temperature: float (-100 to 100) — warm/cool shift
    - tint: float (-100 to 100) — green/magenta shift
    - exposure: float (-3.0 to 3.0)
    - lut_path: str — path to .cube LUT file
    - curves: str — FFmpeg curves filter string (e.g. "r='0/0 0.5/0.6 1/1'")
    """
    ffmpeg_path = get_ffmpeg_path()
    filters = _build_grade_filters(grade_settings)

    if not filters:
        raise ValueError("No color grading filters to apply")

    cmd = [
        ffmpeg_path,
        "-i", video_path,
        "-vf", ",".join(filters),
        "-c:v", "libx264",
        "-crf", "18",
        "-c:a", "copy",
        "-movflags", "+faststart",
        "-y",
        "-progress", "pipe:1",
        output_path,
    ]

    logger.info("Color grading: %s", filters)
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
                    await ws_manager.broadcast(task_id, "color_grade", progress)
            except (ValueError, IndexError):
                pass

    await process.wait()
    if process.returncode != 0:
        raise RuntimeError(f"Color grading failed (exit code {process.returncode})")

    return output_path


def _build_grade_filters(settings: dict) -> list[str]:
    """Build FFmpeg filter chain for color grading."""
    filters = []

    # LUT — must come first if specified
    lut_path = settings.get("lut_path")
    if lut_path and os.path.isfile(lut_path):
        safe_path = lut_path.replace("\\", "/").replace(":", "\\:")
        filters.append(f"lut3d='{safe_path}'")

    # Lift/Gamma/Gain using colorbalance
    shadows = settings.get("shadows", {})
    midtones = settings.get("midtones", {})
    highlights = settings.get("highlights", {})

    cb_parts = []
    # Shadows (lift) — values from -1 to 1, where 0 is neutral
    if shadows:
        rs = shadows.get("r", 1.0) - 1.0
        gs = shadows.get("g", 1.0) - 1.0
        bs = shadows.get("b", 1.0) - 1.0
        if abs(rs) > 0.01 or abs(gs) > 0.01 or abs(bs) > 0.01:
            cb_parts.extend([f"rs={rs:.3f}", f"gs={gs:.3f}", f"bs={bs:.3f}"])

    # Midtones (gamma)
    if midtones:
        rm = midtones.get("r", 1.0) - 1.0
        gm = midtones.get("g", 1.0) - 1.0
        bm = midtones.get("b", 1.0) - 1.0
        if abs(rm) > 0.01 or abs(gm) > 0.01 or abs(bm) > 0.01:
            cb_parts.extend([f"rm={rm:.3f}", f"gm={gm:.3f}", f"bm={bm:.3f}"])

    # Highlights (gain)
    if highlights:
        rh = highlights.get("r", 1.0) - 1.0
        gh = highlights.get("g", 1.0) - 1.0
        bh = highlights.get("b", 1.0) - 1.0
        if abs(rh) > 0.01 or abs(gh) > 0.01 or abs(bh) > 0.01:
            cb_parts.extend([f"rh={rh:.3f}", f"gh={gh:.3f}", f"bh={bh:.3f}"])

    if cb_parts:
        filters.append(f"colorbalance={':'.join(cb_parts)}")

    # Temperature (warm/cool)
    temp = settings.get("temperature", 0)
    if abs(temp) > 1:
        # Warm = more red/yellow, Cool = more blue
        temp_norm = temp / 100.0
        r_shift = temp_norm * 0.1
        b_shift = -temp_norm * 0.1
        filters.append(f"colorbalance=rs={r_shift:.3f}:bs={b_shift:.3f}")

    # Tint (green/magenta)
    tint = settings.get("tint", 0)
    if abs(tint) > 1:
        tint_norm = tint / 100.0
        g_shift = tint_norm * 0.1
        filters.append(f"colorbalance=gm={g_shift:.3f}")

    # Exposure
    exposure = settings.get("exposure", 0)
    if abs(exposure) > 0.01:
        # exposure via eq brightness
        filters.append(f"eq=brightness={exposure * 0.15}")

    # Custom curves
    curves = settings.get("curves")
    if curves:
        filters.append(f"curves={curves}")

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
