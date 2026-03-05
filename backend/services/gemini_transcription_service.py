import asyncio
import json
import logging
import os
import re
import tempfile

from config import settings
from core.ffmpeg_utils import get_ffmpeg_path

logger = logging.getLogger(__name__)

MAX_RETRIES = 5

LANGUAGE_NAMES = {
    "auto": None,
    "en": "English",
    "bo": "Tibetan",
    "zh": "Chinese",
    "hi": "Hindi",
    "ne": "Nepali",
    "ja": "Japanese",
    "ko": "Korean",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ar": "Arabic",
    "ru": "Russian",
    "th": "Thai",
    "vi": "Vietnamese",
    "id": "Indonesian",
    "ms": "Malay",
    "tr": "Turkish",
    "pl": "Polish",
    "uk": "Ukrainian",
    "nl": "Dutch",
    "sv": "Swedish",
    "da": "Danish",
    "fi": "Finnish",
    "el": "Greek",
    "he": "Hebrew",
    "bn": "Bengali",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
    "pa": "Punjabi",
    "ur": "Urdu",
    "my": "Burmese",
    "km": "Khmer",
    "lo": "Lao",
    "ka": "Georgian",
    "am": "Amharic",
    "sw": "Swahili",
}


def _is_rate_limit_error(e: Exception) -> bool:
    """Check if an exception is a Gemini rate limit / quota error."""
    error_str = str(e).lower()
    return any(kw in error_str for kw in [
        "resourceexhausted", "resource_exhausted", "resource exhausted",
        "429", "quota", "rate limit", "rate_limit",
        "too many requests", "retry_delay",
    ])


def _extract_retry_delay(e: Exception) -> int:
    """Try to extract the suggested retry delay from the error message."""
    error_str = str(e)
    match = re.search(r'retry_delay\s*\{\s*seconds:\s*(\d+)', error_str)
    if match:
        return int(match.group(1))
    return 0


async def _call_with_retry(func, loop, max_retries=MAX_RETRIES,
                            task_id="", ws_manager=None, phase_msg="",
                            current_progress=None):
    """Call a blocking function with retry on rate limit errors.

    current_progress: if provided, rate-limit messages keep this progress
    value instead of resetting to 0 (which causes UI progress bouncing).
    """
    for attempt in range(max_retries + 1):
        try:
            return await loop.run_in_executor(None, func)
        except Exception as e:
            if _is_rate_limit_error(e) and attempt < max_retries:
                suggested = _extract_retry_delay(e)
                wait_time = max(suggested + 5, 30 * (attempt + 1))
                wait_time = min(wait_time, 120)
                logger.warning(
                    "Rate limited (attempt %d/%d). Waiting %ds before retry...",
                    attempt + 1, max_retries, wait_time
                )
                if ws_manager and task_id:
                    await ws_manager.broadcast(
                        task_id, "transcription",
                        current_progress if current_progress is not None else 0,
                        phase="rate_limited",
                        message=f"API rate limited. Retrying in {wait_time}s... (attempt {attempt + 1}/{max_retries})",
                    )
                await asyncio.sleep(wait_time)
                continue
            raise


