import json
import time
from fastapi import WebSocket


class WebSocketManager:
    def __init__(self):
        self.connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.connections:
            self.connections.remove(websocket)

    async def broadcast(
        self,
        task_id: str,
        event_type: str,
        progress: float,
        message: str = "",
        **extra,
    ):
        payload = {
            "task_id": task_id,
            "type": event_type,
            "progress": progress,
            "message": message,
            "timestamp": time.time(),
            "data": extra,
        }

        dead = []
        for ws in self.connections:
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.connections.remove(ws)


manager = WebSocketManager()
