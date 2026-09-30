"""Agent 9 - Monitoring & Change Detection Agent.
Detects meaningful state changes and triggers replanning."""
from typing import Dict, Any, List, Optional
from app.services.event_bus import event_bus
import logging

logger = logging.getLogger(__name__)

class MonitoringAgent:
    def __init__(self):
        self.previous_state: Dict[str, Any] = {}

    async def check_for_changes(self, current_incidents: List[Dict],
                                 current_resources: List[Dict],
                                 current_plan: Optional[Dict] = None) -> List[Dict[str, Any]]:
        """Compare current state with previous and detect changes."""
        events = []

        prev_incidents = {i["id"]: i for i in self.previous_state.get("incidents", [])}
        prev_resources = {r["id"]: r for r in self.previous_state.get("resources", [])}

        # Detect new incidents
        for inc in current_incidents:
            if inc["id"] not in prev_incidents and inc.get("status") == "ACTIVE":
                events.append({"type": "NEW_INCIDENT", "entity_id": inc["id"], "data": inc})

        # Detect severity changes
        for inc in current_incidents:
            old = prev_incidents.get(inc["id"])
            if old and old.get("severity") != inc.get("severity"):
                events.append({
                    "type": "SEVERITY_CHANGED",
                    "entity_id": inc["id"],
                    "data": {"old": old["severity"], "new": inc["severity"]},
                })

        # Detect resource status changes
        for res in current_resources:
            old = prev_resources.get(res["id"])
            if old and old.get("status") != res.get("status"):
                if res["status"] == "UNAVAILABLE":
                    events.append({"type": "RESOURCE_UNAVAILABLE", "entity_id": res["id"], "data": res})
                elif res["status"] == "AVAILABLE" and old["status"] == "UNAVAILABLE":
                    events.append({"type": "RESOURCE_AVAILABLE", "entity_id": res["id"], "data": res})
                else:
                    events.append({"type": "RESOURCE_STATUS_CHANGED", "entity_id": res["id"], "data": res})

        # Store current state
        self.previous_state = {
            "incidents": current_incidents,
            "resources": current_resources,
        }

        # Publish events
        for evt in events:
            await event_bus.publish(evt["type"], evt)

        return events

monitoring_agent = MonitoringAgent()
