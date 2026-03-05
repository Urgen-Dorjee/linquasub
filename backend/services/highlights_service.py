"""AI-powered highlight detection using Gemini.

Analyzes transcription segments and suggests the most engaging/interesting
portions for social media clips.
"""

import json
import logging
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)


async def detect_highlights(
    segments: list[dict],
    max_highlights: int = 5,
    min_clip_duration: float = 15.0,
    max_clip_duration: float = 60.0,
    context: str = "",
) -> list[dict]:
    """Use Gemini to analyze segments and suggest highlights.

    Returns list of:
    {
        "start": float,
        "end": float,
        "title": str,
        "reason": str,
        "score": float (0-1)
    }
    """
    try:
        import google.generativeai as genai
    except ImportError:
        raise RuntimeError("google-generativeai is not installed")

    api_key = settings.gemini_api_key
    if not api_key:
        raise ValueError("Gemini API key not configured")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(settings.gemini_model or "gemini-2.0-flash")

    # Build transcript text with timestamps
    transcript_lines = []
    for seg in segments:
        start = seg.get("start", 0)
        end = seg.get("end", 0)
        text = seg.get("text", "")
        transcript_lines.append(f"[{_format_time(start)} - {_format_time(end)}] {text}")

    transcript = "\n".join(transcript_lines)

    prompt = f"""Analyze this video transcript and identify the {max_highlights} most engaging highlights suitable for social media clips.

Each highlight should be:
- Between {min_clip_duration:.0f} and {max_clip_duration:.0f} seconds long
- A self-contained, interesting moment (humor, insight, key point, emotional moment, surprising fact)
- Start and end at natural sentence boundaries

{f'Context about this video: {context}' if context else ''}

Transcript:
{transcript}

Respond with a JSON array only (no markdown, no explanation). Each element:
{{
  "start": <start time in seconds>,
  "end": <end time in seconds>,
  "title": "<short catchy title for this clip>",
  "reason": "<why this is highlight-worthy>",
  "score": <relevance score 0.0 to 1.0>
}}

Order by score descending (best highlight first)."""

    try:
        response = await model.generate_content_async(prompt)
        text = response.text.strip()

        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        highlights = json.loads(text)

        # Validate and clamp
        validated = []
        for h in highlights:
            if not isinstance(h, dict):
                continue
            start = float(h.get("start", 0))
            end = float(h.get("end", 0))
            if end <= start or end - start < 5:
                continue
            validated.append({
                "start": round(start, 2),
                "end": round(end, 2),
                "title": str(h.get("title", "Highlight")),
                "reason": str(h.get("reason", "")),
                "score": max(0, min(1, float(h.get("score", 0.5)))),
            })

        validated.sort(key=lambda x: x["score"], reverse=True)
        logger.info("Detected %d highlights", len(validated))
        return validated[:max_highlights]

    except json.JSONDecodeError as e:
        logger.error("Failed to parse Gemini response: %s", e)
        raise RuntimeError("AI returned invalid highlight data")
    except Exception as e:
        logger.error("Highlight detection failed: %s", e)
        raise


def _format_time(seconds: float) -> str:
    m = int(seconds) // 60
    s = int(seconds) % 60
    return f"{m:02d}:{s:02d}"