async def _extract_audio(video_path: str) -> str:
    """Extract audio from video as high-quality MP3 for Gemini.

    Uses 44.1kHz stereo 192kbps to preserve speech nuances that are critical
    for accurate transcription, especially for tonal/complex languages like Tibetan.
    The old 16kHz mono 128k was destroying subtle phonetic distinctions.
    """
    ffmpeg_path = get_ffmpeg_path()
    fd, output_path = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)

    cmd = [
        ffmpeg_path,
        "-i", video_path,
        "-vn",
        "-acodec", "libmp3lame",
        "-ab", "192k",
        "-ar", "44100",
        "-ac", "2",
        "-y",
        output_path,
    ]

    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()

    if process.returncode != 0:
        if os.path.exists(output_path):
            os.unlink(output_path)
        raise RuntimeError(f"Audio extraction failed: {stderr.decode()}")

    # If audio is too large for Gemini inline (>19MB), re-extract at lower quality
    audio_size = os.path.getsize(output_path)
    if audio_size > 19 * 1024 * 1024:
        logger.info("Audio too large (%.1f MB), re-extracting at lower quality...",
                     audio_size / 1024 / 1024)
        os.unlink(output_path)
        fd, output_path = tempfile.mkstemp(suffix=".mp3")
        os.close(fd)
        cmd_lower = [
            ffmpeg_path,
            "-i", video_path,
            "-vn",
            "-acodec", "libmp3lame",
            "-ab", "128k",
            "-ar", "22050",
            "-ac", "1",
            "-y",
            output_path,
        ]
        process = await asyncio.create_subprocess_exec(
            *cmd_lower,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            if os.path.exists(output_path):
                os.unlink(output_path)
            raise RuntimeError(f"Audio extraction failed: {stderr.decode()}")

    return output_path


async def transcribe_audio_gemini(
    video_path: str,
    language: str = "auto",
    target_lang: str = "",
    task_id: str = "",
    ws_manager=None,
    cancel_check=None,
    progress_callback=None,
) -> dict:
    """Transcribe video/audio using Google Gemini API.

    Sends the actual video file to Gemini via File API so it gets both
    visual and audio context — matching what the Gemini portal does.
    This dramatically improves transcription accuracy for all languages.
    """
    logger.info("Starting Gemini transcription for: %s", video_path)

    try:
        import google.generativeai as genai
    except ImportError as e:
        logger.error("Failed to import google.generativeai: %s", e)
        raise RuntimeError(f"google-generativeai package not available: {e}")

    api_key = settings.gemini_api_key
    if not api_key:
        raise ValueError("Gemini API key not configured. Set it in Settings.")

    genai.configure(api_key=api_key)
    model_name = settings.gemini_model or "gemini-2.5-flash"
    logger.info("Using Gemini model: %s", model_name)
    model = genai.GenerativeModel(model_name)

    # Phase 1: Upload video file to Gemini (gives it visual + audio context)
    logger.info("Phase 1: Uploading video to Gemini...")
    if progress_callback:
        progress_callback(5)
    if ws_manager and task_id:
        await ws_manager.broadcast(
            task_id, "transcription", 5,
            phase="uploading",
            message="Uploading video to Gemini AI...",
        )

    loop = asyncio.get_event_loop()
    uploaded_file = None

    try:
        # Upload the video file — Gemini gets BOTH video and audio
        # This matches what the Gemini portal does and gives best accuracy
        def do_upload():
            return genai.upload_file(video_path)

        uploaded_file = await _call_with_retry(
            do_upload, loop, task_id=task_id, ws_manager=ws_manager,
            phase_msg="uploading video", current_progress=5,
        )
        logger.info("Video uploaded: %s (name=%s)", uploaded_file.display_name, uploaded_file.name)

        # Wait for file to be processed
        import time as _time
        def wait_for_processing():
            f = uploaded_file
            while f.state.name == "PROCESSING":
                _time.sleep(2)
                f = genai.get_file(f.name)
            if f.state.name == "FAILED":
                raise RuntimeError(f"Gemini file processing failed: {f.state.name}")
            return f

        if progress_callback:
            progress_callback(10)
        if ws_manager and task_id:
            await ws_manager.broadcast(
                task_id, "transcription", 10,
                phase="processing",
                message="Gemini is processing the video...",
            )

        uploaded_file = await loop.run_in_executor(None, wait_for_processing)
        logger.info("Video processing complete, state: %s", uploaded_file.state.name)

        if cancel_check and cancel_check():
            raise Exception("Transcription cancelled by user")

        # Phase 3: Transcribe with Gemini
        if progress_callback:
            progress_callback(20)
        if ws_manager and task_id:
            await ws_manager.broadcast(
                task_id, "transcription", 20,
                phase="transcribing",
                message="Sending video to Gemini AI for transcription...",
            )

        lang_name = LANGUAGE_NAMES.get(language)
        if lang_name:
            lang_hint = f"The spoken language is {lang_name}."
        else:
            lang_hint = "Auto-detect the spoken language."

        # Determine target language name for combined mode
        target_lang_name = LANGUAGE_NAMES.get(target_lang, target_lang) if target_lang else ""
        combined_mode = bool(target_lang_name)

        if combined_mode:
            prompt = f"""Listen carefully to this audio and produce both an accurate transcription and a natural {target_lang_name} translation.

{lang_hint}

STEP 1 — LISTEN AND UNDERSTAND:
First, listen to the entire audio carefully to understand the full context, meaning, topic, and tone of the speech. Pay attention to proper nouns, numbers, dates, honorific titles, and cultural references.

STEP 2 — TRANSCRIBE:
Transcribe every word spoken in the original language using its native script. Be precise — capture the exact words spoken, including:
- Proper nouns and names (people, places, organizations)
- Numbers and dates in their spoken form
- Honorific and formal language
- Religious, cultural, or technical terminology

STEP 3 — TRANSLATE:
Translate each segment into natural, fluent {target_lang_name}. The translation should:
- Convey the MEANING, not be a word-by-word literal translation
- Sound natural to a native {target_lang_name} speaker
- Preserve the tone (formal, informal, devotional, etc.)
- Translate proper nouns, titles, and cultural terms appropriately for the target audience
- Keep translations concise for subtitle display

OUTPUT FORMAT — return ONLY this JSON (no markdown, no code fences):
{{
  "detected_language": "language name",
  "segments": [
    {{"id": "seg_0000", "start": 0.0, "end": 3.5, "text": "original transcription", "translated_text": "{target_lang_name} translation"}},
    {{"id": "seg_0001", "start": 3.8, "end": 7.2, "text": "original transcription", "translated_text": "{target_lang_name} translation"}}
  ]
}}

RULES:
- "text" = exact original language transcription in native script
- "translated_text" = natural {target_lang_name} translation
- Segment IDs: sequential seg_0000, seg_0001, seg_0002, etc.
- Timestamps in seconds with decimal precision
- Segments should be 3-12 seconds, aligned to natural sentence/phrase boundaries
- Include ALL speech — do not skip any part
- Return ONLY the JSON object"""
        else:
            prompt = f"""Listen carefully to this audio and produce an accurate, complete transcription.

{lang_hint}

INSTRUCTIONS:
1. Listen to the entire audio carefully to understand the context, topic, and content
2. Transcribe every word in the ORIGINAL language using its native script (e.g., Tibetan script for Tibetan, Devanagari for Hindi, Chinese characters for Chinese, etc.)
3. Be precise with the transcription — capture the exact words spoken, including:
   - Proper nouns and names (people, places, organizations)
   - Numbers and dates in their spoken form
   - Honorific and formal language
   - Religious, cultural, or technical terminology
4. Do NOT translate — output only the original spoken language
5. Segment the speech into natural sentences or phrases suitable for subtitles

OUTPUT FORMAT — return ONLY this JSON (no markdown, no code fences):
{{
  "detected_language": "language name",
  "segments": [
    {{"id": "seg_0000", "start": 0.0, "end": 3.5, "text": "transcribed text here"}},
    {{"id": "seg_0001", "start": 3.8, "end": 7.2, "text": "next segment text"}}
  ]
}}

RULES:
- Segment IDs: sequential seg_0000, seg_0001, seg_0002, etc.
- Timestamps in seconds with decimal precision
- Segments should be 3-12 seconds, aligned to natural sentence/phrase boundaries
- Include ALL speech — do not skip any part
- Use proper punctuation for the language
- Return ONLY the JSON object"""

        # Combined mode needs more output tokens (original + translations)
        output_tokens = 131072 if combined_mode else 65536

        def do_transcribe():
            logger.info("Sending transcription request to Gemini (max_tokens=%d)...", output_tokens)
            response = model.generate_content(
                [uploaded_file, prompt],
                generation_config=genai.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=output_tokens,
                ),
                request_options={"timeout": 300},
            )
            logger.info("Gemini response received. Length: %d chars",
                        len(response.text) if response.text else 0)
            return response.text

        # Run the single Gemini call with a heartbeat so UI shows progress
        heartbeat_active = True

        async def _heartbeat():
            elapsed = 0
            while heartbeat_active:
                await asyncio.sleep(3)
                if not heartbeat_active:
                    break
                elapsed += 3
                # Logarithmic progress: approaches 95% but never caps early
                # At 30s: ~55%, 60s: ~70%, 120s: ~82%, 180s: ~88%, 300s: ~93%
                import math
                pct = min(95, 20 + 75 * (1 - math.exp(-elapsed / 120)))
                minutes = elapsed // 60
                secs = elapsed % 60
                if minutes > 0:
                    time_str = f"{minutes}m {secs}s"
                else:
                    time_str = f"{secs}s"
                if combined_mode:
                    msg = f"Gemini is transcribing & translating... ({time_str} elapsed)"
                else:
                    msg = f"Gemini is transcribing... ({time_str} elapsed)"
                if progress_callback:
                    progress_callback(round(pct, 1))
                if ws_manager and task_id:
                    await ws_manager.broadcast(
                        task_id, "transcription", round(pct, 1),
                        phase="transcribing",
                        message=msg,
                    )

        heartbeat_task = asyncio.create_task(_heartbeat())
        try:
            response_text = await asyncio.wait_for(
                _call_with_retry(
                    do_transcribe, loop, task_id=task_id, ws_manager=ws_manager,
                    current_progress=20,
                ),
                timeout=600,  # 10 min overall timeout (includes retries)
            )
        except asyncio.TimeoutError:
            raise RuntimeError(
                "Transcription timed out after 10 minutes. "
                "The video may be too long for Gemini's free tier, or the API is overloaded. "
                "Try again later or use the Whisper engine instead."
            )
        finally:
            heartbeat_active = False
            heartbeat_task.cancel()

        logger.info("Transcription done. Response (first 200 chars): %s",
                     response_text[:200] if response_text else "EMPTY")

        if cancel_check and cancel_check():
            raise Exception("Transcription cancelled by user")

        # Phase 4: Parse response
        if progress_callback:
            progress_callback(90)
        if ws_manager and task_id:
            await ws_manager.broadcast(
                task_id, "transcription", 90,
                phase="parsing",
                message="Processing transcription results...",
            )

        result = _parse_transcription_response(response_text)

        if progress_callback:
            progress_callback(100)
        if ws_manager and task_id:
            await ws_manager.broadcast(
                task_id, "transcription", 100,
                phase="complete",
                message=f"Transcription complete: {len(result['segments'])} segments",
            )

        return result

    finally:
        # Clean up uploaded file from Gemini
        if uploaded_file:
            try:
                genai.delete_file(uploaded_file.name)
                logger.info("Cleaned up uploaded file: %s", uploaded_file.name)
            except Exception:
                pass


