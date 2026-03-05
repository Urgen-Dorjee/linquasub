import asyncio
from fastapi import APIRouter, HTTPException

from models.schemas import TranslateRequest, TaskResponse
from services.translation_service import translate_segments, get_usage
from services.gemini_translation_service import translate_segments_gemini
from core.task_manager import task_manager
from core.websocket_manager import manager as ws_manager

router = APIRouter()


@router.post("/translate")
async def translate(request: TranslateRequest):
    task = task_manager.create_task()

    async def do_translate():
        try:
            if request.engine == "gemini":
                result = await translate_segments_gemini(
                    segments=request.segments,
                    source_lang=request.source_lang,
                    target_lang=request.target_lang,
                    context_window=request.context_window,
                    task_id=task.id,
                    ws_manager=ws_manager,
                )
            else:
                result = await translate_segments(
                    segments=request.segments,
                    source_lang=request.source_lang,
                    target_lang=request.target_lang,
                    context_window=request.context_window,
                    task_id=task.id,
                    ws_manager=ws_manager,
                )
            task_manager.complete_task(task.id, result)
        except Exception as e:
            task_manager.fail_task(task.id, str(e))
            if ws_manager:
                await ws_manager.broadcast(task.id, "error", 0, message=str(e))

    asyncio.create_task(do_translate())
    return TaskResponse(task_id=task.id)


@router.get("/translate/{task_id}/result")
async def translate_result(task_id: str):
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.error:
        raise HTTPException(status_code=500, detail=task.error)
    if task.result:
        return task.result
    return {"status": task.status.value, "progress": task.progress}


@router.get("/translate/usage")
async def translate_usage():
    try:
        return await get_usage()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
