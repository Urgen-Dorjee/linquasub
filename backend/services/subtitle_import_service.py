"""
Parse and import existing subtitle files (SRT, VTT, ASS) into segment format.
"""
import re
import uuid
from typing import Optional


def _parse_srt_time(time_str: str) -> float:
    """Parse SRT timestamp (HH:MM:SS,mmm) to seconds."""
    match = re.match(r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})", time_str.strip())
    if not match:
        return 0.0
    h, m, s, ms = match.groups()
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def _parse_ass_time(time_str: str) -> float:
    """Parse ASS timestamp (H:MM:SS.cc) to seconds."""
    match = re.match(r"(\d+):(\d{2}):(\d{2})\.(\d{2})", time_str.strip())
    if not match:
        return 0.0
    h, m, s, cs = match.groups()
    return int(h) * 3600 + int(m) * 60 + int(s) + int(cs) / 100


def parse_srt(content: str) -> list[dict]:
    """Parse SRT subtitle content into segments."""
    segments = []
    blocks = re.split(r"\n\s*\n", content.strip())

    for block in blocks:
        lines = block.strip().split("\n")
        if len(lines) < 2:
            continue

        # Find the timestamp line
        time_line = None
        text_lines = []
        for i, line in enumerate(lines):
            if "-->" in line:
                time_line = line
                text_lines = lines[i + 1:]
                break

        if not time_line:
            continue

        parts = time_line.split("-->")
        if len(parts) != 2:
            continue

        start = _parse_srt_time(parts[0])
        end = _parse_srt_time(parts[1])
        text = "\n".join(text_lines).strip()

        if text:
            segments.append({
                "id": str(uuid.uuid4())[:8],
                "start": start,
                "end": end,
                "text": text,
                "words": [],
            })

    return segments


def parse_vtt(content: str) -> list[dict]:
    """Parse WebVTT subtitle content into segments."""
    segments = []

    # Remove WEBVTT header and any metadata
    lines = content.strip().split("\n")
    start_idx = 0
    for i, line in enumerate(lines):
        if line.strip().upper().startswith("WEBVTT"):
            start_idx = i + 1
            break

    content_after_header = "\n".join(lines[start_idx:])
    blocks = re.split(r"\n\s*\n", content_after_header.strip())

    for block in blocks:
        block_lines = block.strip().split("\n")
        if len(block_lines) < 2:
            continue

        time_line = None
        text_lines = []
        for i, line in enumerate(block_lines):
            if "-->" in line:
                time_line = line
                text_lines = block_lines[i + 1:]
                break

        if not time_line:
            continue

        parts = time_line.split("-->")
        if len(parts) != 2:
            continue

        start = _parse_srt_time(parts[0])  # VTT uses same format as SRT (but with .)
        end = _parse_srt_time(parts[1])
        text = "\n".join(text_lines).strip()
        # Remove VTT formatting tags
        text = re.sub(r"<[^>]+>", "", text)

        if text:
            segments.append({
                "id": str(uuid.uuid4())[:8],
                "start": start,
                "end": end,
                "text": text,
                "words": [],
            })

    return segments


def parse_ass(content: str) -> list[dict]:
    """Parse ASS/SSA subtitle content into segments."""
    segments = []

    in_events = False
    format_fields = None

    for line in content.split("\n"):
        line = line.strip()

        if line.lower().startswith("[events]"):
            in_events = True
            continue

        if in_events and line.lower().startswith("format:"):
            format_str = line[len("format:"):].strip()
            format_fields = [f.strip().lower() for f in format_str.split(",")]
            continue

        if in_events and line.lower().startswith("dialogue:"):
            if not format_fields:
                continue

            # Split only up to the number of format fields
            data = line[len("dialogue:"):].strip()
            parts = data.split(",", len(format_fields) - 1)

            if len(parts) < len(format_fields):
                continue

            field_map = dict(zip(format_fields, parts))

            start = _parse_ass_time(field_map.get("start", "0:00:00.00"))
            end = _parse_ass_time(field_map.get("end", "0:00:00.00"))
            text = field_map.get("text", "")

            # Remove ASS override tags
            text = re.sub(r"\{[^}]*\}", "", text)
            text = text.replace("\\N", "\n").replace("\\n", "\n").strip()

            if text:
                segments.append({
                    "id": str(uuid.uuid4())[:8],
                    "start": start,
                    "end": end,
                    "text": text,
                    "words": [],
                })

        # Stop parsing events if we hit a new section
        if in_events and line.startswith("[") and not line.lower().startswith("[events"):
            break

    return segments


def parse_subtitle_file(content: str, format: str) -> list[dict]:
    """Parse a subtitle file based on format."""
    format = format.lower()
    if format == "srt":
        return parse_srt(content)
    elif format == "vtt":
        return parse_vtt(content)
    elif format in ("ass", "ssa"):
        return parse_ass(content)
    else:
        raise ValueError(f"Unsupported subtitle format: {format}")


async def import_subtitle_file(file_path: str) -> list[dict]:
    """Read and parse a subtitle file."""
    ext = file_path.rsplit(".", 1)[-1].lower()

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    return parse_subtitle_file(content, ext)
