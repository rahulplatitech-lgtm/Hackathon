"""Simple in-process event bus for agent coordination."""
from typing import Callable, Dict, List, Any
import asyncio
import logging

logger = logging.getLogger(__name__)

class EventBus:
    def __init__(self):
        self._handlers: Dict[str, List[Callable]] = {}
        self._event_log: List[Dict[str, Any]] = []

    def subscribe(self, event_type: str, handler: Callable):
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    async def publish(self, event_type: str, data: dict):
        self._event_log.append({"event": event_type, "data": data})
        logger.info(f"Event published: {event_type}")
        handlers = self._handlers.get(event_type, [])
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(data)
                else:
                    handler(data)
            except Exception as e:
                logger.error(f"Event handler error for {event_type}: {e}")

    @property
    def event_log(self) -> List[Dict[str, Any]]:
        return self._event_log.copy()

event_bus = EventBus()
