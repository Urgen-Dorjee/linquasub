import asyncio
from fastapi import APIRouter, HTTPException

from models.schemas import VideoInfoRequest, VideoDownloadRequest, TaskResponse
from services.youtube_service import download_video, get_video_info_ffprobe
from core.task_manager import task_manager
from core.websocket_manager import manager as ws_manager

router = APIRouter()


@router.post("/video/info")
async def video_info(request: VideoInfoRequest):
    try:
        info = await get_video_info_ffprobe(request.path)
        return info
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/video/download")
async def video_download(request: VideoDownloadRequest):
    task = task_manager.create_task()

    async def do_download():
        try:
            path = await download_video(
                url=request.url,
                quality=request.quality,
                task_id=task.id,
                ws_manager=ws_manager,
                output_dir=request.output_dir,
            )
            task_manager.complete_task(task.id, {"path": path})
            await ws_manager.broadcast(
                task.id, "download_complete", 100,
                message="Download complete", path=path,
            )
        except Exception as e:
            task_manager.fail_task(task.id, str(e))
            await ws_manager.broadcast(
                task.id, "download_error", 0,
                message=str(e),
            )

    asyncio.create_task(do_download())
    return TaskResponse(task_id=task.id)


@router.get("/video/download/{task_id}/result")
async def video_download_result(task_id: str):
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.error:
        raise HTTPException(status_code=500, detail=task.error)
    if task.result:
        return task.result
    return {"status": task.status.value, "progress": task.progress}
