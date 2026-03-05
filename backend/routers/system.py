import json
import logging
import os

from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from config import settings, save_persisted_settings, _get_data_dir
from core.gpu_utils import get_gpu_info
from core.ffmpeg_utils import is_ffmpeg_available
from core.task_manager import task_manager
from core.websocket_manager import manager as ws_manager


class UpdateSettingsRequest(BaseModel):
    deepl_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None


def _get_session_file() -> str:
    return os.path.join(_get_data_dir(), "last-session.json")

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health():
    gpu_info = get_gpu_info()
    return {
        "status": "ok",
        "gpu_available": gpu_info["cuda_available"],
        "ffmpeg_available": is_ffmpeg_available(),
    }


@router.get("/gpu-info")
async def gpu_info():
    return get_gpu_info()


@router.get("/models")
async def list_models():
    gpu = get_gpu_info()
    models = [
        {"name": "tiny", "vram_mb": 75, "quality": "low", "speed": "fastest"},
        {"name": "base", "vram_mb": 150, "quality": "fair", "speed": "fast"},
        {"name": "small", "vram_mb": 500, "quality": "good", "speed": "medium"},
        {"name": "medium", "vram_mb": 1500, "quality": "great", "speed": "slow"},
        {"name": "large", "vram_mb": 3000, "quality": "best", "speed": "slowest"},
    ]
    return {
        "models": models,
        "gpu": gpu,
    }


@router.post("/settings")
async def update_settings(request: UpdateSettingsRequest):
    if request.deepl_api_key is not None:
        settings.deepl_api_key = request.deepl_api_key
    if request.gemini_api_key is not None:
        settings.gemini_api_key = request.gemini_api_key
    if request.gemini_model is not None:
        settings.gemini_model = request.gemini_model
    # Persist to disk so keys survive app restarts
    save_persisted_settings()
    return {"status": "ok"}


@router.get("/settings")
async def get_settings():
    return {
        "gemini_api_key": settings.gemini_api_key,
        "deepl_api_key": settings.deepl_api_key,
        "gemini_model": settings.gemini_model,
    }


@router.post("/task/{task_id}/cancel")
async def cancel_task(task_id: str):
    logger.info(f"Cancel requested for task {task_id}")
    task = task_manager.get_task(task_id)
    if not task:
        logger.warning(f"Task {task_id} not found. Known tasks: {list(task_manager.tasks.keys())}")
        raise HTTPException(status_code=404, detail="Task not found")

    cancelled = task_manager.cancel_task(task_id)
    logger.info(f"Task {task_id} cancel result: {cancelled}, status was: {task.status}")

    try:
        await ws_manager.broadcast(
            task_id, "cancelled", 0, message="Task cancelled",
        )
    except Exception as e:
        logger.error(f"Failed to broadcast cancel: {e}")

    return {"status": "cancelled", "task_id": task_id}


@router.post("/session/save")
async def save_session(request: Request):
    """Save session data to disk for auto-restore on next launch."""
    try:
        data = await request.json()
        path = _get_session_file()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/load")
async def load_session():
    """Load saved session data from disk."""
    path = _get_session_file()
    try:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {}
