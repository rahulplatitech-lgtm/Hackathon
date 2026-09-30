"""End-to-end emergency processing pipeline."""
from typing import Dict, Any, Optional, List
from app.agents.emergency_intake import intake_agent
from app.agents.distress_confidence import confidence_agent
from app.agents.human_escalation import escalation_agent
from app.agents.incident_assessment import assessment_agent
from app.agents.priority_triage import triage_agent
from app.agents.route_logistics import route_agent
from app.agents.command_planning import command_agent
from app.agents.dynamic_replanning import replanning_agent
from app.optimization.allocator import ResourceAllocator
from app.services.websocket_manager import ws_manager
import logging

logger = logging.getLogger(__name__)

class EmergencyPipeline:
    def __init__(self):
        self.allocator = ResourceAllocator()

    async def process_text_report(self, text: str, lat: Optional[float] = None,
                                   lng: Optional[float] = None) -> Dict[str, Any]:
        """Full pipeline for text report."""
        # Agent 1: Intake
        intake_result = await intake_agent.process_text_report(text, lat, lng)

        # Agent 2: Confidence
        conf_result = confidence_agent.calculate_confidence(intake_result)

        return {
            "intake": intake_result,
            "confidence": conf_result,
        }

    async def process_voice_report(self, audio_bytes: bytes, mime_type: str,
                                    lat: Optional[float] = None,
                                    lng: Optional[float] = None,
                                    client_transcript: Optional[str] = None) -> Dict[str, Any]:
        """Full pipeline for voice report."""
        # Agent 1: Intake
        intake_result = await intake_agent.process_voice_report(
            audio_bytes, mime_type, lat, lng, client_transcript
        )

        # Agent 2: Confidence
        conf_result = confidence_agent.calculate_confidence(intake_result, audio_bytes)

        return {
            "intake": intake_result,
            "confidence": conf_result,
        }

    async def generate_full_plan(self, incidents: List[Dict], resources: List[Dict]) -> Dict[str, Any]:
        """Run full planning pipeline."""
        # Agent 5: Priority
        available_count = sum(1 for r in resources if r.get("status") == "AVAILABLE")
        priorities = triage_agent.calculate_priorities(incidents, available_count)

        # Apply priority scores
        priority_map = {p["incident_id"]: p["priority_score"] for p in priorities}
        for inc in incidents:
            inc["priority_score"] = priority_map.get(inc["id"], 0)

        # Agent 6: Allocate
        alloc_result = self.allocator.allocate(incidents, resources)

        # Agent 7: Routes
        res_map = {r["id"]: r for r in resources}
        inc_map = {i["id"]: i for i in incidents}
        enriched_allocs = await route_agent.calculate_routes(
            alloc_result["allocations"], res_map, inc_map
        )

        # Agent 8: Command plan
        plan = await command_agent.generate_plan(
            incidents, enriched_allocs, alloc_result["unmet"], priorities
        )

        return {
            "plan": plan,
            "priorities": priorities,
            "allocations": enriched_allocs,
            "unmet": alloc_result["unmet"],
        }

pipeline = EmergencyPipeline()
