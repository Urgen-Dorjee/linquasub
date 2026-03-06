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


async def _split_audio_chunks(video_path: str, chunk_minutes: int = 10) -> list[str]:
    """Split a video's audio into chunks for long video transcription.

    Returns a list of audio file paths. Each chunk is `chunk_minutes` long.
    """
    ffmpeg_path = get_ffmpeg_path()

    # Get duration
    cmd = [
        ffmpeg_path.replace("ffmpeg", "ffprobe"),
        "-v", "quiet", "-print_format", "json", "-show_format", video_path,
    ]
    process = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    stdout, _ = await process.communicate()
    import json as _json
    duration = float(_json.loads(stdout.decode()).get("format", {}).get("duration", 0))

    if duration <= 0:
        raise RuntimeError("Could not determine video duration")

    chunk_seconds = chunk_minutes * 60
    num_chunks = max(1, int(duration / chunk_seconds) + (1 if duration % chunk_seconds > 0 else 0))

    if num_chunks == 1:
        # Short video — just extract full audio
        path = await _extract_audio(video_path)
        return [path]

    logger.info("Splitting %d-second video into %d chunks of %d minutes each",
                int(duration), num_chunks, chunk_minutes)

    chunks = []
    for i in range(num_chunks):
        start = i * chunk_seconds
        fd, chunk_path = tempfile.mkstemp(suffix=f"_chunk{i}.mp3")
        os.close(fd)

        cmd = [
            ffmpeg_path,
            "-i", video_path,
            "-ss", str(start),
            "-t", str(chunk_seconds),
            "-vn", "-acodec", "libmp3lame",
            "-ab", "128k", "-ar", "22050", "-ac", "1",
            "-y", chunk_path,
        ]
        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await process.communicate()
        if process.returncode != 0:
            logger.warning("Failed to extract chunk %d: %s", i, stderr.decode()[:200])
            continue
        if os.path.exists(chunk_path) and os.path.getsize(chunk_path) > 0:
            chunks.append(chunk_path)

    return chunks


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

    # Phase 1: Split audio into chunks for long videos
    logger.info("Phase 1: Preparing audio...")
    if progress_callback:
        progress_callback(5)
    if ws_manager and task_id:
        await ws_manager.broadcast(
            task_id, "transcription", 5,
            phase="preparing",
            message="Preparing audio for transcription...",
        )

    loop = asyncio.get_event_loop()
    uploaded_file = None
    audio_chunks = []

    try:
        audio_chunks = await _split_audio_chunks(video_path, chunk_minutes=10)
        num_chunks = len(audio_chunks)
        is_chunked = num_chunks > 1
        logger.info("Audio prepared: %d chunk(s)", num_chunks)

        all_segments = []
        all_translations = []
        detected_language = "unknown"
        time_offset = 0.0

        lang_name = LANGUAGE_NAMES.get(language)
        if lang_name:
            lang_hint = f"The spoken language is {lang_name}."
        else:
            lang_hint = "Auto-detect the spoken language."

        target_lang_name = LANGUAGE_NAMES.get(target_lang, target_lang) if target_lang else ""
        combined_mode = bool(target_lang_name)
        output_tokens = 131072 if combined_mode else 65536

        # Process each chunk
        for chunk_idx, chunk_path in enumerate(audio_chunks):
            if cancel_check and cancel_check():
                raise Exception("Transcription cancelled by user")

            chunk_label = f"chunk {chunk_idx + 1}/{num_chunks}" if is_chunked else "audio"
            # Progress range for this chunk: spread evenly across 10%-90%
            chunk_progress_start = 10 + (80 * chunk_idx / num_chunks)
            chunk_progress_end = 10 + (80 * (chunk_idx + 1) / num_chunks)

            # Upload chunk
            if ws_manager and task_id:
                await ws_manager.broadcast(
                    task_id, "transcription", round(chunk_progress_start),
                    phase="uploading",
                    message=f"Uploading {chunk_label} to Gemini AI...",
                )

            def do_upload(path=chunk_path):
                return genai.upload_file(path)

            uploaded_file = await _call_with_retry(
                do_upload, loop, task_id=task_id, ws_manager=ws_manager,
                current_progress=round(chunk_progress_start),
            )

            # Wait for processing
            import time as _time
            def wait_for_processing(f=uploaded_file):
                while f.state.name == "PROCESSING":
                    _time.sleep(2)
                    f = genai.get_file(f.name)
                if f.state.name == "FAILED":
                    raise RuntimeError(f"Gemini file processing failed: {f.state.name}")
                return f

            uploaded_file = await loop.run_in_executor(None, wait_for_processing)

            # Build prompt
            if combined_mode:
                prompt = f"""Listen carefully to this audio and produce both an accurate transcription and a natural {target_lang_name} translation.

{lang_hint}
{"This is " + chunk_label + " of a longer recording. Timestamps should start from 0 for this chunk." if is_chunked else ""}

STEP 1: Listen to the entire audio carefully to understand the full context.
STEP 2: Transcribe every word in the original language using its native script.
STEP 3: Translate each segment into natural, fluent {target_lang_name}.

OUTPUT FORMAT — return ONLY this JSON (no markdown, no code fences):
{{
  "detected_language": "language name",
  "segments": [
    {{"id": "seg_0000", "start": 0.0, "end": 3.5, "text": "original transcription", "translated_text": "{target_lang_name} translation"}}
  ]
}}

RULES:
- "text" = exact original language transcription in native script
- "translated_text" = natural {target_lang_name} translation
- Segment IDs: sequential seg_0000, seg_0001, etc.
- Timestamps in seconds with decimal precision (relative to this audio clip)
- Segments should be 3-12 seconds, aligned to natural sentence/phrase boundaries
- Include ALL speech — do not skip any part
- Return ONLY the JSON object"""
            else:
                prompt = f"""Listen carefully to this audio and produce an accurate, complete transcription.

{lang_hint}
{"This is " + chunk_label + " of a longer recording. Timestamps should start from 0 for this chunk." if is_chunked else ""}

INSTRUCTIONS:
1. Transcribe every word in the ORIGINAL language using its native script
2. Be precise — capture proper nouns, numbers, honorifics, and terminology
3. Do NOT translate — output only the original spoken language

OUTPUT FORMAT — return ONLY this JSON (no markdown, no code fences):
{{
  "detected_language": "language name",
  "segments": [
    {{"id": "seg_0000", "start": 0.0, "end": 3.5, "text": "transcribed text here"}}
  ]
}}

RULES:
- Timestamps in seconds with decimal precision (relative to this audio clip)
- Segments should be 3-12 seconds, aligned to natural sentence/phrase boundaries
- Include ALL speech — do not skip any part
- Return ONLY the JSON object"""

            # Transcribe with heartbeat
            heartbeat_active = True

            async def _heartbeat(start_pct=chunk_progress_start, end_pct=chunk_progress_end):
                elapsed = 0
                while heartbeat_active:
                    await asyncio.sleep(3)
                    if not heartbeat_active:
                        break
                    elapsed += 3
                    import math
                    frac = 1 - math.exp(-elapsed / 120)
                    pct = start_pct + (end_pct - start_pct) * frac
                    if ws_manager and task_id:
                        msg = f"Gemini is transcribing {chunk_label}... ({elapsed}s elapsed)"
                        await ws_manager.broadcast(
                            task_id, "transcription", round(pct, 1),
                            phase="transcribing", message=msg,
                        )

            def do_transcribe(f=uploaded_file):
                response = model.generate_content(
                    [f, prompt],
                    generation_config=genai.GenerationConfig(
                        temperature=0.1, max_output_tokens=output_tokens,
                    ),
                    request_options={"timeout": 600},
                )
                return response.text

            heartbeat_task = asyncio.create_task(_heartbeat())
            try:
                response_text = await asyncio.wait_for(
                    _call_with_retry(
                        do_transcribe, loop, task_id=task_id, ws_manager=ws_manager,
                        current_progress=round(chunk_progress_start),
                    ),
                    timeout=600,
                )
            except asyncio.TimeoutError:
                logger.warning("Chunk %d timed out, skipping...", chunk_idx)
                continue
            finally:
                heartbeat_active = False
                heartbeat_task.cancel()

            # Clean up uploaded file
            try:
                genai.delete_file(uploaded_file.name)
            except Exception:
                pass
            uploaded_file = None

            # Parse chunk result
            chunk_result = _parse_transcription_response(response_text)
            detected_language = chunk_result.get("detected_language", detected_language)

            # Offset timestamps for chunked mode
            for seg in chunk_result.get("segments", []):
                seg["start"] = round(seg["start"] + time_offset, 3)
                seg["end"] = round(seg["end"] + time_offset, 3)
                seg["id"] = f"seg_{len(all_segments):04d}"
                all_segments.append(seg)

            for t in chunk_result.get("translations", []):
                t["id"] = f"seg_{len(all_translations):04d}"
                all_translations.append(t)

            if is_chunked:
                time_offset += 10 * 60  # 10 minutes per chunk

            logger.info("Chunk %d: %d segments extracted", chunk_idx, len(chunk_result.get("segments", [])))

        # Build final result
        result = {
            "detected_language": detected_language,
            "segments": all_segments,
        }
        if all_translations:
            result["translations"] = all_translations

        if progress_callback:
            progress_callback(100)
        if ws_manager and task_id:
            await ws_manager.broadcast(
                task_id, "transcription", 100,
                phase="complete",
                message=f"Transcription complete: {len(all_segments)} segments",
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
        # Clean up audio chunk files
        for chunk_path in audio_chunks:
            try:
                if os.path.exists(chunk_path):
                    os.unlink(chunk_path)
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
