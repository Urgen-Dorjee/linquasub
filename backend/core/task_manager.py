import asyncio
import threading
import time
import uuid
from enum import Enum
from typing import Any


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


TASK_TTL_SECONDS = 30 * 60  # 30 minutes


class Task:
    def __init__(self, task_id: str):
        self.id = task_id
        self.status = TaskStatus.PENDING
        self.result: Any = None
        self.error: str | None = None
        self.progress: float = 0
        self.completed_at: float | None = None
        self._cancel_event = threading.Event()

    @property
    def is_cancelled(self) -> bool:
        return self._cancel_event.is_set()

    def cancel(self):
        self._cancel_event.set()
        self.status = TaskStatus.CANCELLED
        self.completed_at = time.time()


class TaskManager:
    def __init__(self):
        self.tasks: dict[str, Task] = {}
        self._cleanup_timer: threading.Timer | None = None
        self._start_cleanup_loop()

    def _start_cleanup_loop(self):
        self._cleanup_expired()
        self._cleanup_timer = threading.Timer(300, self._start_cleanup_loop)  # every 5 min
        self._cleanup_timer.daemon = True
        self._cleanup_timer.start()

    def _cleanup_expired(self):
        now = time.time()
        expired = [
            tid for tid, task in self.tasks.items()
            if task.completed_at is not None
            and (now - task.completed_at) > TASK_TTL_SECONDS
        ]
        for tid in expired:
            del self.tasks[tid]

    def create_task(self) -> Task:
        task_id = str(uuid.uuid4())
        task = Task(task_id)
        self.tasks[task_id] = task
        return task

    def get_task(self, task_id: str) -> Task | None:
        return self.tasks.get(task_id)

    def cancel_task(self, task_id: str) -> bool:
        task = self.tasks.get(task_id)
        if not task:
            return False
        # Allow cancellation unless already completed
        if task.status != TaskStatus.COMPLETED:
            task.cancel()
            return True
        return False

    def complete_task(self, task_id: str, result: Any):
        task = self.tasks.get(task_id)
        if task and not task.is_cancelled:
            task.status = TaskStatus.COMPLETED
            task.result = result
            task.progress = 100
            task.completed_at = time.time()

    def fail_task(self, task_id: str, error: str):
        task = self.tasks.get(task_id)
        if task:
            task.status = TaskStatus.FAILED
            task.error = error
            task.completed_at = time.time()

    def update_progress(self, task_id: str, progress: float):
        task = self.tasks.get(task_id)
        if task:
            task.progress = progress
            task.status = TaskStatus.RUNNING


task_manager = TaskManager()
