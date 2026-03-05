"""Batch processing router — queue multiple videos for sequential processing."""

import asyncio
import logging

from fastapi import APIRouter, HTTPException

from models.schemas import BatchRequest, TaskResponse
from core.task_manager import task_manager
from core.websocket_manager import manager as ws_manager

logger = logging.getLogger(__name__)

router = APIRouter()

# Simple in-memory batch queue
_batch_jobs: dict[str, dict] = {}


@router.post("/batch/start")
async def start_batch(request: BatchRequest):
    """Start a batch processing job."""
    task = task_manager.create_task()

    batch_state = {
        "task_id": task.id,
        "total": len(request.jobs),
        "completed": 0,
        "failed": 0,
        "results": [],
        "status": "running",
    }
    _batch_jobs[task.id] = batch_state

    async def do_batch():
        try:
            for i, job in enumerate(request.jobs):
                try:
                    result = await _process_single_job(job, i, len(request.jobs), task.id)
                    batch_state["results"].append({"index": i, "status": "ok", **result})
                    batch_state["completed"] += 1
                except Exception as e:
                    logger.error("Batch job %d failed: %s", i, e)
                    batch_state["results"].append({"index": i, "status": "error", "error": str(e)})
                    batch_state["failed"] += 1

                progress = ((i + 1) / len(request.jobs)) * 100
                task_manager.update_progress(task.id, progress)

                if ws_manager:
                    await ws_manager.broadcast(
                        task.id, "batch", progress,
                        message=f"Completed {i+1}/{len(request.jobs)} jobs",
                    )

            batch_state["status"] = "complete"
            task_manager.complete_task(task.id, batch_state)

        except Exception as e:
            batch_state["status"] = "failed"
            task_manager.fail_task(task.id, str(e))

    asyncio.create_task(do_batch())
    return TaskResponse(task_id=task.id)


@router.get("/batch/{task_id}/status")
async def batch_status(task_id: str):
    """Get batch job status."""
    if task_id not in _batch_jobs:
        task = task_manager.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Batch job not found")
        if task.error:
            raise HTTPException(status_code=500, detail=task.error)
        if task.result:
            return task.result
        return {"status": task.status.value, "progress": task.progress}

    return _batch_jobs[task_id]


async def _process_single_job(job, index: int, total: int, batch_task_id: str) -> dict:
    """Process a single batch job item."""
    from services.subtitle_service import generate_subtitle_file

    result = {"video_path": job.video_path}

    # Transcribe
    if "transcribe" in job.operations:
        segments = await _run_transcription(job.video_path)
        result["segments_count"] = len(segments)
        result["segments"] = segments
    else:
        result["segments"] = []

    # Translate
    if "translate" in job.operations and result.get("segments"):
        translations = await _run_translation(result["segments"], job.target_language)
        result["translations_count"] = len(translations)

    # Export subtitle
    if any(op.startswith("export_") for op in job.operations):
        fmt = job.export_format
        if result.get("segments"):
            import os
            import tempfile
            output_dir = tempfile.gettempdir()
            base = os.path.splitext(os.path.basename(job.video_path))[0]
            output_path = os.path.join(output_dir, f"{base}.{fmt}")
            await generate_subtitle_file(
                segments=result["segments"],
                format=fmt,
                output_path=output_path,
            )
            result["export_path"] = output_path

    return result


async def _run_transcription(video_path: str) -> list[dict]:
    """Run transcription for a single video."""
    from config import settings

    if settings.gemini_api_key:
        from services.gemini_transcription_service import transcribe_audio_gemini
        result = await transcribe_audio_gemini(video_path)
        return result.get("segments", [])
    else:
        from services.whisper_service import transcribe_audio
        result = await transcribe_audio(video_path, model_size="small")
        return result.get("segments", [])


async def _run_translation(segments: list[dict], target_lang: str) -> list[dict]:
    """Run translation for segments."""
    from config import settings

    seg_inputs = [{"id": s.get("id", str(i)), "text": s.get("text", "")} for i, s in enumerate(segments)]

    if settings.gemini_api_key:
        from services.gemini_translation_service import translate_segments_gemini
        return await translate_segments_gemini(seg_inputs, target_lang=target_lang)
    else:
        from services.translation_service import translate_segments
        return await translate_segments(seg_inputs, target_lang=target_lang)