def _parse_transcription_response(response_text: str) -> dict:
    """Parse Gemini's transcription response into our segment format.

    Handles both complete and truncated JSON responses (e.g. when combined
    transcription+translation causes the output to exceed max_output_tokens).
    """
    text = response_text.strip()

    # Remove markdown code fences if present
    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
        text = text.strip()

    # Try direct JSON parse (complete response)
    try:
        data = json.loads(text)
        return _normalize_result(data)
    except json.JSONDecodeError:
        pass

    # Try to find complete JSON object in the response
    match = re.search(r'\{[\s\S]*"segments"[\s\S]*\}', text)
    if match:
        try:
            data = json.loads(match.group())
            return _normalize_result(data)
        except json.JSONDecodeError:
            pass

    # Try to extract any complete JSON array of segments
    match = re.search(r'\[[\s\S]*\]', text)
    if match:
        try:
            segments = json.loads(match.group())
            return _normalize_result({"detected_language": "unknown", "segments": segments})
        except json.JSONDecodeError:
            pass

    # Handle TRUNCATED JSON — extract individual complete segment objects
    # This happens when Gemini's response is cut off mid-JSON (max_output_tokens hit)
    logger.warning("JSON parse failed, attempting truncated JSON recovery...")

    # Extract detected_language if present
    lang_match = re.search(r'"detected_language"\s*:\s*"([^"]*)"', text)
    detected_language = lang_match.group(1) if lang_match else "unknown"

    # Find all complete segment objects: {...} blocks containing "id" and "text"
    segments = []
    for seg_match in re.finditer(r'\{[^{}]*"id"\s*:\s*"[^"]*"[^{}]*"text"\s*:\s*"[^"]*"[^{}]*\}', text):
        try:
            seg = json.loads(seg_match.group())
            segments.append(seg)
        except json.JSONDecodeError:
            continue

    if segments:
        logger.info("Recovered %d complete segments from truncated response", len(segments))
        return _normalize_result({"detected_language": detected_language, "segments": segments})

    raise RuntimeError(f"Failed to parse Gemini transcription response. Raw output:\n{text[:500]}")


def _normalize_result(data: dict) -> dict:
    """Normalize the parsed result into our expected format."""
    detected_language = data.get("detected_language", "unknown")
    raw_segments = data.get("segments", [])

    segments = []
    translations = []
    has_translations = False

    for i, seg in enumerate(raw_segments):
        seg_id = seg.get("id", f"seg_{i:04d}")
        start = float(seg.get("start", 0))
        end = float(seg.get("end", 0))
        text = seg.get("text", "").strip()

        if not text:
            continue

        if end <= start:
            end = start + 2.0

        segments.append({
            "id": seg_id,
            "start": round(start, 3),
            "end": round(end, 3),
            "text": text,
            "words": [],
        })

        # Extract translation if present (combined mode)
        translated_text = seg.get("translated_text", "").strip()
        if translated_text:
            has_translations = True
            translations.append({
                "id": seg_id,
                "original_text": text,
                "translated_text": translated_text,
            })

    result = {
        "detected_language": detected_language,
        "segments": segments,
    }

    if has_translations:
        result["translations"] = translations

    return result
