"""AI background removal using rembg (U2Net).

Processes video frame-by-frame:
1. Extract frames with FFmpeg
2. Remove background with rembg
3. Composite onto replacement background (color/blur/image)
4. Re-encode with FFmpeg
"""

import asyncio
import logging
import os
import shutil
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from core.ffmpeg_utils import get_ffmpeg_path

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=2)


async def remove_background(
    video_path: str,
    output_path: str,
    mode: str = "remove",  # "remove" | "blur" | "replace"
    bg_color: str = "#00FF00",
    bg_image_path: str | None = None,
    blur_strength: int = 21,
    model_name: str = "u2net",
    task_id: str = "",
    ws_manager=None,
) -> str:
    """Remove or replace video background.

    Modes:
    - remove: transparent/green background
    - blur: blur the original background
    - replace: composite onto bg_image or bg_color
    """
    try:
        from rembg import remove as rembg_remove, new_session
    except ImportError:
        raise RuntimeError(
            "rembg is not installed. Install with: pip install rembg[gpu]"
        )

    try:
        from PIL import Image
    except ImportError:
        raise RuntimeError("Pillow is not installed. Install with: pip install Pillow")

    ffmpeg_path = get_ffmpeg_path()
    tmpdir = tempfile.mkdtemp(prefix="ls_bg_")
    frames_dir = os.path.join(tmpdir, "frames")
    output_dir = os.path.join(tmpdir, "output")
    os.makedirs(frames_dir)
    os.makedirs(output_dir)

    try:
        # Step 1: Extract frames
        if ws_manager and task_id:
            await ws_manager.broadcast(task_id, "bg_removal", 0, message="Extracting frames...")

        fps = await _get_fps(ffmpeg_path, video_path)
        await _extract_frames(ffmpeg_path, video_path, frames_dir)

        frame_files = sorted(Path(frames_dir).glob("*.png"))
        total_frames = len(frame_files)

        if total_frames == 0:
            raise RuntimeError("No frames extracted from video")

        logger.info("Extracted %d frames at %.1f fps", total_frames, fps)

        # Step 2: Create rembg session
        session = await asyncio.get_event_loop().run_in_executor(
            _executor, new_session, model_name
        )

        # Step 3: Parse background settings
        bg = _parse_bg_color(bg_color) if mode != "blur" else None
        bg_img = None
        if mode == "replace" and bg_image_path:
            bg_img = Image.open(bg_image_path)

        # Step 4: Process frames
        for i, frame_path in enumerate(frame_files):
            output_frame = os.path.join(output_dir, frame_path.name)

            await asyncio.get_event_loop().run_in_executor(
                _executor,
                _process_frame,
                str(frame_path), output_frame, session, rembg_remove,
                mode, bg, bg_img, blur_strength, Image,
            )

            if ws_manager and task_id and i % 10 == 0:
                progress = 10 + (i / total_frames) * 80  # 10-90%
                await ws_manager.broadcast(
                    task_id, "bg_removal", progress,
                    message=f"Processing frame {i+1}/{total_frames}"
                )

        # Step 5: Re-encode
        if ws_manager and task_id:
            await ws_manager.broadcast(task_id, "bg_removal", 90, message="Encoding video...")

        await _encode_frames(ffmpeg_path, output_dir, video_path, output_path, fps)

        if ws_manager and task_id:
            await ws_manager.broadcast(task_id, "bg_removal", 100, message="Complete")

        logger.info("Background removal complete: %s", output_path)
        return output_path

    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _process_frame(
    input_path: str,
    output_path: str,
    session,
    rembg_remove,
    mode: str,
    bg_color: tuple | None,
    bg_img,
    blur_strength: int,
    pil_module,
):
    """Process a single frame (runs in thread pool)."""
    img = pil_module.Image.open(input_path)

    if mode == "blur":
        # Get mask, blur original, composite
        from PIL import ImageFilter
        mask = rembg_remove(img, session=session, only_mask=True)
        blurred = img.filter(ImageFilter.GaussianBlur(radius=blur_strength))
        # Composite: foreground where mask is white, blurred where mask is black
        result = pil_module.Image.composite(img, blurred, mask)
        result.save(output_path)

    elif mode == "replace":
        # Remove background, get RGBA
        fg = rembg_remove(img, session=session)
        if bg_img is not None:
            background = bg_img.resize(img.size).convert("RGBA")
        elif bg_color is not None:
            background = pil_module.Image.new("RGBA", img.size, bg_color + (255,))
        else:
            background = pil_module.Image.new("RGBA", img.size, (0, 255, 0, 255))
        background.paste(fg, mask=fg.split()[3] if fg.mode == "RGBA" else None)
        background.convert("RGB").save(output_path)

    else:  # "remove" - green screen or transparent
        fg = rembg_remove(img, session=session)
        if bg_color:
            background = pil_module.Image.new("RGBA", img.size, bg_color + (255,))
            background.paste(fg, mask=fg.split()[3] if fg.mode == "RGBA" else None)
            background.convert("RGB").save(output_path)
        else:
            fg.save(output_path)


def _parse_bg_color(hex_color: str) -> tuple:
    """Parse hex color string to RGB tuple."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 6:
        return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
    return (0, 255, 0)


async def _get_fps(ffmpeg_path: str, video_path: str) -> float:
    """Get video FPS."""
    ffprobe = ffmpeg_path.replace("ffmpeg", "ffprobe")
    cmd = [
        ffprobe, "-v", "quiet",
        "-select_streams", "v:0",
        "-show_entries", "stream=r_frame_rate",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path,
    ]
    process = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await process.communicate()
    rate_str = stdout.decode().strip()
    if "/" in rate_str:
        num, den = rate_str.split("/")
        return float(num) / float(den)
    return float(rate_str) if rate_str else 30.0


async def _extract_frames(ffmpeg_path: str, video_path: str, output_dir: str):
    """Extract all frames as PNG."""
    cmd = [
        ffmpeg_path,
        "-i", video_path,
        "-vsync", "cfr",
        os.path.join(output_dir, "frame_%06d.png"),
    ]
    process = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
    )
    await process.wait()
    if process.returncode != 0:
        raise RuntimeError("Failed to extract frames")


async def _encode_frames(
    ffmpeg_path: str,
    frames_dir: str,
    original_video: str,
    output_path: str,
    fps: float,
):
    """Encode processed frames back to video with original audio."""
    cmd = [
        ffmpeg_path,
        "-framerate", str(fps),
        "-i", os.path.join(frames_dir, "frame_%06d.png"),
        "-i", original_video,
        "-map", "0:v",
        "-map", "1:a?",
        "-c:v", "libx264",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-movflags", "+faststart",
        "-shortest",
        "-y",
        output_path,
    ]
    process = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
    )
    await process.wait()
    if process.returncode != 0:
        raise RuntimeError("Failed to encode processed frames")
