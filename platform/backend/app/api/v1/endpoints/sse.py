"""
SSE (Server-Sent Events) — real-time notification stream.

GET /notifications/stream  — open an SSE connection
The server pushes new notifications to the client as they arrive.
No polling needed — browser EventSource handles reconnect automatically.

Architecture: In-process event bus using asyncio.Queue per connection.
Fine for single-process deployments (dev + small prod).
For multi-process prod: replace with Redis pub/sub.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications/stream", tags=["sse"])

# ── In-process event bus ──────────────────────────────────────────────────────
# Maps user_id → set of asyncio.Queue
_subscribers: dict[int, set[asyncio.Queue]] = {}


def push_event(user_id: int | None, event: dict) -> None:
    """
    Push an event to all SSE connections for a given user_id.
    Pass user_id=None to broadcast to all connected users.
    """
    targets = []
    if user_id is not None:
        targets = list(_subscribers.get(user_id, set()))
    else:
        for queues in _subscribers.values():
            targets.extend(queues)

    for q in targets:
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass  # Slow consumer — drop event


def push_notification_created(notification_id: int, title: str, priority: str, user_id: int | None = None) -> None:
    """Called by notification CRUD after insert."""
    push_event(user_id, {
        "type": "notification",
        "id": notification_id,
        "title": title,
        "priority": priority,
        "timestamp": datetime.utcnow().isoformat(),
    })


def push_action_approved(action_id: int, action_title: str) -> None:
    """Called when an agent action is approved."""
    push_event(None, {
        "type": "action_approved",
        "id": action_id,
        "title": action_title,
        "timestamp": datetime.utcnow().isoformat(),
    })


# ── SSE generator ─────────────────────────────────────────────────────────────

async def _event_generator(user_id: int, request: Request) -> AsyncGenerator[str, None]:
    queue: asyncio.Queue = asyncio.Queue(maxsize=50)

    # Register subscriber
    _subscribers.setdefault(user_id, set()).add(queue)
    logger.info("SSE: user %d connected (%d total connections)", user_id, sum(len(v) for v in _subscribers.values()))

    try:
        # Send initial heartbeat
        yield f"event: connected\ndata: {json.dumps({'user_id': user_id})}\n\n"

        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                break

            try:
                # Wait for event with 30s heartbeat timeout
                event = await asyncio.wait_for(queue.get(), timeout=30)
                yield f"event: {event['type']}\ndata: {json.dumps(event)}\n\n"
            except asyncio.TimeoutError:
                # Keep-alive heartbeat
                yield f"event: heartbeat\ndata: {json.dumps({'ts': datetime.utcnow().isoformat()})}\n\n"

    except asyncio.CancelledError:
        pass
    finally:
        # Unregister subscriber
        if user_id in _subscribers:
            _subscribers[user_id].discard(queue)
            if not _subscribers[user_id]:
                del _subscribers[user_id]
        logger.info("SSE: user %d disconnected", user_id)


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("")
async def notification_stream(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """
    Open an SSE connection to receive real-time notifications.
    The client should use EventSource('/api/v1/notifications/stream').
    Reconnects are handled automatically by the browser.
    """
    return StreamingResponse(
        _event_generator(current_user.id, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
            "Connection": "keep-alive",
        },
    )


@router.get("/status")
def stream_status(current_user: User = Depends(get_current_user)) -> dict:
    """Return number of active SSE connections (for health monitor)."""
    total = sum(len(v) for v in _subscribers.values())
    return {
        "active_connections": total,
        "connected_users": len(_subscribers),
    }
