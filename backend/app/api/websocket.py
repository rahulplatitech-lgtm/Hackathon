"""WebSocket endpoint for real-time updates."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.websocket_manager import ws_manager

router = APIRouter()

@router.websocket("/ws/command")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo or handle client messages if needed
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
