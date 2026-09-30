"""AI Emergency Voice Dispatcher.
Powers interactive ChatGPT-style voice conversations for emergency reporting.
Uses Gemini when available, with a responsive natural language emergency dialogue engine fallback.
"""
import os
import json
import logging
from typing import List, Dict, Any, Optional
from app.config import settings
from app.ai.demo import INCIDENT_TYPES

logger = logging.getLogger(__name__)

class VoiceDispatcherAgent:
    def __init__(self):
        self._gemini = None
        api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                self._gemini = genai.GenerativeModel(
                    "gemini-1.5-flash",
                    generation_config={"temperature": 0.3, "max_output_tokens": 250},
                )
                logger.info("VoiceDispatcher initialized with Gemini 1.5 Flash.")
            except Exception as e:
                logger.warning(f"Failed to initialize Gemini for VoiceDispatcher: {e}")

    async def chat(
        self,
        messages: List[Dict[str, str]],
        reporter_lat: Optional[float] = None,
        reporter_lng: Optional[float] = None,
        dispatch_now: bool = False
    ) -> Dict[str, Any]:
        """
        Process user speech/text message in the emergency conversation.
        Returns:
            reply: The text that the voice bot should speak aloud.
            incident_type: Detected emergency type.
            severity: 1-5 scale.
            urgency: CRITICAL, HIGH, MEDIUM, LOW.
            people_affected: Number of victims.
            ready_to_dispatch: Boolean indicating if enough info is collected.
            dispatched: Boolean if dispatch was executed.
            extracted_location: Parsed location context.
        """
        last_user_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_msg = m.get("content", "").strip()
                break

        full_convo_text = " ".join([m.get("content", "") for m in messages])
        lat_lng_str = f"Lat: {reporter_lat:.4f}, Lng: {reporter_lng:.4f}" if reporter_lat and reporter_lng else "GPS available"

        # Try Gemini first if configured
        if self._gemini:
            try:
                system_instruction = (
                    "You are Crisis Command AI, an elite 911 emergency voice dispatcher and ChatGPT-style crisis assistant. "
                    "Your voice responses will be spoken aloud to someone in distress. "
                    "Keep your spoken reply concise (1 to 2 clear, calm, authoritative sentences). "
                    "Provide immediate, practical safety guidance and ask for essential details if missing (exact location, injuries, hazards). "
                    "Always return your answer in valid JSON with these fields:\n"
                    "{\n"
                    '  "reply": "Spoken response for the caller (1-2 sentences)",\n'
                    '  "incident_type": "Road Accident|Fire Emergency|Medical Emergency|Building Collapse|Gas Leak|Flood|Building Evacuation|General Emergency",\n'
                    '  "severity": 1-5 integer,\n'
                    '  "urgency": "LOW|MEDIUM|HIGH|CRITICAL",\n'
                    '  "people_affected": integer,\n'
                    '  "required_resources": ["AMBULANCE","RESCUE_TEAM","POLICE_UNIT","MEDICAL_UNIT","SHELTER"],\n'
                    '  "ready_to_dispatch": boolean (true if type and rough location or severity is clear),\n'
                    '  "safety_advice": "brief instruction"\n'
                    "}"
                )

                prompt = (
                    f"{system_instruction}\n\n"
                    f"User GPS: {lat_lng_str}\n"
                    f"Force dispatch now: {dispatch_now}\n"
                    f"Conversation History:\n"
                )
                for m in messages:
                    prompt += f"{m.get('role', 'user').upper()}: {m.get('content')}\n"

                prompt += "\nOutput JSON only:"

                res = self._gemini.generate_content(prompt)
                raw_text = res.text.strip()
                if raw_text.startswith("```"):
                    raw_text = raw_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

                data = json.loads(raw_text)
                return self._finalize_result(data, last_user_msg, reporter_lat, reporter_lng, dispatch_now)
            except Exception as e:
                logger.warning(f"Gemini voice dispatcher error, falling back to local engine: {e}")

        # Intelligent Built-in Fallback Emergency Engine
        return self._local_dialogue_engine(messages, last_user_msg, reporter_lat, reporter_lng, dispatch_now)

    def _local_dialogue_engine(
        self,
        messages: List[Dict[str, str]],
        last_user_msg: str,
        lat: Optional[float],
        lng: Optional[float],
        dispatch_now: bool
    ) -> Dict[str, Any]:
        """High-quality simulated conversational dispatcher."""
        full_text = " ".join([m.get("content", "").lower() for m in messages])
        user_lower = last_user_msg.lower()

        # Detect emergency type
        detected_type = "General Emergency"
        for kw, itype in INCIDENT_TYPES.items():
            if kw in full_text:
                detected_type = itype
                break

        # Detect severity
        severity = 3
        if any(w in full_text for w in ["critical", "dying", "unconscious", "explosion", "severe", "dead", "gunshot", "crushed"]):
            severity = 5
        elif any(w in full_text for w in ["serious", "bad", "trapped", "bleeding", "smoke", "fire", "heavy"]):
            severity = 4
        elif any(w in full_text for w in ["minor", "slight", "small"]):
            severity = 2

        urgency_map = {5: "CRITICAL", 4: "HIGH", 3: "MEDIUM", 2: "LOW", 1: "LOW"}

        # Extract people affected
        people = 1
        for word in full_text.split():
            if word.isdigit():
                val = int(word)
                if 1 <= val <= 100:
                    people = val
                    break

        # Resources needed
        resource_map = {
            "Road Accident": ["AMBULANCE", "POLICE_UNIT"],
            "Fire Emergency": ["RESCUE_TEAM", "AMBULANCE"],
            "Medical Emergency": ["AMBULANCE", "MEDICAL_UNIT"],
            "Gas Leak": ["RESCUE_TEAM", "POLICE_UNIT", "AMBULANCE"],
            "Building Collapse": ["RESCUE_TEAM", "AMBULANCE", "MEDICAL_UNIT"],
            "Flood": ["RESCUE_TEAM", "SHELTER"],
            "Building Evacuation": ["RESCUE_TEAM", "SHELTER", "AMBULANCE"],
            "General Emergency": ["AMBULANCE", "POLICE_UNIT"],
        }
        resources = resource_map.get(detected_type, ["AMBULANCE"])
        if severity >= 4 and "MEDICAL_UNIT" not in resources:
            resources.append("MEDICAL_UNIT")

        turn_count = len([m for m in messages if m.get("role") == "user"])
        ready_to_dispatch = (turn_count >= 2) or dispatch_now or (detected_type != "General Emergency" and ("at" in full_text or "near" in full_text or lat is not None))

        location_desc = f"GPS ({lat:.4f}, {lng:.4f})" if lat and lng else "your current location"

        # Generate intelligent voice reply
        if dispatch_now or (ready_to_dispatch and any(w in user_lower for w in ["send", "help", "yes", "please", "hurry", "dispatch", "now"])):
            reply = f"Understood. Emergency {detected_type} response has been authorized and dispatched to {location_desc}. Stay in a safe position—help is on the way."
        elif "fire" in user_lower or "smoke" in user_lower or "burn" in user_lower:
            reply = f"I hear you. If you are near the fire or smoke, evacuate to an open area immediately. Can you confirm if anyone is trapped inside?"
        elif any(w in user_lower for w in ["heart", "breath", "unconscious", "chest", "bleeding", "medical", "faint"]):
            reply = f"Medical alert acknowledged. If the victim is breathing, keep them still and clear their airway. Are they responsive right now?"
        elif any(w in user_lower for w in ["accident", "car", "crash", "collision", "hit"]):
            reply = f"Road accident logged. Move to the side of the road if safe, and avoid moving anyone with neck or spine pain. How many vehicles or victims are involved?"
        elif any(w in user_lower for w in ["gas", "leak", "smell", "chemical"]):
            reply = f"Gas hazard identified. Do not touch any electrical switches or ignite matches. Evacuate upwind immediately. Is the leak indoors or outdoors?"
        elif turn_count <= 1:
            reply = f"Crisis Command Dispatcher here. I'm tracking your location. Tell me what happened and if anyone needs immediate medical care."
        else:
            reply = f"Copy that, {detected_type} logged at {location_desc}. I'm preparing emergency units to deploy. Do you need ambulances, police, or rescue teams right away?"

        return {
            "reply": reply,
            "incident_type": detected_type,
            "severity": severity,
            "urgency": urgency_map.get(severity, "HIGH"),
            "people_affected": people,
            "required_resources": resources,
            "ready_to_dispatch": ready_to_dispatch or dispatch_now,
            "extracted_location": location_desc,
        }

    def _finalize_result(
        self,
        data: Dict[str, Any],
        last_user_msg: str,
        lat: Optional[float],
        lng: Optional[float],
        dispatch_now: bool
    ) -> Dict[str, Any]:
        reply = data.get("reply", "Crisis Command Dispatcher here. What is your emergency?")
        incident_type = data.get("incident_type", "General Emergency")
        severity = int(data.get("severity", 3))
        urgency = data.get("urgency", "HIGH")
        people_affected = int(data.get("people_affected", 1))
        required_resources = data.get("required_resources", ["AMBULANCE"])
        ready = bool(data.get("ready_to_dispatch", False)) or dispatch_now

        location_desc = f"GPS ({lat:.4f}, {lng:.4f})" if lat and lng else "Report location"

        return {
            "reply": reply,
            "incident_type": incident_type,
            "severity": max(1, min(5, severity)),
            "urgency": urgency,
            "people_affected": max(1, people_affected),
            "required_resources": required_resources,
            "ready_to_dispatch": ready,
            "extracted_location": location_desc,
        }

voice_dispatcher = VoiceDispatcherAgent()
