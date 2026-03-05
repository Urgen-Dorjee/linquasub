import asyncio
import logging

from fastapi import APIRouter, HTTPException

from models.schemas import (
    ExportSubtitleRequest, ExportVideoRequest, TaskResponse,
    SubtitleImportRequest, TimingShiftRequest,
    RenderEDLRequest, TrimVideoRequest,
)
from services.subtitle_service import generate_subtitle_file
from services.subtitle_import_service import import_subtitle_file
from services.ffmpeg_service import burn_subtitles
from services.karaoke_service import generate_karaoke_ass
from services.video_editing_service import render_edl, trim_video
from core.task_manager import task_manager
from core.websocket_manager import manager as ws_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/export/subtitle")
async def export_subtitle(request: ExportSubtitleRequest):
    try:
        path = await generate_subtitle_file(
            segments=[s.model_dump() for s in request.segments],
            format=request.format,
            output_path=request.output_path,
        )
        return {"path": path, "format": request.format}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export/video")
async def export_video(request: ExportVideoRequest):
    task = task_manager.create_task()

    async def do_export():
        try:
            # Generate ASS subtitle file (temp)
            segments_data = [s.model_dump() for s in request.segments]
            style_data = request.subtitle_style.model_dump()

            logger.info(
                "Export started: %d segments, karaoke=%s, codec=%s, output=%s",
                len(segments_data), request.karaoke, request.video_codec, request.output_path,
            )
            # Log first segment text to verify translation substitution
            if segments_data:
                logger.info("First segment text: %s", segments_data[0].get("text", "")[:100])

            if request.karaoke:
                ass_path = await generate_karaoke_ass(
                    segments=segments_data,
                    style=style_data,
                )
            else:
                ass_path = await generate_subtitle_file(
                    segments=segments_data,
                    format="ass",
                    output_path=None,
                    style=style_data,
                )

            logger.info("ASS file generated: %s", ass_path)

            # Burn subtitles onto video
            await burn_subtitles(
                video_path=request.video_path,
                subtitle_path=ass_path,
                output_path=request.output_path,
                video_codec=request.video_codec,
                crf=request.crf,
                task_id=task.id,
                ws_manager=ws_manager,
            )
            task_manager.complete_task(task.id, {"path": request.output_path})
            logger.info("Export complete: %s", request.output_path)
        except Exception as e:
            import traceback
            logger.error("Export failed: %s\n%s", e, traceback.format_exc())
            task_manager.fail_task(task.id, str(e))

    asyncio.create_task(do_export())
    return TaskResponse(task_id=task.id)


@router.get("/export/video/{task_id}/result")
async def export_video_result(task_id: str):
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.error:
        raise HTTPException(status_code=500, detail=task.error)
    if task.result:
        return task.result
    return {"status": task.status.value, "progress": task.progress}


@router.post("/import/subtitle")
async def import_subtitle(request: SubtitleImportRequest):
    """Import an existing subtitle file (SRT/VTT/ASS) and return parsed segments."""
    try:
        segments = await import_subtitle_file(request.file_path)
        return {"segments": segments, "count": len(segments)}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/edit/render")
async def render_edit(request: RenderEDLRequest):
    """Render an Edit Decision List into a final video."""
    task = task_manager.create_task()

    async def do_render():
        try:
            edl_data = [clip.model_dump() for clip in request.edl]
            await render_edl(
                video_path=request.video_path,
                edl=edl_data,
                output_path=request.output_path,
                video_codec=request.video_codec,
                crf=request.crf,
                task_id=task.id,
                ws_manager=ws_manager,
            )
            task_manager.complete_task(task.id, {"path": request.output_path})
        except Exception as e:
            import traceback
            logger.error("EDL render failed: %s\n%s", e, traceback.format_exc())
            task_manager.fail_task(task.id, str(e))

    asyncio.create_task(do_render())
    return TaskResponse(task_id=task.id)


@router.post("/edit/trim")
async def trim_edit(request: TrimVideoRequest):
    """Simple trim of a video between start and end times."""
    task = task_manager.create_task()

    async def do_trim():
        try:
            await trim_video(
                video_path=request.video_path,
                start=request.start,
                end=request.end,
                output_path=request.output_path,
                video_codec=request.video_codec,
                crf=request.crf,
            )
            task_manager.complete_task(task.id, {"path": request.output_path})
        except Exception as e:
            logger.error("Trim failed: %s", e)
            task_manager.fail_task(task.id, str(e))

    asyncio.create_task(do_trim())
    return TaskResponse(task_id=task.id)


@router.post("/timing/shift")
async def timing_shift(request: TimingShiftRequest):
    """Bulk shift subtitle timing and optionally fix overlaps."""
    shift_sec = request.shift_ms / 1000.0
    segments = [s.model_dump() for s in request.segments]

    # Apply shift
    for seg in segments:
        seg["start"] = max(0, seg["start"] + shift_sec)
        seg["end"] = max(seg["start"] + 0.1, seg["end"] + shift_sec)

    # Fix overlaps
    if request.fix_overlaps:
        for i in range(len(segments) - 1):
            if segments[i]["end"] > segments[i + 1]["start"]:
                segments[i]["end"] = segments[i + 1]["start"] - 0.01

    return {"segments": segments}
