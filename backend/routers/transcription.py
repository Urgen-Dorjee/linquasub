import asyncio
import logging
from fastapi import APIRouter, HTTPException

from models.schemas import TranscribeRequest, TaskResponse
from services.whisper_service import transcribe_audio, TranscriptionCancelled
from services.gemini_transcription_service import transcribe_audio_gemini
from core.task_manager import task_manager
from core.websocket_manager import manager as ws_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/transcribe")
async def transcribe(request: TranscribeRequest):
    task = task_manager.create_task()

    async def do_transcribe():
        try:
            if request.engine == "gemini":
                result = await transcribe_audio_gemini(
                    video_path=request.video_path,
                    language=request.language if request.language != "auto" else "auto",
                    target_lang=request.target_lang,
                    task_id=task.id,
                    ws_manager=ws_manager,
                    cancel_check=lambda: task.is_cancelled,
                    progress_callback=lambda p: task_manager.update_progress(task.id, p),
                )
            else:
                result = await transcribe_audio(
                    video_path=request.video_path,
                    model_size=request.model,
                    language=request.language if request.language != "auto" else None,
                    device=request.device,
                    compute_type=request.compute_type,
                    vad_filter=request.vad_filter,
                    task_id=task.id,
                    ws_manager=ws_manager,
                    cancel_check=lambda: task.is_cancelled,
                    progress_callback=lambda p: task_manager.update_progress(task.id, p),
                )

            task_manager.complete_task(task.id, result)
            await ws_manager.broadcast(
                task.id, "transcription_complete", 100,
                message=f"Transcription complete: {len(result['segments'])} segments",
            )
        except TranscriptionCancelled:
            await ws_manager.broadcast(
                task.id, "cancelled", 0, message="Transcription cancelled",
            )
        except Exception as e:
            import traceback
            logger.error("Transcription failed for task %s: %s\n%s", task.id, e, traceback.format_exc())
            task_manager.fail_task(task.id, str(e))
            await ws_manager.broadcast(
                task.id, "transcription_error", 0, message=f"Error: {str(e)}"
            )

    asyncio.create_task(do_transcribe())
    return TaskResponse(task_id=task.id)


@router.get("/transcribe/{task_id}/result")
async def transcribe_result(task_id: str):
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.error:
        raise HTTPException(status_code=500, detail=task.error)
    if task.result:
        return task.result
    return {"status": task.status.value, "progress": task.progress}
