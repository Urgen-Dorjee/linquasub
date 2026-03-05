"""Speaker diarization — identify who speaks per segment.

Uses Gemini to analyze audio/transcript context for speaker identification
when pyannote-audio is not available, falls back to simple heuristic grouping.
"""

import asyncio
import json
import logging
import os
import tempfile

from core.ffmpeg_utils import get_ffmpeg_path
from config import settings

logger = logging.getLogger(__name__)


async def diarize_segments(
    video_path: str,
    segments: list[dict],
    num_speakers: int = 0,
) -> list[dict]:
    """Identify speaker for each segment.

    Returns segments with added 'speaker' field (e.g. "Speaker 1", "Speaker 2").

    Strategy:
    1. Try pyannote-audio if available (best quality)
    2. Fall back to Gemini-based speaker analysis
    3. Last resort: simple pause-based grouping
    """
    # Strategy 1: pyannote
    try:
        return await _diarize_pyannote(video_path, segments, num_speakers)
    except ImportError:
        logger.info("pyannote-audio not available, trying Gemini")
    except Exception as e:
        logger.warning("pyannote diarization failed: %s", e)

    # Strategy 2: Gemini
    if settings.gemini_api_key:
        try:
            return await _diarize_gemini(segments, num_speakers)
        except Exception as e:
            logger.warning("Gemini diarization failed: %s", e)

    # Strategy 3: Pause-based heuristic
    return _diarize_heuristic(segments, num_speakers or 2)


async def _diarize_pyannote(
    video_path: str,
    segments: list[dict],
    num_speakers: int,
) -> list[dict]:
    """Diarize using pyannote-audio pipeline."""
    from pyannote.audio import Pipeline
    import torch

    ffmpeg_path = get_ffmpeg_path()

    # Extract audio to WAV
    tmpfile = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmpfile.close()

    try:
        cmd = [
            ffmpeg_path, "-i", video_path,
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            "-y", tmpfile.name,
        ]
        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
        )
        await process.wait()

        # Run pyannote pipeline
        device = "cuda" if torch.cuda.is_available() else "cpu"
        pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=os.environ.get("HF_TOKEN", ""),
        )
        pipeline.to(torch.device(device))

        params = {}
        if num_speakers > 0:
            params["num_speakers"] = num_speakers

        loop = asyncio.get_event_loop()
        diarization = await loop.run_in_executor(
            None, lambda: pipeline(tmpfile.name, **params)
        )

        # Map diarization results to segments
        speaker_map = {}
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            speaker_map.setdefault(speaker, []).append((turn.start, turn.end))

        result = []
        for seg in segments:
            seg_mid = (seg["start"] + seg["end"]) / 2
            best_speaker = "Unknown"
            for speaker, turns in speaker_map.items():
                for t_start, t_end in turns:
                    if t_start <= seg_mid <= t_end:
                        best_speaker = speaker
                        break
            result.append({**seg, "speaker": best_speaker})

        # Normalize speaker labels
        unique_speakers = sorted(set(s["speaker"] for s in result))
        label_map = {sp: f"Speaker {i+1}" for i, sp in enumerate(unique_speakers)}
        for seg in result:
            seg["speaker"] = label_map.get(seg["speaker"], seg["speaker"])

        return result

    finally:
        try:
            os.unlink(tmpfile.name)
        except OSError:
            pass


async def _diarize_gemini(
    segments: list[dict],
    num_speakers: int,
) -> list[dict]:
    """Use Gemini to infer speakers from transcript context."""
    import google.generativeai as genai

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(settings.gemini_model or "gemini-2.0-flash")

    transcript_lines = []
    for i, seg in enumerate(segments):
        transcript_lines.append(
            f"[{i}] ({seg['start']:.1f}s-{seg['end']:.1f}s) {seg['text']}"
        )
    transcript = "\n".join(transcript_lines)

    speaker_hint = f"There are approximately {num_speakers} speakers." if num_speakers > 0 else ""

    prompt = f"""Analyze this transcript and identify different speakers.
{speaker_hint}

Look for:
- Changes in topic or perspective
- Conversational turn-taking patterns
- Questions followed by answers
- Pauses between speakers

Transcript:
{transcript}

Respond with a JSON array only. Each element: {{"index": <segment index>, "speaker": "<Speaker N>"}}
Assign consistent speaker labels (Speaker 1, Speaker 2, etc.)."""

    response = await model.generate_content_async(prompt)
    text = response.text.strip()

    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    assignments = json.loads(text)
    speaker_lookup = {a["index"]: a["speaker"] for a in assignments}

    result = []
    for i, seg in enumerate(segments):
        result.append({**seg, "speaker": speaker_lookup.get(i, "Speaker 1")})

    return result


def _diarize_heuristic(segments: list[dict], num_speakers: int) -> list[dict]:
    """Simple pause-based speaker alternation."""
    if not segments:
        return segments

    result = []
    current_speaker = 0
    prev_end = 0

    for seg in segments:
        gap = seg["start"] - prev_end
        # If gap > 1.5s, likely a speaker change
        if gap > 1.5 and prev_end > 0:
            current_speaker = (current_speaker + 1) % max(num_speakers, 2)
        result.append({**seg, "speaker": f"Speaker {current_speaker + 1}"})
        prev_end = seg["end"]

    return result
