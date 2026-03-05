"""Routes for video analysis: scene detection, silence detection, background removal."""

import asyncio
import logging

from fastapi import APIRouter, HTTPException

from models.schemas import (
    SceneDetectRequest, SilenceDetectRequest, BackgroundRemovalRequest,
    HighlightDetectRequest, VideoEffectsRequest, DiarizeRequest,
    AudioProcessRequest, ColorGradeRequest, TransitionRequest,
    BRollSuggestRequest, BRollSearchRequest, TaskResponse,
)
from services.scene_detection_service import detect_scenes, detect_silence
from services.background_service import remove_background
from services.highlights_service import detect_highlights
from services.video_effects_service import apply_effects
from services.diarization_service import diarize_segments
from services.audio_service import process_audio
from services.color_grading_service import apply_color_grade
from services.transition_service import apply_transition
from services.broll_service import suggest_broll, search_stock
from core.task_manager import task_manager
from core.websocket_manager import manager as ws_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/analysis/scenes")
async def analyze_scenes(request: SceneDetectRequest):
    """Detect scene changes in a video."""
    try:
        scenes = await detect_scenes(
            video_path=request.video_path,
            threshold=request.threshold,
            min_scene_duration=request.min_scene_duration,
        )
        return {"scenes": scenes, "count": len(scenes)}
    except Exception as e:
        logger.error("Scene detection failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/silence")
async def analyze_silence(request: SilenceDetectRequest):
    """Detect silence regions in audio."""
    try:
        regions = await detect_silence(
            video_path=request.video_path,
            noise_threshold=request.noise_threshold,
            min_silence_duration=request.min_silence_duration,
        )
        return {"regions": regions, "count": len(regions)}
    except Exception as e:
        logger.error("Silence detection failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/background/remove")
async def remove_bg(request: BackgroundRemovalRequest):
    """Remove, blur, or replace video background using AI (rembg)."""
    task = task_manager.create_task()

    async def do_removal():
        try:
            await remove_background(
                video_path=request.video_path,
                output_path=request.output_path,
                mode=request.mode,
                bg_color=request.bg_color,
                bg_image_path=request.bg_image_path,
                blur_strength=request.blur_strength,
                model_name=request.model_name,
                task_id=task.id,
                ws_manager=ws_manager,
            )
            task_manager.complete_task(task.id, {"path": request.output_path})
        except Exception as e:
            import traceback
            logger.error("Background removal failed: %s\n%s", e, traceback.format_exc())
            task_manager.fail_task(task.id, str(e))

    asyncio.create_task(do_removal())
    return TaskResponse(task_id=task.id)


@router.post("/analysis/effects")
async def apply_video_effects(request: VideoEffectsRequest):
    """Apply visual and audio effects to a video."""
    task = task_manager.create_task()

    async def do_effects():
        try:
            await apply_effects(
                video_path=request.video_path,
                output_path=request.output_path,
                effects=request.effects,
                task_id=task.id,
                ws_manager=ws_manager,
            )
            task_manager.complete_task(task.id, {"path": request.output_path})
        except Exception as e:
            logger.error("Effects failed: %s", e)
            task_manager.fail_task(task.id, str(e))

    asyncio.create_task(do_effects())
    return TaskResponse(task_id=task.id)


@router.post("/analysis/highlights")
async def find_highlights(request: HighlightDetectRequest):
    """Detect highlight moments using Gemini AI."""
    try:
        segments_data = [s.model_dump() for s in request.segments]
        highlights = await detect_highlights(
            segments=segments_data,
            max_highlights=request.max_highlights,
            min_clip_duration=request.min_clip_duration,
            max_clip_duration=request.max_clip_duration,
            context=request.context,
        )
        return {"highlights": highlights, "count": len(highlights)}
    except Exception as e:
        logger.error("Highlight detection failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/diarize")
async def diarize(request: DiarizeRequest):
    """Speaker diarization — identify who speaks per segment."""
    try:
        segments_data = [s.model_dump() for s in request.segments]
        result = await diarize_segments(
            video_path=request.video_path,
            segments=segments_data,
            num_speakers=request.num_speakers,
        )
        speakers = sorted(set(s.get("speaker", "") for s in result))
        return {"segments": result, "speakers": speakers}
    except Exception as e:
        logger.error("Diarization failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/audio/process")
async def audio_process(request: AudioProcessRequest):
    """Apply audio processing (volume, EQ, noise reduction, etc.)."""
    task = task_manager.create_task()

    async def do_audio():
        try:
            await process_audio(
                video_path=request.video_path,
                output_path=request.output_path,
                audio_settings=request.audio_settings,
                task_id=task.id,
                ws_manager=ws_manager,
            )
            task_manager.complete_task(task.id, {"path": request.output_path})
        except Exception as e:
            logger.error("Audio processing failed: %s", e)
            task_manager.fail_task(task.id, str(e))

    asyncio.create_task(do_audio())
    return TaskResponse(task_id=task.id)


@router.post("/analysis/color/grade")
async def color_grade(request: ColorGradeRequest):
    """Apply color grading (lift/gamma/gain, temperature, LUT, curves)."""
    task = task_manager.create_task()

    async def do_grade():
        try:
            await apply_color_grade(
                video_path=request.video_path,
                output_path=request.output_path,
                grade_settings=request.grade_settings,
                task_id=task.id,
                ws_manager=ws_manager,
            )
            task_manager.complete_task(task.id, {"path": request.output_path})
        except Exception as e:
            logger.error("Color grading failed: %s", e)
            task_manager.fail_task(task.id, str(e))

    asyncio.create_task(do_grade())
    return TaskResponse(task_id=task.id)


@router.post("/analysis/transition")
async def create_transition(request: TransitionRequest):
    """Apply transition between two clips."""
    task = task_manager.create_task()

    async def do_transition():
        try:
            await apply_transition(
                clip_a_path=request.clip_a_path,
                clip_b_path=request.clip_b_path,
                output_path=request.output_path,
                transition_type=request.transition_type,
                duration=request.duration,
                task_id=task.id,
                ws_manager=ws_manager,
            )
            task_manager.complete_task(task.id, {"path": request.output_path})
        except Exception as e:
            logger.error("Transition failed: %s", e)
            task_manager.fail_task(task.id, str(e))

    asyncio.create_task(do_transition())
    return TaskResponse(task_id=task.id)


@router.post("/analysis/broll/suggest")
async def broll_suggest(request: BRollSuggestRequest):
    """AI-powered B-roll suggestions with stock footage search."""
    try:
        segments_data = [s.model_dump() for s in request.segments]
        suggestions = await suggest_broll(
            segments=segments_data,
            max_suggestions=request.max_suggestions,
            context=request.context,
        )
        return {"suggestions": suggestions, "count": len(suggestions)}
    except Exception as e:
        logger.error("B-roll suggestion failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/broll/search")
async def broll_search(request: BRollSearchRequest):
    """Search stock footage libraries."""
    try:
        results = await search_stock(request.query, request.per_page)
        return {"results": results, "count": len(results)}
    except Exception as e:
        logger.error("Stock search failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
