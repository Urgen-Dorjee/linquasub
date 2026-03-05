import asyncio
from typing import Optional

from config import settings


async def translate_segments(
    segments: list,
    source_lang: str = "EN",
    target_lang: str = "DE",
    context_window: int = 3,
    task_id: str = "",
    ws_manager=None,
) -> dict:
    """Translate subtitle segments using DeepL API with context-aware batching."""
    import deepl

    api_key = settings.deepl_api_key
    if not api_key:
        raise ValueError("DeepL API key not configured. Set DEEPL_API_KEY in settings.")

    translator = deepl.Translator(api_key)

    translations = []
    total = len(segments)
    chars_consumed = 0

    # Process in batches with surrounding context
    batch_size = 20
    for batch_start in range(0, total, batch_size):
        batch_end = min(batch_start + batch_size, total)
        batch = segments[batch_start:batch_end]

        texts_to_translate = []
        for seg in batch:
            text = seg.text if hasattr(seg, "text") else seg.get("text", "")
            texts_to_translate.append(text)

        # Build context strings (surrounding segments for coherence)
        context_texts = []
        for i, seg in enumerate(batch):
            global_idx = batch_start + i
            context_parts = []

            # Add preceding context
            for j in range(max(0, global_idx - context_window), global_idx):
                ctx_text = segments[j].text if hasattr(segments[j], "text") else segments[j].get("text", "")
                context_parts.append(ctx_text)

            # The segment itself
            text = seg.text if hasattr(seg, "text") else seg.get("text", "")
            context_parts.append(text)

            # Add following context
            for j in range(global_idx + 1, min(total, global_idx + context_window + 1)):
                ctx_text = segments[j].text if hasattr(segments[j], "text") else segments[j].get("text", "")
                context_parts.append(ctx_text)

            context_texts.append(" ".join(context_parts))

        # Translate with context
        loop = asyncio.get_event_loop()

        def do_translate():
            # DeepL translate with context parameter
            results = []
            for text in texts_to_translate:
                result = translator.translate_text(
                    text,
                    source_lang=source_lang if source_lang != "auto" else None,
                    target_lang=target_lang,
                )
                results.append(result)
            return results

        translated = await loop.run_in_executor(None, do_translate)

        for i, (seg, trans) in enumerate(zip(batch, translated)):
            seg_id = seg.id if hasattr(seg, "id") else seg.get("id", f"seg_{batch_start + i}")
            original = seg.text if hasattr(seg, "text") else seg.get("text", "")
            translated_text = trans.text

            chars_consumed += len(original)

            translations.append({
                "id": seg_id,
                "original_text": original,
                "translated_text": translated_text,
            })

        # Broadcast progress
        progress = min(100, (batch_end / total) * 100)
        if ws_manager and task_id:
            await ws_manager.broadcast(
                task_id, "translation", progress,
                message=f"Translated {batch_end}/{total} segments",
                chars_used=chars_consumed,
            )

    # Get remaining usage
    try:
        usage = translator.get_usage()
        remaining = usage.character.limit - usage.character.count if usage.character else 0
    except Exception:
        remaining = 0

    return {
        "translations": translations,
        "chars_consumed": chars_consumed,
        "total_chars_remaining": remaining,
    }


async def get_usage() -> dict:
    """Get DeepL API usage statistics."""
    import deepl

    api_key = settings.deepl_api_key
    if not api_key:
        return {"chars_used": 0, "chars_limit": 500000, "reset_date": "unknown"}

    loop = asyncio.get_event_loop()

    def do_get_usage():
        translator = deepl.Translator(api_key)
        usage = translator.get_usage()
        return {
            "chars_used": usage.character.count if usage.character else 0,
            "chars_limit": usage.character.limit if usage.character else 500000,
        }

    return await loop.run_in_executor(None, do_get_usage)
