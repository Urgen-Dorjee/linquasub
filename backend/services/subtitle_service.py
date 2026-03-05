import os
import tempfile
from typing import Optional

from services.subtitle_effects_service import apply_effect, get_effect_duration_ms


def _format_srt_time(seconds: float) -> str:
    """Format seconds to SRT time format: HH:MM:SS,mmm"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _format_vtt_time(seconds: float) -> str:
    """Format seconds to VTT time format: HH:MM:SS.mmm"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def _format_ass_time(seconds: float) -> str:
    """Format seconds to ASS time format: H:MM:SS.cc"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _hex_to_ass_color(hex_color: str) -> str:
    """Convert hex color (#RRGGBB) to ASS color (&H00BBGGRR)."""
    hex_color = hex_color.lstrip("#")
    r = hex_color[0:2]
    g = hex_color[2:4]
    b = hex_color[4:6]
    return f"&H00{b}{g}{r}"


def _hex_to_ass_color_alpha(hex_color: str, opacity: float) -> str:
    """Convert hex color + opacity to ASS color with alpha (&HAABBGGRR)."""
    hex_color = hex_color.lstrip("#")
    r = hex_color[0:2]
    g = hex_color[2:4]
    b = hex_color[4:6]
    alpha = max(0, min(255, int((1 - opacity) * 255)))
    return f"&H{alpha:02X}{b}{g}{r}"


def generate_srt(segments: list) -> str:
    """Generate SRT subtitle content."""
    lines = []
    for i, seg in enumerate(segments):
        start = seg.get("start", 0)
        end = seg.get("end", 0)
        text = seg.get("text", "")
        lines.append(f"{i + 1}")
        lines.append(f"{_format_srt_time(start)} --> {_format_srt_time(end)}")
        lines.append(text)
        lines.append("")
    return "\n".join(lines)


def generate_vtt(segments: list) -> str:
    """Generate WebVTT subtitle content."""
    lines = ["WEBVTT", ""]
    for i, seg in enumerate(segments):
        start = seg.get("start", 0)
        end = seg.get("end", 0)
        text = seg.get("text", "")
        lines.append(f"{i + 1}")
        lines.append(f"{_format_vtt_time(start)} --> {_format_vtt_time(end)}")
        lines.append(text)
        lines.append("")
    return "\n".join(lines)


def generate_ass(segments: list, style: Optional[dict] = None) -> str:
    """Generate ASS subtitle content with advanced styling and effects."""
    if style is None:
        style = {}

    font_family = style.get("font_family", "Arial")
    font_size = style.get("font_size", 24)
    primary_color = _hex_to_ass_color(style.get("primary_color", "#FFFFFF"))
    outline_color = _hex_to_ass_color(style.get("outline_color", "#000000"))
    outline_width = style.get("outline_width", 2)
    margin_v = style.get("margin_v", 30)
    bold = -1 if style.get("bold", False) else 0
    italic = -1 if style.get("italic", False) else 0
    alignment = 2  # Bottom center

    # Background (border style 3 = opaque box, 1 = outline + shadow)
    bg_opacity = style.get("background_opacity", 0)
    bg_color_hex = style.get("background_color", "#000000")

    if bg_opacity > 0:
        border_style = 3  # opaque box
        back_color = _hex_to_ass_color_alpha(bg_color_hex, bg_opacity)
    else:
        border_style = 1  # outline + shadow
        back_color = "&H80000000"

    effect = style.get("effect", "none")

    header = f"""[Script Info]
Title: LinguaSub Export
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_family},{font_size},{primary_color},&H0000FFFF,{outline_color},{back_color},{bold},{italic},0,0,100,100,0,0,{border_style},{outline_width},0,{alignment},20,20,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"""

    lines = [header]
    for seg in segments:
        start_s = seg.get("start", 0)
        end_s = seg.get("end", 0)
        start = _format_ass_time(start_s)
        end = _format_ass_time(end_s)
        text = seg.get("text", "").replace("\n", "\\N")

        if effect and effect != "none":
            duration_ms = get_effect_duration_ms(start_s, end_s)
            text = apply_effect(text, effect, duration_ms)

        lines.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")

    return "\n".join(lines)


async def generate_subtitle_file(
    segments: list,
    format: str = "srt",
    output_path: Optional[str] = None,
    style: Optional[dict] = None,
) -> str:
    """Generate a subtitle file and return the path."""
    if format == "srt":
        content = generate_srt(segments)
    elif format == "vtt":
        content = generate_vtt(segments)
    elif format == "ass":
        content = generate_ass(segments, style)
    else:
        raise ValueError(f"Unsupported format: {format}")

    if output_path is None:
        fd, output_path = tempfile.mkstemp(suffix=f".{format}")
        os.close(fd)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)

    return output_path
