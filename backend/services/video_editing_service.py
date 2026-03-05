"""Non-destructive video editing via FFmpeg.

Accepts an Edit Decision List (EDL) — a list of clips with sourceStart, sourceEnd,
speed, and reverse — and renders them into a single output video using FFmpeg.
"""

import asyncio
import logging
import os
import tempfile

from core.ffmpeg_utils import get_ffmpeg_path

logger = logging.getLogger(__name__)


async def render_edl(
    video_path: str,
    edl: list[dict],
    output_path: str,
    video_codec: str = "h264",
    crf: int = 23,
    task_id: str = "",
    ws_manager=None,
) -> str:
    """Render an EDL to a single output video.

    Each EDL entry: {
        "source_start": float,
        "source_end": float,
        "speed": float (default 1.0),
        "reverse": bool (default False),
    }
    """
    ffmpeg_path = get_ffmpeg_path()
    codec_map = {"h264": "libx264", "h265": "libx265"}
    encoder = codec_map.get(video_codec, "libx264")

    if len(edl) == 0:
        raise ValueError("EDL is empty")

    # Normalize EDL entries
    for clip in edl:
        clip.setdefault("speed", 1.0)
        clip.setdefault("reverse", False)

    # Single clip without special effects: simple trim
    if len(edl) == 1 and edl[0]["speed"] == 1.0 and not edl[0]["reverse"]:
        clip = edl[0]
        return await _trim_single(
            ffmpeg_path, video_path, clip["source_start"], clip["source_end"],
            output_path, encoder, crf, task_id, ws_manager,
        )

    # Multiple clips or clips with speed/reverse: complex render
    return await _render_complex(
        ffmpeg_path, video_path, edl, output_path, encoder, crf, task_id, ws_manager,
    )


async def trim_video(
    video_path: str,
    start: float,
    end: float,
    output_path: str,
    video_codec: str = "h264",
    crf: int = 23,
) -> str:
    """Simple trim of a video between start and end times."""
    ffmpeg_path = get_ffmpeg_path()
    codec_map = {"h264": "libx264", "h265": "libx265"}
    encoder = codec_map.get(video_codec, "libx264")
    return await _trim_single(ffmpeg_path, video_path, start, end, output_path, encoder, crf)


async def _trim_single(
    ffmpeg_path: str,
    video_path: str,
    start: float,
    end: float,
    output_path: str,
    encoder: str,
    crf: int,
    task_id: str = "",
    ws_manager=None,
) -> str:
    duration = end - start
    cmd = [
        ffmpeg_path,
        "-ss", str(start),
        "-i", video_path,
        "-t", str(duration),
        "-c:v", encoder,
        "-crf", str(crf),
        "-c:a", "aac",
        "-movflags", "+faststart",
        "-y",
        "-progress", "pipe:1",
        output_path,
    ]

    logger.info("Trim: %.2f-%.2f -> %s", start, end, output_path)

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
                    await ws_manager.broadcast(task_id, "encoding", progress)
            except (ValueError, IndexError):
                pass

    await process.wait()
    if process.returncode != 0:
        raise RuntimeError(f"FFmpeg trim failed (exit code {process.returncode})")

    return output_path


def _build_clip_filter(clip_index: int, clip: dict) -> tuple[str, str]:
    """Build FFmpeg filter chain for a clip with speed/reverse support.

    Returns (video_filter, audio_filter) strings.
    """
    speed = clip.get("speed", 1.0)
    reverse = clip.get("reverse", False)

    v_filters = []
    a_filters = []

    if reverse:
        v_filters.append("reverse")
        a_filters.append("areverse")

    if speed != 1.0:
        v_filters.append(f"setpts={1.0/speed}*PTS")
        a_filters.append(f"atempo={speed}")

    v_chain = f"[{clip_index}:v]" + ",".join(v_filters) + f"[v{clip_index}]" if v_filters else ""
    a_chain = f"[{clip_index}:a]" + ",".join(a_filters) + f"[a{clip_index}]" if a_filters else ""

    return v_chain, a_chain


