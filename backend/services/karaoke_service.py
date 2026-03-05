import os
import tempfile
from typing import Optional

from services.subtitle_service import _format_ass_time, _hex_to_ass_color


async def generate_karaoke_ass(
    segments: list,
    style: Optional[dict] = None,
) -> str:
    """Generate ASS subtitle file with karaoke (word-by-word) highlighting tags."""
    if style is None:
        style = {}

    font_family = style.get("font_family", "Arial")
    font_size = style.get("font_size", 48)
    primary_color = _hex_to_ass_color(style.get("primary_color", "#FFFFFF"))
    # Secondary color is the "before highlight" color (what the karaoke fills to)
    secondary_color = _hex_to_ass_color("#00FFFF")  # Cyan highlight
    outline_color = _hex_to_ass_color(style.get("outline_color", "#000000"))
    outline_width = style.get("outline_width", 3)
    margin_v = style.get("margin_v", 40)

    header = f"""[Script Info]
Title: LinguaSub Karaoke
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_family},{font_size},{primary_color},{secondary_color},{outline_color},&H80000000,-1,0,0,0,100,100,0,0,1,{outline_width},0,2,20,20,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"""

    lines = [header]

    for seg in segments:
        start_time = seg.get("start", 0)
        end_time = seg.get("end", 0)
        words = seg.get("words", [])

        if not words:
            # No word-level timestamps, fall back to regular subtitle
            text = seg.get("text", "")
            lines.append(
                f"Dialogue: 0,{_format_ass_time(start_time)},{_format_ass_time(end_time)},Default,,0,0,0,,{text}"
            )
            continue

        # Build karaoke text with \kf tags
        # \kf = smooth fill effect (duration in centiseconds)
        karaoke_parts = []
        for word_data in words:
            word = word_data.get("word", "")
            w_start = word_data.get("start", 0)
            w_end = word_data.get("end", 0)
            duration_cs = int((w_end - w_start) * 100)  # Convert to centiseconds
            duration_cs = max(1, duration_cs)  # Minimum 1 centisecond

            karaoke_parts.append(f"{{\\kf{duration_cs}}}{word}")

        karaoke_text = " ".join(karaoke_parts)

        lines.append(
            f"Dialogue: 0,{_format_ass_time(start_time)},{_format_ass_time(end_time)},Default,,0,0,0,,{karaoke_text}"
        )

    content = "\n".join(lines)

    # Write to temp file
    fd, output_path = tempfile.mkstemp(suffix=".ass")
    os.close(fd)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(content)

    return output_path
