import asyncio
import logging
import re

from core.ffmpeg_utils import get_ffmpeg_path

logger = logging.getLogger(__name__)


async def burn_subtitles(
    video_path: str,
    subtitle_path: str,
    output_path: str,
    video_codec: str = "h264",
    crf: int = 23,
    task_id: str = "",
    ws_manager=None,
) -> str:
    """Burn subtitles onto video using FFmpeg."""
    ffmpeg_path = get_ffmpeg_path()

    # Escape the subtitle path for FFmpeg filter (Windows paths need special handling)
    # FFmpeg ASS filter uses : as separator, so we need to escape colons and backslashes
    escaped_sub_path = subtitle_path.replace("\\", "/").replace(":", "\\:")

    # Build FFmpeg command
    codec_map = {
        "h264": "libx264",
        "h265": "libx265",
    }
    encoder = codec_map.get(video_codec, "libx264")

    cmd = [
        ffmpeg_path,
        "-i", video_path,
        "-vf", f"ass='{escaped_sub_path}'",
        "-c:v", encoder,
        "-crf", str(crf),
        "-c:a", "copy",
        "-movflags", "+faststart",
        "-y",
        "-progress", "pipe:1",
        output_path,
    ]

    logger.info("FFmpeg command: %s", " ".join(cmd))

    # Get total duration for progress calculation
    duration = await _get_duration(ffmpeg_path, video_path)
    logger.info("Video duration: %.1f seconds", duration)

    # CRITICAL: Use stderr=DEVNULL to prevent deadlock.
    # FFmpeg writes huge amounts to stderr (encoding stats, codec info, etc.)
    # If we pipe both stdout and stderr but only read stdout line-by-line,
    # the stderr buffer fills up (~64KB) and FFmpeg blocks forever = deadlock.
    # We get error info from the returncode and progress output instead.
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )

    # Parse FFmpeg progress output from stdout (-progress pipe:1)
    last_progress = 0
    async for line in process.stdout:
        line_str = line.decode().strip()

        if line_str.startswith("out_time_ms="):
            try:
                time_ms = int(line_str.split("=")[1])
                time_s = time_ms / 1_000_000
                if duration > 0:
                    progress = min(99, (time_s / duration) * 100)
                    last_progress = progress
                    if ws_manager and task_id:
                        await ws_manager.broadcast(
                            task_id, "encoding", progress,
                            message=f"Encoding: {progress:.1f}%",
                        )
            except (ValueError, IndexError):
                pass

    await process.wait()
    logger.info("FFmpeg exited with code: %d", process.returncode)

    if process.returncode != 0:
        raise RuntimeError(
            f"FFmpeg encoding failed (exit code {process.returncode}). "
            f"Last progress: {last_progress:.1f}%. "
            f"Check that the video file exists and is not corrupted."
        )

    if ws_manager and task_id:
        await ws_manager.broadcast(
            task_id, "encoding", 100,
            message="Encoding complete",
        )

    logger.info("Export complete: %s", output_path)
    return output_path


async def _get_duration(ffmpeg_path: str, video_path: str) -> float:
    """Get video duration using ffprobe."""
    ffprobe_path = ffmpeg_path.replace("ffmpeg", "ffprobe")

    cmd = [
        ffprobe_path,
        "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path,
    ]

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await process.communicate()
        return float(stdout.decode().strip())
    except Exception:
        return 0
