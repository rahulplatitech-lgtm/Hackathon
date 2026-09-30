"""Demo AI provider with realistic canned responses."""
import random
from typing import Dict, Any, Optional
from .base import AIProvider

INCIDENT_TYPES = {
    "fire": "Fire Emergency",
    "breakout": "Fire Emergency",
    "flame": "Fire Emergency",
    "flames": "Fire Emergency",
    "smoke": "Fire Emergency",
    "burning": "Fire Emergency",
    "blaze": "Fire Emergency",
    "burn": "Fire Emergency",
    "accident": "Road Accident",
    "crash": "Road Accident",
    "collision": "Road Accident",
    "vehicle": "Road Accident",
    "car": "Road Accident",
    "flood": "Flood",
    "water": "Flood",
    "drowning": "Flood",
    "medical": "Medical Emergency",
    "heart": "Medical Emergency",
    "stroke": "Medical Emergency",
    "breathing": "Medical Emergency",
    "unconscious": "Medical Emergency",
    "bleeding": "Medical Emergency",
    "gas": "Gas Leak",
    "leak": "Gas Leak",
    "building": "Building Collapse",
    "collapse": "Building Collapse",
    "earthquake": "Earthquake",
    "evacuate": "Building Evacuation",
    "evacuation": "Building Evacuation",
}

class DemoAIProvider(AIProvider):
    async def analyze_emergency(self, text: str, location: Optional[str] = None) -> Dict[str, Any]:
        text_lower = text.lower()
        # Detect incident type
        detected_type = "General Emergency"
        for keyword, itype in INCIDENT_TYPES.items():
            if keyword in text_lower:
                detected_type = itype
                break

        # Extract severity hints
        severity = 3
        if any(w in text_lower for w in ["critical", "severe", "dying", "dead", "explosion", "huge fire", "huge", "fast", "help fast", "trapped", "emergency"]):
            severity = 5
        elif any(w in text_lower for w in ["serious", "bad", "major", "fire", "burn", "smoke", "breakout"]):
            severity = 4
        elif any(w in text_lower for w in ["minor", "small", "slight"]):
            severity = 2

        # Extract people count
        people = 1
        for word in text_lower.split():
            if word.isdigit():
                people = int(word)
                break

        # Determine required resources
        resource_map = {
            "Road Accident": ["AMBULANCE", "POLICE_UNIT"],
            "Fire Emergency": ["RESCUE_TEAM", "AMBULANCE", "POLICE_UNIT"],
            "Medical Emergency": ["AMBULANCE", "MEDICAL_UNIT"],
            "Gas Leak": ["RESCUE_TEAM", "AMBULANCE", "POLICE_UNIT"],
            "Building Collapse": ["RESCUE_TEAM", "AMBULANCE", "MEDICAL_UNIT"],
            "Flood": ["RESCUE_TEAM", "SHELTER"],
            "Building Evacuation": ["RESCUE_TEAM", "SHELTER", "AMBULANCE"],
            "General Emergency": ["AMBULANCE", "POLICE_UNIT"],
        }
        resources = resource_map.get(detected_type, ["AMBULANCE"])
        if severity >= 4:
            resources.append("MEDICAL_UNIT")
            resources = list(set(resources))

        # Urgency mapping
        urgency_map = {5: "CRITICAL", 4: "HIGH", 3: "MEDIUM", 2: "LOW", 1: "LOW"}

        # Location extraction
        extracted_location = location
        if not extracted_location or extracted_location == "Location from report":
            if "near my house" in text_lower or "in a house" in text_lower:
                extracted_location = "Residential House Area (Caller's Home)"
            elif "near" in text_lower or "at" in text_lower:
                extracted_location = "Report Location"
            else:
                extracted_location = location or "Caller GPS Location"

        missing = []
        if location is None and "near" not in text_lower and "at" not in text_lower and "house" not in text_lower:
            missing.append("exact_location")
        if people == 1 and any(w in text_lower for w in ["people", "persons", "victims"]):
            missing.append("victim_count")

        confidence = 0.95 if not missing else (0.85 - len(missing) * 0.15)
        confidence = max(0.5, min(confidence, 0.98))

        return {
            "incident_type": detected_type,
            "severity": severity,
            "urgency": urgency_map[severity],
            "people_affected": people,
            "required_resources": resources,
            "extracted_location": extracted_location,
            "confidence": round(confidence, 2),
            "missing_info": missing,
        }

    async def generate_explanation(self, context: Dict[str, Any]) -> str:
        trigger = context.get("trigger_event", "system change")
        changes = context.get("changes", [])
        parts = [f"Plan updated due to: {trigger}."]
        for ch in changes:
            name = ch.get("resource_name", "Unknown")
            ct = ch.get("change_type", "UNKNOWN")
            if ct == "REASSIGNED":
                old_inc = ch.get("old_incident_id", "?")
                new_inc = ch.get("new_incident_id", "?")
                parts.append(f"{name} reassigned from {old_inc} to {new_inc} for optimal coverage.")
            elif ct == "UNAVAILABLE":
                parts.append(f"{name} is now unavailable and has been removed from assignments.")
            elif ct == "NEW_ASSIGNMENT":
                new_inc = ch.get("new_incident_id", "?")
                parts.append(f"{name} newly assigned to {new_inc}.")
        return " ".join(parts)

demo_ai = DemoAIProvider()
