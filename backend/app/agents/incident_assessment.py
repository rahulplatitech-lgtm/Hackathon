"""Agent 4 - Incident Assessment Agent.
Converts confirmed reports into structured incident data."""
from typing import Dict, Any
from app.schemas.incidents import IncidentCreate
import uuid

class IncidentAssessmentAgent:
    def assess(self, report_data: Dict[str, Any], corrections: Dict[str, Any] = None) -> Dict[str, Any]:
        """Convert confirmed report to structured incident."""
        analysis = report_data.get("analysis", {})
        if corrections:
            analysis.update(corrections)

        severity = analysis.get("severity", 3)
        severity = max(1, min(5, severity))

        urgency = analysis.get("urgency", "MEDIUM")
        if urgency not in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
            urgency = "MEDIUM"

        # Determine location
        lat = report_data.get("reporter_latitude", 12.97)
        lng = report_data.get("reporter_longitude", 77.59)
        if corrections and "latitude" in corrections:
            lat = corrections["latitude"]
        if corrections and "longitude" in corrections:
            lng = corrections["longitude"]

        return {
            "id": f"INC-{str(uuid.uuid4())[:4].upper()}",
            "report_id": report_data.get("report_id"),
            "type": analysis.get("incident_type", "General Emergency"),
            "severity": severity,
            "urgency": urgency,
            "people_affected": analysis.get("people_affected", 1),
            "latitude": lat or 12.97,
            "longitude": lng or 77.59,
            "location_text": analysis.get("extracted_location", "Unknown"),
            "required_resources": analysis.get("required_resources", ["AMBULANCE"]),
            "status": "ACTIVE",
        }

assessment_agent = IncidentAssessmentAgent()
