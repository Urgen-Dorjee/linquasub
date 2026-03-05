"""Video transitions via FFmpeg xfade filter.

Generates transition effects between two clips: crossfade, dissolve, wipe, etc.
"""

import asyncio
import logging

from core.ffmpeg_utils import get_ffmpeg_path

logger = logging.getLogger(__name__)

TRANSITION_TYPES = [
    "fade", "dissolve", "wipeleft", "wiperight", "wipeup", "wipedown",
    "slideleft", "slideright", "slideup", "slidedown",
    "circlecrop", "rectcrop", "distance", "fadeblack", "fadewhite",
    "radial", "smoothleft", "smoothright", "smoothup", "smoothdown",
    "circleopen", "circleclose", "horzopen", "horzclose",
    "vertopen", "vertclose", "diagbl", "diagbr", "diagtl", "diagtr",
]


async def apply_transition(
    clip_a_path: str,
    clip_b_path: str,
    output_path: str,
    transition_type: str = "fade",
    duration: float = 1.0,
    task_id: str = "",
    ws_manager=None,
) -> str:
    """Apply a transition between two video clips.

    The last `duration` seconds of clip_a overlap with the first `duration` seconds of clip_b.
    """
    if transition_type not in TRANSITION_TYPES:
        transition_type = "fade"

    ffmpeg_path = get_ffmpeg_path()

    # Get durations
    dur_a = await _get_duration(ffmpeg_path, clip_a_path)
    dur_b = await _get_duration(ffmpeg_path, clip_b_path)

    if dur_a <= duration or dur_b <= duration:
        raise ValueError("Clips too short for the requested transition duration")

    offset = dur_a - duration

    cmd = [
        ffmpeg_path,
        "-i", clip_a_path,
        "-i", clip_b_path,
        "-filter_complex",
        f"[0:v][1:v]xfade=transition={transition_type}:duration={duration}:offset={offset}[v];"
        f"[0:a][1:a]acrossfade=d={duration}[a]",
        "-map", "[v]",
        "-map", "[a]",
        "-c:v", "libx264",
        "-crf", "18",
        "-c:a", "aac",
        "-movflags", "+faststart",
        "-y",
        "-progress", "pipe:1",
        output_path,
    ]

    logger.info("Transition: %s (%.1fs) between clips", transition_type, duration)

    total_dur = dur_a + dur_b - duration

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )

    async for line in process.stdout:
        line_str = line.decode().strip()
        if line_str.startswith("out_time_ms=") and total_dur > 0:
            try:
                time_ms = int(line_str.split("=")[1])
                progress = min(99, (time_ms / 1_000_000 / total_dur) * 100)
                if ws_manager and task_id:
                    await ws_manager.broadcast(task_id, "transition", progress)
            except (ValueError, IndexError):
                pass

    await process.wait()
    if process.returncode != 0:
        raise RuntimeError(f"Transition failed (exit code {process.returncode})")

    return output_path


async def render_with_transitions(
    clips: list[dict],
    output_path: str,
    default_transition: str = "fade",
    default_duration: float = 1.0,
    task_id: str = "",
    ws_manager=None,
) -> str:
    """Render a sequence of clips with transitions between them.

    Each clip: {"path": str, "transition"?: str, "transition_duration"?: float}
    """
    if len(clips) < 2:
        raise ValueError("Need at least 2 clips for transitions")

    ffmpeg_path = get_ffmpeg_path()

    # Build complex filter graph
    inputs = []
    for i, clip in enumerate(clips):
        inputs.extend(["-i", clip["path"]])

    # Chain xfade filters
    filter_parts = []
    audio_parts = []

    # First video/audio pair
    prev_v = "[0:v]"
    prev_a = "[0:a]"
    cumulative_offset = await _get_duration(ffmpeg_path, clips[0]["path"])

    for i in range(1, len(clips)):
        clip = clips[i]
        trans = clip.get("transition", default_transition)
        dur = clip.get("transition_duration", default_duration)

        if trans not in TRANSITION_TYPES:
            trans = default_transition

        offset = cumulative_offset - dur
        out_v = f"[v{i}]" if i < len(clips) - 1 else "[v]"
        out_a = f"[a{i}]" if i < len(clips) - 1 else "[a]"

        filter_parts.append(
            f"{prev_v}[{i}:v]xfade=transition={trans}:duration={dur}:offset={offset:.3f}{out_v}"
        )
        audio_parts.append(
            f"{prev_a}[{i}:a]acrossfade=d={dur}{out_a}"
        )

        clip_dur = await _get_duration(ffmpeg_path, clip["path"])
        cumulative_offset += clip_dur - dur
        prev_v = out_v
        prev_a = out_a

    filter_complex = ";".join(filter_parts + audio_parts)

    cmd = [
        ffmpeg_path,
        *inputs,
        "-filter_complex", filter_complex,
        "-map", "[v]",
        "-map", "[a]",
        "-c:v", "libx264",
        "-crf", "18",
        "-c:a", "aac",
        "-movflags", "+faststart",
        "-y",
        output_path,
    ]

    logger.info("Rendering %d clips with transitions", len(clips))

    process = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
    )
    await process.wait()

    if process.returncode != 0:
        raise RuntimeError(f"Transition render failed (exit code {process.returncode})")

    return output_path


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
