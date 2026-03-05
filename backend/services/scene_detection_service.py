"""Auto scene detection using FFmpeg scene filter.

Uses FFmpeg's `select=gt(scene,THRESHOLD)` filter to detect scene changes
without requiring PySceneDetect as a dependency.
"""

import asyncio
import logging
import re

from core.ffmpeg_utils import get_ffmpeg_path

logger = logging.getLogger(__name__)


async def detect_scenes(
    video_path: str,
    threshold: float = 0.3,
    min_scene_duration: float = 1.0,
) -> list[dict]:
    """Detect scene boundaries in a video.

    Returns list of {"time": float, "score": float} for each detected scene change.
    """
    ffmpeg_path = get_ffmpeg_path()

    # Use showinfo filter to get scene change scores
    cmd = [
        ffmpeg_path,
        "-i", video_path,
        "-vf", f"select='gt(scene,{threshold})',showinfo",
        "-vsync", "vfr",
        "-f", "null",
        "-",
    ]

    logger.info("Scene detection: threshold=%.2f, video=%s", threshold, video_path)

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )

    _, stderr = await process.communicate()
    output = stderr.decode(errors="replace")

    scenes = _parse_showinfo_output(output, min_scene_duration)
    logger.info("Detected %d scenes", len(scenes))
    return scenes


def _parse_showinfo_output(output: str, min_duration: float) -> list[dict]:
    """Parse FFmpeg showinfo filter output for timestamps."""
    # showinfo outputs lines like: [Parsed_showinfo_1 ...] n:  42 pts: 84000 pts_time:3.36 ...
    pattern = re.compile(r"pts_time:\s*([\d.]+)")

    timestamps = []
    for line in output.split("\n"):
        if "showinfo" not in line:
            continue
        match = pattern.search(line)
        if match:
            t = float(match.group(1))
            timestamps.append(t)

    # Filter by minimum scene duration
    if not timestamps:
        return []

    filtered = [timestamps[0]]
    for t in timestamps[1:]:
        if t - filtered[-1] >= min_duration:
            filtered.append(t)

    return [{"time": round(t, 3)} for t in filtered]


async def detect_silence(
    video_path: str,
    noise_threshold: str = "-30dB",
    min_silence_duration: float = 0.5,
) -> list[dict]:
    """Detect silence regions in audio.

    Returns list of {"start": float, "end": float, "duration": float}.
    """
    ffmpeg_path = get_ffmpeg_path()

    cmd = [
        ffmpeg_path,
        "-i", video_path,
        "-af", f"silencedetect=noise={noise_threshold}:d={min_silence_duration}",
        "-f", "null",
        "-",
    ]

    logger.info("Silence detection: threshold=%s, min_duration=%.1f", noise_threshold, min_silence_duration)

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )

    _, stderr = await process.communicate()
    output = stderr.decode(errors="replace")

    regions = _parse_silence_output(output)
    logger.info("Detected %d silence regions", len(regions))
    return regions


def _parse_silence_output(output: str) -> list[dict]:
    """Parse FFmpeg silencedetect output."""
    start_pattern = re.compile(r"silence_start:\s*([\d.]+)")
    end_pattern = re.compile(r"silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)")

    regions = []
    current_start = None

    for line in output.split("\n"):
        start_match = start_pattern.search(line)
        if start_match:
            current_start = float(start_match.group(1))
            continue

        end_match = end_pattern.search(line)
        if end_match and current_start is not None:
            end = float(end_match.group(1))
            duration = float(end_match.group(2))
            regions.append({
                "start": round(current_start, 3),
                "end": round(end, 3),
                "duration": round(duration, 3),
            })
            current_start = None

    return regions
