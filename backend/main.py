import argparse
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from config import settings
from core.websocket_manager import manager as ws_manager
from routers import transcription, translation, video, export, system, analysis, batch


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs(settings.temp_dir, exist_ok=True)
    print(f"[Backend] Starting on port {settings.backend_port}")
    print(f"[Backend] FFmpeg path: {settings.ffmpeg_path}")
    yield
    # Shutdown
    print("[Backend] Shutting down...")


app = FastAPI(title="LinguaSub Backend", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system.router, prefix="/api", tags=["system"])
app.include_router(video.router, prefix="/api", tags=["video"])
app.include_router(transcription.router, prefix="/api", tags=["transcription"])
app.include_router(translation.router, prefix="/api", tags=["translation"])
app.include_router(export.router, prefix="/api", tags=["export"])
app.include_router(analysis.router, prefix="/api", tags=["analysis"])
app.include_router(batch.router, prefix="/api", tags=["batch"])


@app.get("/api/serve-file")
async def serve_file(path: str, request: Request):
    """Serve a local file with HTTP range support for video streaming."""
    file_path = Path(path)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    file_size = file_path.stat().st_size
    suffix = file_path.suffix.lower()
    media_type = {
        ".mp4": "video/mp4", ".mkv": "video/x-matroska", ".avi": "video/x-msvideo",
        ".mov": "video/quicktime", ".webm": "video/webm",
    }.get(suffix, "application/octet-stream")

    range_header = request.headers.get("range")
    if range_header:
        # Parse range: "bytes=start-end"
        range_str = range_header.replace("bytes=", "")
        parts = range_str.split("-")
        start = int(parts[0]) if parts[0] else 0
        end = int(parts[1]) if parts[1] else file_size - 1
        end = min(end, file_size - 1)
        chunk_size = end - start + 1

        def iter_file():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = chunk_size
                while remaining > 0:
                    read_size = min(remaining, 1024 * 1024)  # 1MB chunks
                    data = f.read(read_size)
                    if not data:
                        break
                    remaining -= len(data)
                    yield data

        return StreamingResponse(
            iter_file(),
            status_code=206,
            media_type=media_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(chunk_size),
            },
        )

    return FileResponse(str(file_path), media_type=media_type, headers={"Accept-Ranges": "bytes"})


@app.websocket("/ws/progress")
async def websocket_progress(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=settings.backend_port)
    args = parser.parse_args()

    settings.backend_port = args.port

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=args.port,
        log_level="info",
    )