async def _render_complex(
    ffmpeg_path: str,
    video_path: str,
    edl: list[dict],
    output_path: str,
    encoder: str,
    crf: int,
    task_id: str = "",
    ws_manager=None,
) -> str:
    """Render clips with speed/reverse using FFmpeg complex filter graphs."""
    tmpdir = tempfile.mkdtemp(prefix="ls_edit_")
    clip_paths = []

    try:
        # Phase 1: Extract each clip segment
        for i, clip in enumerate(edl):
            clip_path = os.path.join(tmpdir, f"clip_{i:04d}.mp4")
            clip_duration = clip["source_end"] - clip["source_start"]
            speed = clip.get("speed", 1.0)
            reverse = clip.get("reverse", False)

            if speed == 1.0 and not reverse:
                # Simple extraction
                cmd = [
                    ffmpeg_path,
                    "-ss", str(clip["source_start"]),
                    "-i", video_path,
                    "-t", str(clip_duration),
                    "-c:v", encoder, "-crf", str(crf),
                    "-c:a", "aac",
                    "-movflags", "+faststart",
                    "-y", clip_path,
                ]
            else:
                # Extract with speed/reverse via filter graph
                vf_parts = []
                af_parts = []

                if reverse:
                    vf_parts.append("reverse")
                    af_parts.append("areverse")

                if speed != 1.0:
                    vf_parts.append(f"setpts={1.0/speed}*PTS")
                    # atempo only supports 0.5 to 100.0, chain multiple for extreme values
                    remaining_speed = speed
                    while remaining_speed > 2.0:
                        af_parts.append("atempo=2.0")
                        remaining_speed /= 2.0
                    while remaining_speed < 0.5:
                        af_parts.append("atempo=0.5")
                        remaining_speed *= 2.0
                    af_parts.append(f"atempo={remaining_speed:.4f}")

                cmd = [
                    ffmpeg_path,
                    "-ss", str(clip["source_start"]),
                    "-i", video_path,
                    "-t", str(clip_duration),
                    "-vf", ",".join(vf_parts) if vf_parts else "null",
                    "-af", ",".join(af_parts) if af_parts else "anull",
                    "-c:v", encoder, "-crf", str(crf),
                    "-c:a", "aac",
                    "-movflags", "+faststart",
                    "-y", clip_path,
                ]

            process = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
            )
            await process.wait()

            if process.returncode != 0:
                raise RuntimeError(f"Failed to process clip {i}")

            clip_paths.append(clip_path)

            progress = ((i + 1) / len(edl)) * 50
            if ws_manager and task_id:
                await ws_manager.broadcast(task_id, "encoding", progress)

        # Phase 2: Concatenate all processed clips
        concat_file = os.path.join(tmpdir, "concat.txt")
        with open(concat_file, "w") as f:
            for path in clip_paths:
                safe = path.replace("\\", "/").replace("'", "'\\''")
                f.write(f"file '{safe}'\n")

        total_duration = sum(
            (c["source_end"] - c["source_start"]) / c.get("speed", 1.0)
            for c in edl
        )

        cmd = [
            ffmpeg_path,
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file,
            "-c", "copy",
            "-movflags", "+faststart",
            "-y",
            "-progress", "pipe:1",
            output_path,
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
        )

        async for line in process.stdout:
            line_str = line.decode().strip()
            if line_str.startswith("out_time_ms=") and total_duration > 0:
                try:
                    time_ms = int(line_str.split("=")[1])
                    progress = 50 + min(49, (time_ms / 1_000_000 / total_duration) * 50)
                    if ws_manager and task_id:
                        await ws_manager.broadcast(task_id, "encoding", progress)
                except (ValueError, IndexError):
                    pass

        await process.wait()
        if process.returncode != 0:
            raise RuntimeError(f"FFmpeg concat failed (exit code {process.returncode})")

        logger.info("EDL render complete: %s", output_path)
        return output_path

    finally:
        for path in clip_paths:
            try:
                os.unlink(path)
            except OSError:
                pass
        try:
            concat_path = os.path.join(tmpdir, "concat.txt")
            if os.path.exists(concat_path):
                os.unlink(concat_path)
            os.rmdir(tmpdir)
        except OSError:
            pass
