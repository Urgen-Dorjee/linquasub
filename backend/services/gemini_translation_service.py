import asyncio
import json
import logging
import re

from config import settings

logger = logging.getLogger(__name__)

MAX_RETRIES = 5


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
    match = re.search(r'retry_delay\s*\{\s*seconds:\s*(\d+)', str(e))
    if match:
        return int(match.group(1))
    return 0


async def _call_with_retry(func, loop, max_retries=MAX_RETRIES,
                            task_id="", ws_manager=None, batch_info=""):
    """Call a blocking function with retry on rate limit errors."""
    for attempt in range(max_retries + 1):
        try:
            return await loop.run_in_executor(None, func)
        except Exception as e:
            if _is_rate_limit_error(e) and attempt < max_retries:
                suggested = _extract_retry_delay(e)
                wait_time = max(suggested + 5, 30 * (attempt + 1))
                wait_time = min(wait_time, 120)
                logger.warning(
                    "Translation rate limited (attempt %d/%d). Waiting %ds... %s",
                    attempt + 1, max_retries, wait_time, batch_info
                )
                if ws_manager and task_id:
                    await ws_manager.broadcast(
                        task_id, "translation", 10,
                        phase="rate_limited",
                        message=f"API rate limited. Retrying in {wait_time}s... (attempt {attempt + 1}/{max_retries})",
                    )
                await asyncio.sleep(wait_time)
                continue
            raise


async def translate_segments_gemini(
    segments: list,
    source_lang: str = "Tibetan",
    target_lang: str = "English",
    context_window: int = 3,
    task_id: str = "",
    ws_manager=None,
) -> dict:
    """Translate subtitle segments using Google Gemini API.

    Sends ALL segments together so Gemini can understand the full context
    of the speech before translating. This produces much better translations
    than sending isolated segments, especially for languages like Tibetan.
    """
    import google.generativeai as genai

    api_key = settings.gemini_api_key
    if not api_key:
        raise ValueError("Gemini API key not configured. Set it in Settings.")

    genai.configure(api_key=api_key)
    model_name = settings.gemini_model or "gemini-2.5-flash"
    model = genai.GenerativeModel(model_name)

    total = len(segments)
    chars_consumed = 0

    # Build the FULL transcript so Gemini has complete context
    all_segments_text = []
    for i, seg in enumerate(segments):
        text = seg.text if hasattr(seg, "text") else seg.get("text", "")
        seg_id = seg.id if hasattr(seg, "id") else seg.get("id", f"seg_{i:04d}")
        all_segments_text.append(f'{seg_id}: {text}')
        chars_consumed += len(text)

    full_transcript = chr(10).join(all_segments_text)

    prompt = f"""You are an expert translator specializing in {source_lang} to {target_lang} translation.

Below is a complete transcript of a speech/video in {source_lang}, divided into subtitle segments. Your task is to translate ALL segments into natural, fluent {target_lang}.

IMPORTANT INSTRUCTIONS:
1. First, read and understand the ENTIRE transcript to grasp the full context, topic, and meaning of the speech
2. Then translate each segment, using your understanding of the complete context to produce accurate, natural translations
3. Translate for MEANING, not word-by-word — produce translations that a native {target_lang} speaker would find natural and clear
4. If the source text contains proper nouns, honorifics, or cultural terms, translate them appropriately for the target audience
5. Keep translations concise — they must work as on-screen subtitles
6. Preserve the segment IDs exactly as given
7. Return ONLY a valid JSON array (no markdown, no code fences, no explanation)

COMPLETE TRANSCRIPT ({total} segments):
{full_transcript}

OUTPUT FORMAT — return a JSON array:
[{{"id":"seg_0000","text":"natural {target_lang} translation"}},{{"id":"seg_0001","text":"next translation"}}]

Translate ALL {total} segments. Return ONLY the JSON array."""

    loop = asyncio.get_event_loop()

    if ws_manager and task_id:
        await ws_manager.broadcast(
            task_id, "translation", 10,
            message=f"Translating {total} segments with full context...",
        )

    def do_translate():
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.1,
                max_output_tokens=131072,
            ),
        )
        return response.text

    try:
        response_text = await _call_with_retry(
            do_translate, loop, task_id=task_id,
            ws_manager=ws_manager, batch_info=f"(all {total} segments)",
        )

        # Parse the JSON response
        parsed = _parse_gemini_response(response_text, segments)

        translations = []
        for seg, translated_text in zip(segments, parsed):
            seg_id = seg.id if hasattr(seg, "id") else seg.get("id", "")
            original = seg.text if hasattr(seg, "text") else seg.get("text", "")
            translations.append({
                "id": seg_id,
                "original_text": original,
                "translated_text": translated_text,
            })

    except Exception as e:
        # On error, add error message for all segments
        logger.error("Translation failed: %s", e)
        translations = []
        for seg in segments:
            seg_id = seg.id if hasattr(seg, "id") else seg.get("id", "")
            original = seg.text if hasattr(seg, "text") else seg.get("text", "")
            translations.append({
                "id": seg_id,
                "original_text": original,
                "translated_text": f"[Translation error: {str(e)[:100]}]",
            })

    if ws_manager and task_id:
        await ws_manager.broadcast(
            task_id, "translation", 100,
            message=f"Translated {total}/{total} segments",
        )

    return {
        "translations": translations,
        "chars_consumed": chars_consumed,
        "total_chars_remaining": -1,  # Gemini doesn't have a simple char limit
    }


def _parse_gemini_response(response_text: str, batch: list) -> list[str]:
    """Parse Gemini's response to extract translated texts."""
    # Try to extract JSON from the response
    text = response_text.strip()

    # Remove markdown code fences if present
    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?\s*', '', text)
        text = re.sub(r'\s*```$', '', text)

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            # Map by ID
            id_to_text = {}
            for item in parsed:
                if isinstance(item, dict) and "id" in item and "text" in item:
                    id_to_text[item["id"]] = item["text"]

            results = []
            for seg in batch:
                seg_id = seg.id if hasattr(seg, "id") else seg.get("id", "")
                results.append(id_to_text.get(seg_id, "[Parse error]"))
            return results
    except json.JSONDecodeError:
        pass

    # Fallback: try to find JSON array in the response
    match = re.search(r'\[.*\]', text, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group())
            if isinstance(parsed, list):
                id_to_text = {}
                for item in parsed:
                    if isinstance(item, dict) and "id" in item and "text" in item:
                        id_to_text[item["id"]] = item["text"]

                results = []
                for seg in batch:
                    seg_id = seg.id if hasattr(seg, "id") else seg.get("id", "")
                    results.append(id_to_text.get(seg_id, "[Parse error]"))
                return results
        except json.JSONDecodeError:
            pass

    # Last resort: return the raw text split by lines
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    results = []
    for i, seg in enumerate(batch):
        if i < len(lines):
            results.append(lines[i])
        else:
            results.append("[Translation unavailable]")
    return results
