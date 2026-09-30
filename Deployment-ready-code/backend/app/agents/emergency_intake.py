"""Agent 1 - Emergency Intake Agent.
Receives and processes initial emergency reports."""
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from app.ai.gemini import get_ai_provider
from app.voice.speech_to_text import stt_provider
from app.schemas.reports import IntakeResult
import uuid

class EmergencyIntakeAgent:
    def __init__(self):
        self.ai = get_ai_provider()

    async def process_text_report(self, text: str, lat: Optional[float] = None,
                                   lng: Optional[float] = None) -> Dict[str, Any]:
        report_id = str(uuid.uuid4())[:8]
        location_ctx = f"lat={lat}, lng={lng}" if lat and lng else None
        analysis = await self.ai.analyze_emergency(text, location_ctx)

        return {
            "report_id": report_id,
            "raw_text": text,
            "transcript": None,
            "audio_url": None,
            "reporter_latitude": lat,
            "reporter_longitude": lng,
            "extracted_location": analysis.get("extracted_location"),
            "preliminary_incident_type": analysis.get("incident_type"),
            "missing_information": analysis.get("missing_info", []),
            "analysis": analysis,
            "timestamp": datetime.now(timezone.utc),
        }

    async def process_voice_report(self, audio_bytes: bytes, mime_type: str,
                                    lat: Optional[float] = None,
                                    lng: Optional[float] = None,
                                    client_transcript: Optional[str] = None) -> Dict[str, Any]:
        report_id = str(uuid.uuid4())[:8]
        if client_transcript and client_transcript.strip():
            transcript = client_transcript.strip()
            confidence = 0.95
        else:
            stt_result = await stt_provider.transcribe(audio_bytes, mime_type)
            transcript = stt_result.get("transcript", "")
            confidence = stt_result.get("confidence", 0.7)

        location_ctx = f"lat={lat}, lng={lng}" if lat and lng else None
        analysis = await self.ai.analyze_emergency(transcript, location_ctx)

        return {
            "report_id": report_id,
            "raw_text": transcript,
            "transcript": transcript,
            "audio_url": f"/uploads/{report_id}.webm",
            "reporter_latitude": lat,
            "reporter_longitude": lng,
            "extracted_location": analysis.get("extracted_location"),
            "preliminary_incident_type": analysis.get("incident_type"),
            "missing_information": analysis.get("missing_info", []),
            "analysis": analysis,
            "stt_confidence": confidence,
            "timestamp": datetime.now(timezone.utc),
        }

intake_agent = EmergencyIntakeAgent()
