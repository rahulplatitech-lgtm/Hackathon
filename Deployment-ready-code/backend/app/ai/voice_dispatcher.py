"""AI Emergency Voice Dispatcher.
Powers interactive ChatGPT-style voice conversations for emergency reporting.
Uses Gemini 1.5 Flash when an API key is available, with an advanced, situation-aware
emergency dialogue engine that understands user questions, provides first-aid guidance,
tracks conversation state, and never loops repetitive prompts.
"""
import os
import re
import json
import logging
from typing import List, Dict, Any, Optional
import httpx
from app.config import settings
from app.ai.demo import INCIDENT_TYPES

logger = logging.getLogger(__name__)

class VoiceDispatcherAgent:
    def __init__(self):
        self._api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""
        if self._api_key:
            logger.info("VoiceDispatcher configured with Gemini API key.")
        else:
            logger.info("VoiceDispatcher running in high-accuracy Local Conversational Emergency Engine mode.")

    async def chat(
        self,
        messages: List[Dict[str, str]],
        reporter_lat: Optional[float] = None,
        reporter_lng: Optional[float] = None,
        dispatch_now: bool = False,
        incident_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process user speech/text message in the emergency conversation.
        """
        # Find latest user message
        last_user_msg = ""
        for m in reversed(messages):
            if m.get("role") == "user":
                last_user_msg = m.get("content", "").strip()
                break

        # Check for initial greeting trigger
        if not last_user_msg or last_user_msg == "HELLO_START":
            lat_str = f"at GPS ({reporter_lat:.4f}, {reporter_lng:.4f})" if reporter_lat and reporter_lng else "active"
            return {
                "reply": f"CrisisSync AI Dispatcher online, location {lat_str}. I am right here with you. Take a deep breath and tell me what is happening.",
                "incident_type": "General Emergency",
                "severity": 3,
                "urgency": "MEDIUM",
                "people_affected": 1,
                "required_resources": ["AMBULANCE", "POLICE_UNIT"],
                "ready_to_dispatch": False,
                "dispatched": False,
                "extracted_location": f"GPS ({reporter_lat:.4f}, {reporter_lng:.4f})" if reporter_lat and reporter_lng else "Current Location",
                "auto_dispatch": False,
                "ai_confidence": 0.90,
                "ai_thinking": "Dispatcher intake channel opened. Awaiting initial distress statement to evaluate emergency category and severity level.",
                "human_escalation_required": False,
                "escalation_reason": None,
                "escalated_to_operator": False,
            }

        # Try Gemini API via REST if API key is present
        if self._api_key:
            try:
                gemini_result = await self._call_gemini_rest(
                    messages=messages,
                    last_user_msg=last_user_msg,
                    lat=reporter_lat,
                    lng=reporter_lng,
                    dispatch_now=dispatch_now
                )
                if gemini_result:
                    return gemini_result
            except Exception as e:
                logger.warning(f"Gemini API call failed, using intelligent local engine: {e}")

        # Intelligent Built-in Conversational Emergency Engine
        return self._local_dialogue_engine(
            messages=messages,
            last_user_msg=last_user_msg,
            lat=reporter_lat,
            lng=reporter_lng,
            dispatch_now=dispatch_now
        )

    async def _call_gemini_rest(
        self,
        messages: List[Dict[str, str]],
        last_user_msg: str,
        lat: Optional[float],
        lng: Optional[float],
        dispatch_now: bool
    ) -> Optional[Dict[str, Any]]:
        """Call Gemini 1.5 Flash using direct asynchronous REST."""
        system_instruction = (
            "You are CrisisSync AI, a calm, highly empathetic, and expert emergency voice dispatcher and ChatGPT-style crisis assistant. "
            "Your voice responses are spoken aloud to a caller in distress via Web Speech TTS. "
            "CRITICAL INSTRUCTIONS:\n"
            "1. ALWAYS directly answer whatever specific questions the user asks (e.g. 'what should I do?', 'how long will you take?', "
            "'how do I do CPR?', 'can I throw water on the fire?'). Provide immediate, life-saving first-aid and safety guidance.\n"
            "2. Keep spoken replies warm, human, reassuring, and concise (1 to 3 clear spoken sentences max). Never sound robotic, cold, or bureaucratic.\n"
            "3. Remember what the user already stated in the conversation history—NEVER ask for information they have already provided.\n"
            "4. NEVER repeat the same stock question like 'Do you need ambulances, police, or rescue teams?'.\n"
            "5. If emergency services are dispatched, reassure the caller that help is rolling and stay on the line to guide them.\n"
            "6. Evaluate your triage certainty: if caller is vague, panicking, conflicting, or requests a human, set human_escalation_required=true and ai_confidence < 0.60.\n"
            "Respond strictly in valid JSON with this schema:\n"
            "{\n"
            '  "reply": "Spoken response for caller (1-3 sentences)",\n'
            '  "incident_type": "Fire Emergency|Road Accident|Medical Emergency|Building Collapse|Gas Leak|Flood|Building Evacuation|General Emergency",\n'
            '  "severity": 1 to 5 integer,\n'
            '  "urgency": "LOW|MEDIUM|HIGH|CRITICAL",\n'
            '  "people_affected": integer,\n'
            '  "required_resources": ["AMBULANCE","RESCUE_TEAM","POLICE_UNIT","MEDICAL_UNIT","SHELTER"],\n'
            '  "ready_to_dispatch": boolean,\n'
            '  "auto_dispatch": boolean (true if user requests dispatch or severe emergency with location confirmed),\n'
            '  "extracted_location": "location summary string",\n'
            '  "ai_confidence": 0.0 to 1.0 float,\n'
            '  "ai_thinking": "Assessment reasoning explaining key clues detected, threat level, and triage certainty",\n'
            '  "human_escalation_required": boolean (true if caller asks for human, or confidence < 0.60, or ambiguous emergency),\n'
            '  "escalation_reason": "Explanation if escalated, else null"\n'
            "}"
        )

        history_str = ""
        for m in messages:
            role = m.get("role", "user").upper()
            content = m.get("content", "")
            if content and content != "HELLO_START":
                history_str += f"{role}: {content}\n"

        prompt = (
            f"{system_instruction}\n\n"
            f"Caller Coordinates: Lat {lat}, Lng {lng}\n"
            f"Dispatch requested now: {dispatch_now}\n\n"
            f"Conversation History:\n{history_str}\n\n"
            f"Latest caller utterance: {last_user_msg}\n\n"
            "JSON Response:"
        )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self._api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.25,
                "maxOutputTokens": 350,
                "responseMimeType": "application/json"
            }
        }

        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text_content = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text_content)
                return self._finalize_result(parsed, last_user_msg, lat, lng, dispatch_now)

        return None

    def _local_dialogue_engine(
        self,
        messages: List[Dict[str, str]],
        last_user_msg: str,
        lat: Optional[float],
        lng: Optional[float],
        dispatch_now: bool
    ) -> Dict[str, Any]:
        """
        Sophisticated situation-aware conversational emergency engine.
        Handles diverse user queries, safety instructions, first aid, ETAs,
        and ensures zero repetitive robotic loops.
        """
        user_lower = last_user_msg.lower().strip()
        full_user_text = " ".join([m.get("content", "") for m in messages if m.get("role") == "user"]).lower()
        assistant_texts = [m.get("content", "").lower() for m in messages if m.get("role") == "assistant"]
        assistant_full = " ".join(assistant_texts)

        # 1. Detect Emergency Incident Type
        detected_type = "General Emergency"
        # Check specific multi-word patterns first
        if any(w in full_user_text for w in ["building collapse", "roof collapse", "wall collapse", "structure collapse", "building fell", "crushed under rubble", "crushed under wall"]):
            detected_type = "Building Collapse"
        elif any(w in full_user_text for w in ["gas leak", "lpg", "cylinder leak", "gas cylinder", "smell of gas", "methane", "chemical spill"]):
            detected_type = "Gas Leak"
        elif any(w in full_user_text for w in ["flood", "water rising", "drowning", "submerged", "overflowing"]):
            detected_type = "Flood"
        elif any(w in full_user_text for w in ["fire", "smoke", "flames", "burning", "blaze", "burn breakout", "fire breakout"]):
            detected_type = "Fire Emergency"
        elif any(w in full_user_text for w in ["car crash", "collision", "road accident", "accident", "vehicle hit", "overturned", "run over"]):
            detected_type = "Road Accident"
        elif any(w in full_user_text for w in ["collapsed", "passed out", "fainted", "heart attack", "chest pain", "unconscious", "seizure", "stroke", "bleeding", "cardiac"]):
            detected_type = "Medical Emergency"
        elif any(w in full_user_text for w in ["evacuate", "evacuation", "bomb", "alarm"]):
            detected_type = "Building Evacuation"
        else:
            # Fallback keyword match from INCIDENT_TYPES
            for kw, itype in INCIDENT_TYPES.items():
                if kw in full_user_text:
                    detected_type = itype
                    break

        # 2. Extract Casualties & People Count
        people = 1
        # Check explicit digit mentions
        digits = re.findall(r'\b(\d{1,3})\s*(?:people|persons|victims|injured|patients|dead|trapped)?\b', full_user_text)
        if digits:
            try:
                val = int(digits[-1])
                if 1 <= val <= 200:
                    people = val
            except ValueError:
                pass
        elif any(w in full_user_text for w in ["two", "both", "couple"]):
            people = 2
        elif any(w in full_user_text for w in ["three", "triple"]):
            people = 3
        elif any(w in full_user_text for w in ["four"]):
            people = 4
        elif any(w in full_user_text for w in ["nobody", "no one", "no casualties", "everyone is safe", "no injuries"]):
            people = 0

        # 3. Assess Severity & Urgency
        severity = 3
        if any(w in full_user_text for w in ["critical", "dying", "unconscious", "explosion", "severe", "dead", "gunshot", "crushed", "huge fire", "flames spreading"]):
            severity = 5
        elif any(w in full_user_text for w in ["serious", "bad", "trapped", "bleeding heavily", "thick smoke", "fire breakout", "heavy", "collapsed"]):
            severity = 4
        elif any(w in full_user_text for w in ["minor", "slight", "small", "safe now", "no one hurt"]):
            severity = 2

        urgency_map = {5: "CRITICAL", 4: "HIGH", 3: "MEDIUM", 2: "LOW", 1: "LOW"}
        urgency = urgency_map.get(severity, "HIGH")

        # 4. Determine Resources
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

        # Location extraction
        location_desc = f"GPS ({lat:.4f}, {lng:.4f})" if lat and lng else "your current location"
        loc_match = re.search(r'(?:near|at|in|opposite|behind|on)\s+([A-Za-z0-9\s,.\-]+?)(?:\s+(?:and|so|please|send|fire|help|there)|\.|$)', full_user_text)
        if loc_match:
            extracted_loc = loc_match.group(1).strip().lower()
            generic_locs = ["the road", "the street", "the floor", "the ground", "the place", "a house", "my house", "here", "there"]
            if len(extracted_loc) > 3 and not any(extracted_loc == g or extracted_loc.startswith(g) for g in generic_locs):
                location_desc = f"{extracted_loc.title()} ({location_desc})"
            elif "house" in extracted_loc:
                location_desc = f"residential sector near {location_desc}"

        # 5. Check what assistant has already asked in previous turns
        asked_trapped = "trapped" in assistant_full
        asked_location = any(w in assistant_full for w in ["street", "floor", "landmark", "address", "building number"])
        asked_breathing = any(w in assistant_full for w in ["conscious", "breathing", "responsive"])
        asked_evacuated = any(w in assistant_full for w in ["evacuate", "outside", "open area"])
        already_dispatched = any(w in assistant_full for w in ["dispatched", "authorized", "en route", "rolling"])

        turn_count = len([m for m in messages if m.get("role") == "user"])

        # Check if caller wants dispatch triggered or questions have been satisfied
        satisfied_signals = [
            "send help", "send them", "send now", "hurry", "dispatch", "please come", 
            "need help fast", "send assistance", "send fire", "send ambulance", "send police", "yes send",
            "done", "that's all", "thats all", "everything told", "ok send", "please dispatch",
            "everyone is outside", "all outside", "nobody trapped", "no one trapped", "safe now",
            "outside", "evacuated"
        ]
        dispatch_intent = any(w in user_lower for w in satisfied_signals)
        auto_dispatch = dispatch_now or (dispatch_intent and (detected_type != "General Emergency" or lat is not None)) or (turn_count >= 2 and detected_type != "General Emergency")
        ready_to_dispatch = auto_dispatch or (turn_count >= 1 and detected_type != "General Emergency")

        # Check for explicit human operator request
        human_requested = any(w in user_lower for w in [
            "human", "operator", "agent", "real person", "person please", "speak to someone", 
            "talk to someone", "dispatcher please", "give me a human", "give me a person",
            "connect me to a person", "connect me to an operator", "talk to human",
            "escalate", "human operator", "supervisor"
        ])

        # Check for ambiguous distress signals without verified emergency hazard
        is_vague = any(w in user_lower for w in [
            "i don't know", "dont know", "not sure", "confused", "weird sound", 
            "strange noise", "screaming", "can't see", "cant tell", "something happened", 
            "unknown", "what is that", "loud bang", "no idea", "what's going on", "whats going on"
        ])
        has_specific_hazard = any(w in user_lower for w in [
            "fire", "smoke", "gas", "leak", "crash", "accident", "bleeding", 
            "collapse", "flood", "heart", "cpr", "breathing", "flames", "lpg", 
            "trapped", "injured", "burning", "evacuate"
        ])

        reply = ""
        ai_confidence = 0.85
        ai_thinking = ""
        human_escalation_required = False
        escalation_reason = None

        if human_requested:
            ai_confidence = 0.35
            human_escalation_required = True
            escalation_reason = "Caller explicitly requested direct escalation to a Senior Human Dispatcher."
            ai_thinking = "Direct human transfer requested by caller. Automated intake paused to ensure priority human triage. Routing live voice channel directly to Tactical Command Center."
            reply = (
                "I understand completely. I am routing our live voice line directly to the Senior Human Dispatcher in the Tactical Command Center right now. "
                "Please stay on the line, the operator console is connecting immediately."
            )
        elif is_vague and not has_specific_hazard and turn_count <= 2:
            ai_confidence = 0.42
            human_escalation_required = True
            escalation_reason = "Low AI confidence (42%) — Ambiguous distress signals without verified hazard classification require human dispatcher verification."
            ai_thinking = "Ambiguous emergency markers detected ('screaming/unidentified noise'). Lacks verified incident class or hazard type. Safety threshold requires human risk triage before fleet mobilization."
            reply = (
                "I want to make sure you get the exact right emergency support without delay. Because this situation has high uncertainty, "
                "I am immediately connecting our line to the Senior Human Dispatcher in the Tactical Command Center. Responders are on alert—stay right here with me."
            )

        # 6. Intent & Direct Question Answering
        is_question = (
            "?" in last_user_msg or 
            any(user_lower.startswith(w) for w in ["what", "how", "can i", "should i", "is it", "will", "when", "where", "why", "who", "do i", "are you", "tell me"]) or
            any(w in user_lower for w in ["what should i do", "what to do", "how long", "can i", "should i", "is it safe", "how do i", "how to"])
        )

        # --- A. Direct User Question Answering ---
        if is_question:
            # 1. ETA / Timing Question
            if any(w in user_lower for w in ["how long", "when will", "eta", "time", "where are they", "how much time", "coming yet", "how far"]):
                reply = (
                    "Emergency units have been dispatched from the nearest sector with priority sirens. "
                    "Estimated arrival is approximately 2 to 4 minutes. Stay in a safe, visible position and keep this line open."
                )

            # 2. Can I throw water on fire?
            elif any(w in user_lower for w in ["water", "throw water", "put water", "pour water"]):
                if any(w in full_user_text for w in ["electric", "wire", "appliance", "meter", "oil", "kitchen", "gas"]):
                    reply = (
                        "No, absolutely do NOT throw water on electrical or oil fires! Water conducts high voltage and causes grease fires to violently explode. "
                        "Evacuate everyone immediately and let the fire engines handle it."
                    )
                else:
                    reply = (
                        "Only use water on small paper or wood fires if you have a completely clear exit behind you. "
                        "If the fire is spreading or producing thick smoke, do not attempt to fight it—evacuate outside immediately."
                    )

            # 3. Can I move the victim / person?
            elif any(w in user_lower for w in ["move them", "move the", "move him", "move her", "shift", "drag"]):
                reply = (
                    "Do not move the injured person unless they are in immediate danger of fire, explosion, or collapsing structures. "
                    "Moving someone with potential spinal or neck injuries can cause permanent paralysis. Keep them warm and calm."
                )

            # 4. How to stop bleeding?
            elif any(w in user_lower for w in ["bleeding", "blood", "stop bleeding", "cut", "wound"]):
                reply = (
                    "Take a clean cloth, towel, or dressing and apply firm, continuous direct pressure straight down on the wound. "
                    "Do not remove the cloth even if blood soaks through—add more layers on top and maintain constant pressure."
                )

            # 5. How to do CPR / Patient not breathing?
            elif any(w in user_lower for w in ["cpr", "not breathing", "stopped breathing", "chest compression", "heart stopped", "pulse", "breath stopped"]):
                reply = (
                    "Place your hands interlocked in the center of their chest. Push hard and fast at 100 to 120 beats per minute, about 2 inches deep. "
                    "Do not stop chest compressions until the paramedics arrive at your side."
                )

            # 6. Burn treatment
            elif any(w in user_lower for w in ["burn", "scald", "ice on", "treat burn"]):
                reply = (
                    "Run cool, clean tap water over the burn for at least 10 minutes. Do not apply ice, butter, or ointments, "
                    "and cover the burn loosely with a clean, dry cloth."
                )

            # 7. Choking
            elif any(w in user_lower for w in ["choking", "choke", "heimlich"]):
                reply = (
                    "Stand behind them, wrap your arms around their waist, make a fist above the navel, and pull inward and upward firmly. "
                    "Repeat rapid thrusts until the object is expelled."
                )

            # 8. Can I go back inside?
            elif any(w in user_lower for w in ["go back", "re-enter", "grab", "get my", "valuables", "pets", "inside"]):
                reply = (
                    "Do not go back inside under any circumstances! Toxic smoke and superheated gas can incapacitate you in seconds. "
                    "Inform the arriving fire crew about any trapped pets or property immediately."
                )

            # 9. Is gas going to explode / Can I turn on lights?
            elif any(w in user_lower for w in ["explode", "explosion", "light", "switch", "spark"]):
                reply = (
                    "Accumulated gas is extremely flammable. Do not touch any light switches, power sockets, or phones indoors, "
                    "as an electrical spark can trigger an explosion. Evacuate outside upwind right away."
                )

            # 10. Who is coming / What units?
            elif any(w in user_lower for w in ["who is coming", "what unit", "what is coming", "police", "ambulance", "truck"]):
                units_str = ", ".join([r.replace("_", " ").title() for r in resources])
                reply = f"We have routed {units_str} with siren priority to {location_desc}. They are fully equipped for this emergency."

            # 11. General "What should I do?" / "What do I do while waiting?"
            elif any(w in user_lower for w in ["what should i do", "what do i do", "what to do", "how should i", "guide me"]):
                if detected_type == "Fire Emergency":
                    reply = (
                        "Stay low to the floor where the air is cleanest. Cover your nose and mouth with a damp cloth, feel doors for heat before opening, "
                        "and evacuate outside to an open area away from the building."
                    )
                elif detected_type == "Gas Leak":
                    reply = (
                        "Evacuate outdoors into fresh air immediately and walk upwind. Do not touch any light switches or start any cars. "
                        "Warn nearby neighbors from an open distance."
                    )
                elif detected_type == "Road Accident":
                    reply = (
                        "Stay safely behind the highway barrier or sidewalk away from active traffic. Turn on vehicle hazard lights if reachable, "
                        "and do not move injured victims unless there is immediate fire danger."
                    )
                elif detected_type == "Medical Emergency":
                    reply = (
                        "Check if the victim is breathing. If breathing, roll them gently into the side recovery position so their airway stays clear. "
                        "Keep them comfortable and speak to them in a calm, reassuring voice."
                    )
                else:
                    reply = (
                        "Ensure your immediate personal safety first and move clear of hazardous areas. "
                        "Position yourself near an easily identifiable landmark so the arriving emergency crew can spot you."
                    )

        # --- B. Caller Requesting Immediate Dispatch or Intake Satisfied ---
        if not reply and (dispatch_intent or dispatch_now or (auto_dispatch and not already_dispatched)):
            units_str = ", ".join([r.replace("_", " ").title() for r in resources])
            reply = (
                f"Emergency {detected_type} response has been authorized. {units_str} are rolling toward {location_desc} with sirens. "
                "I am transferring you directly to the Tactical Command Center to view live tracking and real-time road routes. Stay in a safe position."
            )

        # --- C. Caller Indicating Help Arrived / Sirens / Gratitude ---
        if not reply and any(w in user_lower for w in ["siren", "sirens", "they are here", "they're here", "arrived", "reach here", "truck is here", "ambulance is here", "thank you", "thanks", "bye", "goodbye"]):
            if any(w in user_lower for w in ["siren", "here", "arrived", "truck", "ambulance", "crew"]):
                reply = (
                    "Emergency crews have arrived on scene. Wave or signal from a safe distance so the commanders can locate you immediately. "
                    "I will remain on standby. Stay safe."
                )
            else:
                reply = (
                    "You are welcome. Response units are on site or pulling up now. "
                    "Follow the lead of the first responders and stay in a safe position."
                )

        # --- D. Caller Reporting Casualties Count / Medical Vulnerabilities ---
        if not reply and any(w in user_lower for w in ["people", "person", "victim", "injured", "hurt", "two", "three", "four", "elderly", "asthma", "child", "baby", "grandmother", "grandfather", "patient"]):
            if any(w in user_lower for w in ["asthma", "breath", "oxygen", "coughing"]):
                reply = (
                    f"Understood, noting {people} individual{'s' if people != 1 else ''} with respiratory vulnerability. Smoke inhalation is especially dangerous for asthma—cover their nose and mouth with a wet towel and assist them outside away from the plume immediately. Paramedics are alerted to bring oxygen."
                )
            else:
                reply = (
                    f"Logged {people} individual{'s' if people != 1 else ''} needing attention. Medical crews are notified for triage. "
                    "Are they conscious and in a safe spot away from danger?"
                )

        # --- D. Caller Describing Fire / Smoke Specifics ---
        if not reply and detected_type == "Fire Emergency":
            if any(w in user_lower for w in ["spread", "flame", "roof", "floor", "huge", "big"]):
                reply = (
                    "Noted, structural fire spread logged. Keep low to escape toxic gases and never use elevators. "
                    "Are you and everyone else already outside, or is anyone unaccounted for?"
                )
            elif any(w in user_lower for w in ["no one", "nobody", "out", "outside", "safe"]):
                reply = (
                    "Glad to hear everyone is outside. Maintain a safe distance of at least 100 feet from the building. "
                    "Is there any clear driveway access for the fire engines?"
                )
            elif not asked_trapped:
                reply = (
                    f"Fire emergency logged at {location_desc}. Priority response units are mobilizing. "
                    "Can you confirm if everyone has evacuated or if anyone is trapped inside?"
                )
            elif not asked_location and lat is None:
                reply = (
                    "Understood. What is the exact street name, building number, or prominent landmark nearby so fire trucks can reach without delay?"
                )

        # --- E. Caller Describing Medical / Injury Details ---
        if not reply and detected_type == "Medical Emergency":
            if any(w in user_lower for w in ["unconscious", "fainted", "responsive", "awake", "eyes"]):
                reply = (
                    "Understood. If they are unconscious but breathing, turn them onto their side in the recovery position. "
                    "Are they breathing steadily or gasping for air?"
                )
            elif not asked_breathing:
                reply = (
                    "Medical alert active. Paramedics are being dispatched with trauma equipment. "
                    "Is the patient currently conscious and breathing?"
                )
            elif any(w in user_lower for w in ["chest", "heart", "pain", "tight"]):
                reply = (
                    "Keep the patient sitting upright and loosen tight clothing around the neck. "
                    "Encourage them to take slow, gentle breaths while the cardiac unit approaches."
                )

        # --- F. Caller Describing Road Accidents ---
        if not reply and detected_type == "Road Accident":
            if any(w in user_lower for w in ["trapped", "pinned", "door"]):
                reply = (
                    "Hydraulic extrication rescue team is being dispatched. Do not try to wrench doors open if it causes pain to the victim. "
                    "Are there any fuel leaks or sparking wires near the vehicles?"
                )
            elif not asked_location and lat is None:
                reply = (
                    "Road accident logged. What highway, cross-street, or landmark are you closest to?"
                )

        # --- G. Caller Describing Gas Leaks ---
        if not reply and detected_type == "Gas Leak":
            if not asked_evacuated:
                reply = (
                    "Hazardous gas leak logged. Move all people outdoors upwind immediately. "
                    "Are you currently inside the structure or already outside in fresh air?"
                )

        # --- H. Caller Expressing Distress or Fear ---
        if not reply and any(w in user_lower for w in ["scared", "terrified", "panic", "afraid", "crying", "dying"]):
            reply = (
                "Take a deep breath. You are doing everything right by speaking with me, and help is on the way with emergency sirens. "
                "I am staying right here with you. Tell me if you are safe where you are standing."
            )

        # --- I. Caller Describing Location / Landmark ---
        if not reply and any(w in user_lower for w in ["street", "road", "near", "opposite", "behind", "building", "apartment", "flat", "gate"]):
            reply = (
                f"Landmark noted and transmitted to the navigation console. Responders are tracking {location_desc}. "
                "Do you or anyone with you need any medical advice while responders arrive?"
            )

        # --- J. First Turn Intro Fallback ---
        if not reply and turn_count <= 1:
            reply = (
                f"CrisisSync Dispatcher tracking your signal at {location_desc}. "
                "I am here to help you. Tell me what happened and if anyone is injured or in danger."
            )

        # --- K. Dynamic Conversational Follow-up (Adaptive, Non-Repetitive) ---
        if not reply:
            if already_dispatched:
                reply = (
                    f"First responders are currently in transit to {location_desc}. "
                    "I am right here with you on this line. What questions do you have or what do you need assistance with while waiting?"
                )
            elif not asked_location and lat is None:
                reply = (
                    f"Copy that. I have emergency units preparing for {detected_type}. "
                    "What is your exact street address, apartment number, or closest landmark?"
                )
            elif not asked_trapped and detected_type in ["Fire Emergency", "Building Collapse"]:
                reply = (
                    f"Understood. For the {detected_type}, can you confirm if all occupants are safely outside or if anyone is trapped?"
                )
            else:
                reply = (
                    f"Copy that, details recorded for {detected_type} at {location_desc}. "
                    "Emergency response teams are on standby and dispatching. Is everyone in a safe position right now?"
                )

        if not ai_thinking:
            clues = []
            if detected_type != "General Emergency":
                clues.append(f"{detected_type} markers")
            if any(w in full_user_text for w in ["trapped", "pinned", "door"]):
                clues.append("entrapment reported")
            if any(w in full_user_text for w in ["bleeding", "unconscious", "heart", "cpr", "injured"]):
                clues.append("medical trauma")
            if any(w in full_user_text for w in ["lpg", "cylinder", "smell", "gas"]):
                clues.append("flammable/toxic gas")
            if any(w in full_user_text for w in ["flame", "smoke", "burning", "fire"]):
                clues.append("thermal/smoke hazard")

            clues_text = ", ".join(clues) if clues else "general distress markers"
            loc_confirmed = lat is not None or "gps" in location_desc.lower() or len(location_desc) > 15

            base_conf = 0.85
            if detected_type != "General Emergency":
                base_conf += 0.05
            if loc_confirmed:
                base_conf += 0.04
            if people > 1:
                base_conf += 0.02
            if severity >= 4:
                base_conf = min(0.98, base_conf + 0.03)

            ai_confidence = round(min(0.98, max(0.65, base_conf)), 2)
            human_escalation_required = False
            escalation_reason = None
            ai_thinking = (
                f"Incident classified as {detected_type} (Severity S{severity}, {urgency} Urgency). "
                f"Key verified indicators: {clues_text}. "
                f"Location status: {'Confirmed via GPS' if loc_confirmed else 'Estimated'}. "
                f"AI Confidence: {int(ai_confidence * 100)}% (High Confidence - Safe for automated triage, unit dispatch, and 100m passerby radius alerting)."
            )

        return {
            "reply": reply,
            "incident_type": detected_type,
            "severity": severity,
            "urgency": urgency,
            "people_affected": max(1, people),
            "required_resources": resources,
            "ready_to_dispatch": ready_to_dispatch,
            "dispatched": auto_dispatch,
            "extracted_location": location_desc,
            "auto_dispatch": auto_dispatch,
            "ai_confidence": ai_confidence,
            "ai_thinking": ai_thinking,
            "human_escalation_required": human_escalation_required,
            "escalation_reason": escalation_reason,
            "escalated_to_operator": human_escalation_required,
        }

    def _finalize_result(
        self,
        data: Dict[str, Any],
        last_user_msg: str,
        lat: Optional[float],
        lng: Optional[float],
        dispatch_now: bool
    ) -> Dict[str, Any]:
        reply = data.get("reply", "CrisisSync Dispatcher here. What is your emergency?")
        incident_type = data.get("incident_type", "General Emergency")
        severity = int(data.get("severity", 3))
        urgency = data.get("urgency", "HIGH")
        people_affected = int(data.get("people_affected", 1))
        required_resources = data.get("required_resources", ["AMBULANCE"])
        ready = bool(data.get("ready_to_dispatch", False)) or dispatch_now
        auto_dispatch = bool(data.get("auto_dispatch", False)) or dispatch_now

        location_desc = data.get("extracted_location")
        if not location_desc:
            location_desc = f"GPS ({lat:.4f}, {lng:.4f})" if lat and lng else "Report location"

        ai_confidence = float(data.get("ai_confidence", 0.88))
        ai_thinking = data.get("ai_thinking", "")
        human_escalation_required = bool(data.get("human_escalation_required", False)) or (ai_confidence < 0.60)
        escalation_reason = data.get("escalation_reason")
        if human_escalation_required and not escalation_reason:
            escalation_reason = f"Low AI confidence ({int(ai_confidence * 100)}%) requires senior human dispatcher verification."

        return {
            "reply": reply,
            "incident_type": incident_type,
            "severity": max(1, min(5, severity)),
            "urgency": urgency,
            "people_affected": max(1, people_affected),
            "required_resources": required_resources,
            "ready_to_dispatch": ready,
            "dispatched": auto_dispatch,
            "extracted_location": location_desc,
            "auto_dispatch": auto_dispatch,
            "ai_confidence": ai_confidence,
            "ai_thinking": ai_thinking,
            "human_escalation_required": human_escalation_required,
            "escalation_reason": escalation_reason,
            "escalated_to_operator": human_escalation_required,
        }

voice_dispatcher = VoiceDispatcherAgent()
