import argparse
import os
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

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
