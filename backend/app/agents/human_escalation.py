"""Agent 3 - Human Escalation Agent.
Routes low-confidence reports to human operators."""
from typing import Dict, Any
from app.services.websocket_manager import ws_manager
import logging

logger = logging.getLogger(__name__)

class HumanEscalationAgent:
    async def escalate(self, report_id: str, intake_result: Dict[str, Any],
                       confidence_result: Dict[str, Any]) -> Dict[str, Any]:
        """Package report for human review."""
        review_package = {
            "report_id": report_id,
            "raw_text": intake_result.get("raw_text", ""),
            "transcript": intake_result.get("transcript"),
            "audio_url": intake_result.get("audio_url"),
            "reporter_lat": intake_result.get("reporter_latitude"),
            "reporter_lng": intake_result.get("reporter_longitude"),
            "extracted_location": intake_result.get("extracted_location"),
            "preliminary_type": intake_result.get("preliminary_incident_type"),
            "ai_confidence": confidence_result.get("confidence"),
            "voice_distress_signal": confidence_result.get("voice_distress_signal"),
            "missing_info": confidence_result.get("missing_fields", []),
        }
        # Broadcast to operator dashboard
        await ws_manager.broadcast("human_review.required", review_package)
        logger.info(f"Report {report_id} escalated to human operator.")
        return review_package

    async def process_operator_action(self, action: str, report_id: str,
                                       corrected_data: dict = None) -> Dict[str, Any]:
        if action == "CONFIRM":
            return {"status": "confirmed", "report_id": report_id}
        elif action == "MODIFY":
            return {"status": "confirmed", "report_id": report_id, "corrections": corrected_data}
        elif action == "REJECT":
            return {"status": "rejected", "report_id": report_id}
        elif action == "CALL":
            # Demo mode: simulate call
            logger.info(f"DEMO: Simulated callback for report {report_id}")
            return {"status": "call_initiated", "report_id": report_id,
                    "message": "Simulated callback initiated (demo mode)"}
        return {"status": "unknown_action"}

escalation_agent = HumanEscalationAgent()
