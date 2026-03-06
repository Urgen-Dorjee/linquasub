import asyncio
import json
import os
import sys
import threading

from config import settings
from core.ffmpeg_utils import get_ffmpeg_path


async def download_video(
    url: str,
    quality: str = "best",
    task_id: str = "",
    ws_manager=None,
    output_dir: str | None = None,
) -> str:
    """Download a YouTube video using yt-dlp Python API."""
    if not output_dir:
        output_dir = os.path.join(settings.temp_dir, "downloads")
    os.makedirs(output_dir, exist_ok=True)

    output_template = os.path.join(output_dir, "%(title)s.%(ext)s")

    # Use bundled ffmpeg if available
    ffmpeg_location = None
    try:
        ffmpeg_path = get_ffmpeg_path()
        ffmpeg_location = os.path.dirname(ffmpeg_path)
    except FileNotFoundError:
        pass

    # Progress hook that sends updates via WebSocket
    # yt-dlp downloads video+audio separately, so we track streams to avoid progress regression
    downloaded_path = {"path": ""}
    stream_state = {"stream_index": 0, "max_progress": 0.0}
    loop = asyncio.get_event_loop()

    def progress_hook(d):
        if d["status"] == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes", 0)
            if total > 0:
                stream_pct = (downloaded / total) * 100
                # Map to overall progress: stream 0 = 0-50%, stream 1 = 50-95%
                if stream_state["stream_index"] == 0:
                    pct = stream_pct * 0.5
                else:
                    pct = 50 + stream_pct * 0.45
                # Never go backwards
                pct = max(pct, stream_state["max_progress"])
                stream_state["max_progress"] = pct
                if ws_manager and task_id:
                    asyncio.run_coroutine_threadsafe(
                        ws_manager.broadcast(
                            task_id,
                            "download",
                            pct,
                            message=f"Downloading: {pct:.0f}%",
                        ),
                        loop,
                    )
        elif d["status"] == "finished":
            downloaded_path["path"] = d.get("filename", "")
            stream_state["stream_index"] += 1
            if ws_manager and task_id:
                pct = 50 if stream_state["stream_index"] == 1 else 95
                stream_state["max_progress"] = max(pct, stream_state["max_progress"])
                asyncio.run_coroutine_threadsafe(
                    ws_manager.broadcast(
                        task_id, "download", stream_state["max_progress"],
                        message="Merging audio & video..." if stream_state["stream_index"] >= 2 else "Downloading audio...",
                    ),
                    loop,
                )

    ydl_opts = {
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "outtmpl": output_template,
        "merge_output_format": "mp4",
        "noplaylist": True,
        "progress_hooks": [progress_hook],
        "quiet": True,
        "no_warnings": True,
    }

    if ffmpeg_location:
        ydl_opts["ffmpeg_location"] = ffmpeg_location

    # Run yt-dlp in a thread to avoid blocking the event loop
    import yt_dlp

    def do_download():
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

    await asyncio.to_thread(do_download)

    # Find the downloaded file
    output_path = downloaded_path["path"]
    if not output_path or not os.path.exists(output_path):
        # Search for the most recent mp4 in the output dir
        mp4_files = []
        for f in os.listdir(output_dir):
            full_path = os.path.join(output_dir, f)
            if os.path.isfile(full_path) and f.endswith(".mp4"):
                mp4_files.append((full_path, os.path.getmtime(full_path)))
        if mp4_files:
            mp4_files.sort(key=lambda x: x[1], reverse=True)
            output_path = mp4_files[0][0]

    if not output_path or not os.path.exists(output_path):
        raise RuntimeError("Download completed but output file not found")

    return output_path


async def get_video_info_ffprobe(path: str) -> dict:
    """Get video metadata using ffprobe."""
    try:
        ffmpeg_path = get_ffmpeg_path()
        ffprobe_path = ffmpeg_path.replace("ffmpeg", "ffprobe")
    except FileNotFoundError:
        ffprobe_path = "ffprobe"

    cmd = [
        ffprobe_path,
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        path,
    ]

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    stdout, stderr = await process.communicate()

    if process.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {stderr.decode()}")

    data = json.loads(stdout.decode())

    video_stream = next(
        (s for s in data.get("streams", []) if s["codec_type"] == "video"), {}
    )
    audio_stream = next(
        (s for s in data.get("streams", []) if s["codec_type"] == "audio"), {}
    )
    fmt = data.get("format", {})

    width = int(video_stream.get("width", 0))
    height = int(video_stream.get("height", 0))

    # Parse FPS from r_frame_rate (e.g., "30000/1001")
    fps_str = video_stream.get("r_frame_rate", "0/1")
    try:
        num, den = fps_str.split("/")
        fps = float(num) / float(den) if float(den) > 0 else 0
    except (ValueError, ZeroDivisionError):
        fps = 0

    return {
        "duration": float(fmt.get("duration", 0)),
        "resolution": f"{width}x{height}",
        "fps": round(fps, 2),
        "codec": video_stream.get("codec_name", "unknown"),
        "audio_codec": audio_stream.get("codec_name", "unknown"),
        "file_size_mb": round(float(fmt.get("size", 0)) / (1024 * 1024), 2),
    }
