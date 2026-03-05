"""B-Roll suggestion using Gemini + free stock video APIs (Pexels/Pixabay)."""

import asyncio
import json
import logging
from typing import Optional

import httpx

from config import settings

logger = logging.getLogger(__name__)

PEXELS_API_URL = "https://api.pexels.com/videos/search"
PIXABAY_API_URL = "https://pixabay.com/api/videos/"


async def suggest_broll(
    segments: list[dict],
    max_suggestions: int = 5,
    context: str = "",
) -> list[dict]:
    """Use Gemini to suggest B-roll search terms for key moments.

    Returns:
    [
        {
            "start": float,
            "end": float,
            "search_term": str,
            "reason": str,
            "results": [{url, thumbnail, duration, source}]
        }
    ]
    """
    try:
        import google.generativeai as genai
    except ImportError:
        raise RuntimeError("google-generativeai not installed")

    api_key = settings.gemini_api_key
    if not api_key:
        raise ValueError("Gemini API key not configured")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(settings.gemini_model or "gemini-2.0-flash")

    # Build transcript
    transcript_lines = []
    for seg in segments:
        start = seg.get("start", 0)
        end = seg.get("end", 0)
        text = seg.get("text", "")
        transcript_lines.append(f"[{start:.1f}s-{end:.1f}s] {text}")

    transcript = "\n".join(transcript_lines)

    prompt = f"""Analyze this video transcript and suggest {max_suggestions} moments where B-roll footage would enhance the video.

For each moment, provide a concise stock video search term (2-4 words) that would find relevant footage.

{f'Video context: {context}' if context else ''}

Transcript:
{transcript}

Respond with a JSON array only:
[
  {{
    "start": <start time in seconds>,
    "end": <end time in seconds>,
    "search_term": "<stock video search keywords>",
    "reason": "<why B-roll would help here>"
  }}
]"""

    response = await model.generate_content_async(prompt)
    text = response.text.strip()

    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    suggestions = json.loads(text)

    # Search stock footage for each suggestion
    results = []
    for sug in suggestions:
        if not isinstance(sug, dict):
            continue
        search_term = sug.get("search_term", "")
        if not search_term:
            continue

        stock_results = await _search_stock_footage(search_term)

        results.append({
            "start": round(float(sug.get("start", 0)), 2),
            "end": round(float(sug.get("end", 0)), 2),
            "search_term": search_term,
            "reason": sug.get("reason", ""),
            "results": stock_results[:3],
        })

    return results[:max_suggestions]


async def search_stock(query: str, per_page: int = 6) -> list[dict]:
    """Search stock footage from Pexels/Pixabay."""
    return await _search_stock_footage(query, per_page)


async def _search_stock_footage(query: str, per_page: int = 3) -> list[dict]:
    """Search free stock video APIs."""
    results = []

    async with httpx.AsyncClient(timeout=10) as client:
        # Try Pexels first
        pexels_key = getattr(settings, "pexels_api_key", None) or ""
        if pexels_key:
            try:
                resp = await client.get(
                    PEXELS_API_URL,
                    params={"query": query, "per_page": per_page},
                    headers={"Authorization": pexels_key},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for video in data.get("videos", []):
                        files = video.get("video_files", [])
                        # Pick HD quality
                        best = next((f for f in files if f.get("quality") == "hd"), files[0] if files else None)
                        if best:
                            results.append({
                                "url": best["link"],
                                "thumbnail": video.get("image", ""),
                                "duration": video.get("duration", 0),
                                "source": "pexels",
                                "width": best.get("width", 0),
                                "height": best.get("height", 0),
                            })
            except Exception as e:
                logger.debug("Pexels search failed: %s", e)

        # Try Pixabay
        pixabay_key = getattr(settings, "pixabay_api_key", None) or ""
        if pixabay_key and len(results) < per_page:
            try:
                resp = await client.get(
                    PIXABAY_API_URL,
                    params={"key": pixabay_key, "q": query, "per_page": per_page},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for hit in data.get("hits", []):
                        videos = hit.get("videos", {})
                        medium = videos.get("medium", {})
                        if medium.get("url"):
                            results.append({
                                "url": medium["url"],
                                "thumbnail": hit.get("userImageURL", ""),
                                "duration": hit.get("duration", 0),
                                "source": "pixabay",
                                "width": medium.get("width", 0),
                                "height": medium.get("height", 0),
                            })
            except Exception as e:
                logger.debug("Pixabay search failed: %s", e)

    return results
