import json
import logging
from typing import Dict, List, Set, Any
from uuid import UUID
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ChatConnectionManager:
    """
    Manages active WebSocket connections per user ID.
    Handles online status, typing indicators, read receipts, and real-time message broadcasts.
    """

    def __init__(self):
        # Maps user_id -> List[WebSocket] (supports multi-tab / multi-device per user)
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []

        self.active_connections[user_id].append(websocket)
        logger.info(f"User {user_id} connected to Chat WebSocket (tabs: {len(self.active_connections[user_id])})")

        # Broadcast online status
        await self.broadcast_user_status(user_id, is_online=True)

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                logger.info(f"User {user_id} disconnected from Chat WebSocket (now offline)")

    def is_user_online(self, user_id: str) -> bool:
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

    def get_online_users(self) -> Set[str]:
        return set(self.active_connections.keys())

    async def send_personal_event(self, user_id: str, event_type: str, payload: Dict[str, Any]):
        """
        Sends an event to all open WebSocket connections of a specific user.
        """
        if user_id in self.active_connections:
            message_text = json.dumps({"event": event_type, "data": payload})
            disconnected = []
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_text(message_text)
                except Exception as e:
                    logger.warning(f"Error sending WebSocket event to user {user_id}: {e}")
                    disconnected.append(ws)

            for dead_ws in disconnected:
                self.disconnect(user_id, dead_ws)

    async def broadcast_user_status(self, user_id: str, is_online: bool):
        """
        Broadcasts user online/offline status change to all connected clients.
        """
        status_event = "user_online" if is_online else "user_offline"
        payload = {"user_id": user_id, "is_online": is_online}
        message_text = json.dumps({"event": status_event, "data": payload})

        for target_id, sockets in list(self.active_connections.items()):
            if target_id != user_id:
                for ws in sockets:
                    try:
                        await ws.send_text(message_text)
                    except Exception:
                        pass


chat_manager = ChatConnectionManager()
