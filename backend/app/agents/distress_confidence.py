"""Agent 2 - Distress & Confidence Agent.
Calculates overall confidence and voice distress signals."""
from typing import Dict, Any, Optional, List
from app.config import settings
from app.voice.distress_features import analyze_distress_features

class DistressConfidenceAgent:
    def __init__(self):
        self.threshold = settings.AI_CONFIDENCE_THRESHOLD

    def calculate_confidence(self, intake_result: Dict[str, Any],
                             audio_bytes: Optional[bytes] = None) -> Dict[str, Any]:
        """Calculate overall confidence score. Voice distress is SUPPORTING signal only."""
        missing = intake_result.get("missing_information", [])
        analysis = intake_result.get("analysis", {})
        ai_confidence = analysis.get("confidence", 0.5)

        # Confidence factors (deterministic)
        field_completeness = 1.0 - (len(missing) * 0.15)
        field_completeness = max(0.2, field_completeness)

        has_location = intake_result.get("reporter_latitude") is not None
        location_certainty = 0.9 if has_location else 0.5

        has_incident_type = bool(analysis.get("incident_type"))
        type_certainty = 0.9 if has_incident_type else 0.4

        # STT confidence if voice report
        stt_conf = intake_result.get("stt_confidence", 1.0)

        # Weighted confidence (no voice distress in this calculation)
        confidence = (
            ai_confidence * 0.30 +
            field_completeness * 0.25 +
            location_certainty * 0.20 +
            type_certainty * 0.15 +
            stt_conf * 0.10
        )
        confidence = round(max(0.1, min(confidence, 0.99)), 2)

        # Voice distress as supporting signal only
        voice_distress = "normal"
        if audio_bytes:
            distress_result = analyze_distress_features(audio_bytes)
            voice_distress = distress_result["voice_distress_signal"]

        requires_review = confidence < self.threshold

        return {
            "confidence": confidence,
            "voice_distress_signal": voice_distress,
            "missing_fields": missing,
            "requires_human_review": requires_review,
            "confidence_factors": {
                "ai_analysis": ai_confidence,
                "field_completeness": field_completeness,
                "location_certainty": location_certainty,
                "type_certainty": type_certainty,
                "stt_confidence": stt_conf,
            },
        }

confidence_agent = DistressConfidenceAgent()
