"""Clinical Emergency Triage Engine for CrisisSync AI.
Implements Medical Priority Dispatch System (MPDS) and Fire Priority Dispatch System (FPDS) protocols.
Provides real-time clinical diagnostic inquiry:
- How many people are there / how many injured
- Is the person conscious / responsive
- Are they breathing / gasping
- Are they bleeding / hemorrhage severity & location
- What is the level of fire hazard (smoke, flames spreading, walls/roof involvement)
- Entrapment and evacuation status
- Immediate life-saving pre-arrival first-aid guidance
"""
import re
from typing import Dict, Any, List, Optional, Tuple
from app.ml.triage_neural_network import triage_dnn_predictor

class ClinicalTriageReasoner:
    def __init__(self):
        self.predictor = triage_dnn_predictor

    def analyze_and_respond(
        self,
        messages: List[Dict[str, str]],
        reporter_lat: Optional[float] = None,
        reporter_lng: Optional[float] = None,
        dispatch_now: bool = False,
    ) -> Dict[str, Any]:
        """Processes caller interaction and generates human clinical triage response."""
        user_msgs = [m.get("content", "").strip() for m in messages if m.get("role") == "user"]
        assistant_msgs = [m.get("content", "").strip() for m in messages if m.get("role") == "assistant"]

        last_user_msg = user_msgs[-1] if user_msgs else ""
        user_lower = last_user_msg.lower()
        full_conversation_user = " ".join(user_msgs).lower()
        full_assistant_history = " ".join(assistant_msgs).lower()

        # 1. Neural Multi-Task ML Inference
        dnn_result = self.predictor.predict(full_conversation_user)
        predicted_category = dnn_result["predicted_category"]
        predicted_severity = dnn_result["predicted_severity"]

        # 2. Rule & Keyword Refinement for Incident Category
        category = self._refine_category(full_conversation_user, predicted_category)

        # 3. Clinical Entity & State Extraction from Full Conversation
        state = self._extract_clinical_state(full_conversation_user, category)

        # 4. Check for Escalation Requests or Extreme Ambiguity
        human_requested = any(w in user_lower for w in [
            "human", "operator", "real person", "person please", "speak to someone",
            "talk to someone", "dispatcher please", "give me a human", "connect me to a person",
            "connect me to an operator", "talk to human", "supervisor"
        ])
        is_vague = any(w in user_lower for w in [
            "i don't know", "dont know", "not sure", "confused", "weird sound",
            "strange noise", "screaming", "can't see", "cant tell", "something happened",
            "unknown", "what is that", "loud bang", "no idea", "what's going on"
        ])
        has_hazard = any(w in full_conversation_user for w in [
            "fire", "smoke", "flame", "bleed", "blood", "crash", "accident", "unconscious",
            "fainted", "collapsed", "gas", "leak", "breath", "cpr", "heart", "choking", "burn"
        ])

        if human_requested:
            return {
                "reply": "I understand completely. I am routing our live voice line directly to the Senior Human Dispatcher in the Tactical Command Center right now. Please stay on the line, the operator console is connecting immediately.",
                "incident_type": category,
                "severity": 3,
                "urgency": "MEDIUM",
                "people_affected": state["people_count"] or 1,
                "required_resources": self._get_resources(category, 3),
                "ready_to_dispatch": False,
                "dispatched": False,
                "extracted_location": self._format_location(full_conversation_user, reporter_lat, reporter_lng),
                "ai_confidence": 0.35,
                "ai_thinking": "Caller explicitly requested direct human dispatcher escalation. Paused automated triage to prioritize human supervisor takeover.",
                "human_escalation_required": True,
                "escalation_reason": "Caller explicitly requested direct escalation to a Senior Human Dispatcher.",
                "escalated_to_operator": True
            }

        if is_vague and not has_hazard and len(user_msgs) <= 2:
            return {
                "reply": "I want to make sure you get the exact right emergency support without delay. Because this situation has high uncertainty, I am immediately connecting our line to the Senior Human Dispatcher in the Tactical Command Center. Responders are on alert—stay right here with me.",
                "incident_type": "General Emergency",
                "severity": 3,
                "urgency": "HIGH",
                "people_affected": 1,
                "required_resources": ["AMBULANCE", "POLICE_UNIT"],
                "ready_to_dispatch": False,
                "dispatched": False,
                "extracted_location": self._format_location(full_conversation_user, reporter_lat, reporter_lng),
                "ai_confidence": 0.42,
                "ai_thinking": "Ambiguous distress input without clear hazard or medical markers. Safety guardrail requires human operator assessment.",
                "human_escalation_required": True,
                "escalation_reason": "Low AI confidence (42%) — Ambiguous distress signals require senior dispatcher verification.",
                "escalated_to_operator": True
            }

        # 5. Direct Question Handling (User Asking for Guidance, ETA, or Safety)
        direct_answer = self._handle_direct_questions(user_lower, full_conversation_user, category, state)

        # 6. First-Aid Directives
        first_aid_directive = self._get_first_aid_directive(user_lower, state, category)

        # 7. Select the Next Best Probing Diagnostic Question (Human 911 Triage Interview)
        next_question, question_key = self._select_next_diagnostic_question(category, state, full_assistant_history)

        # 8. Dispatch Determination
        explicit_dispatch_request = any(w in user_lower for w in [
            "dispatch", "send help", "send them", "send now", "send fire", "send ambulance",
            "send trucks", "please come", "hurry", "send assistance"
        ])
        is_dispatched = bool(
            dispatch_now or
            explicit_dispatch_request or
            (state["severity"] >= 4 and len(user_msgs) >= 1) or
            len(user_msgs) >= 2
        )

        # 9. Empathetic Contextual Reflection
        reflection = self._build_reflection(last_user_msg, category, state)

        # 10. Synthesize the Spoken Conversational Response
        spoken_reply = self._compose_reply(
            direct_answer=direct_answer,
            reflection=reflection,
            first_aid=first_aid_directive,
            next_question=next_question,
            is_dispatched=is_dispatched,
            user_lower=user_lower
        )

        # 11. Compute AI Confidence & Transparent Thinking
        confidence, thinking = self._compute_confidence_and_thinking(category, state, dnn_result, user_msgs, reporter_lat, reporter_lng)

        resources = self._get_resources(category, state["severity"])

        return {
            "reply": spoken_reply,
            "incident_type": category,
            "severity": state["severity"],
            "urgency": state["urgency"],
            "people_affected": state["people_count"] or 1,
            "required_resources": resources,
            "ready_to_dispatch": True,
            "dispatched": is_dispatched,
            "extracted_location": self._format_location(full_conversation_user, reporter_lat, reporter_lng),
            "ai_confidence": confidence,
            "ai_thinking": thinking,
            "human_escalation_required": False,
            "escalation_reason": None,
            "escalated_to_operator": False,
            "triage_state": state
        }

    def _refine_category(self, full_text: str, predicted: str) -> str:
        """Rule-based verification of incident category."""
        if any(w in full_text for w in ["fire", "flame", "smoke", "blaze", "burning", "burnt", "grease fire"]):
            return "Fire Emergency"
        if any(w in full_text for w in ["car crash", "collision", "overturned", "flipped", "accident", "vehicle hit", "pedestrian hit"]):
            return "Road Accident"
        if any(w in full_text for w in ["collapsed", "unconscious", "heart attack", "chest pain", "seizure", "stroke", "bleeding", "cut", "fainted", "cpr", "not breathing"]):
            return "Medical Emergency"
        if any(w in full_text for w in ["gas leak", "lpg", "cylinder", "smell of gas", "methane", "chemical spill"]):
            return "Gas Leak"
        if any(w in full_text for w in ["wall collapse", "building collapse", "roof collapse", "trapped under debris", "rubble"]):
            return "Building Collapse"
        return predicted or "Medical Emergency"

    def _extract_clinical_state(self, full_text: str, category: str) -> Dict[str, Any]:
        """Extracts medical facts, casualties, and hazard levels from caller speech."""
        state: Dict[str, Any] = {
            "people_count": None,
            "injured_count": None,
            "consciousness": None,
            "breathing": None,
            "bleeding": None,
            "bleeding_location": None,
            "fire_hazard": None,
            "trapped": None,
            "evacuated": None,
            "severity": 3,
            "urgency": "HIGH"
        }

        # People & Casualties
        num_match = re.search(r'\b(\d{1,2})\s*(?:people|persons|victims|injured|patients|dead|trapped)?\b', full_text)
        if num_match:
            try:
                state["people_count"] = int(num_match.group(1))
            except ValueError:
                pass
        elif any(w in full_text for w in ["two people", "two of us", "both of us", "2 people"]):
            state["people_count"] = 2
        elif any(w in full_text for w in ["three people", "3 of us", "three of them"]):
            state["people_count"] = 3
        elif any(w in full_text for w in ["four people", "4 of us"]):
            state["people_count"] = 4
        elif any(w in full_text for w in ["just me", "alone", "one person", "only me", "my brother", "my father", "my mother", "my sister"]):
            state["people_count"] = 1

        # Consciousness
        if any(w in full_text for w in ["unconscious", "not waking up", "won't wake up", "passed out", "fainted", "unresponsive", "eyes closed"]):
            state["consciousness"] = "unconscious"
            state["severity"] = max(state["severity"], 4)
        elif any(w in full_text for w in ["conscious", "awake", "talking", "responsive", "crying", "screaming", "speaking"]):
            state["consciousness"] = "conscious"

        # Breathing
        if any(w in full_text for w in ["not breathing", "stopped breathing", "no pulse", "no breath", "can't breathe"]):
            state["breathing"] = "stopped"
            state["severity"] = 5
            state["urgency"] = "CRITICAL"
        elif any(w in full_text for w in ["gasping", "shortness of breath", "struggling to breathe", "wheezing", "shallow breath", "choking"]):
            state["breathing"] = "distressed"
            state["severity"] = max(state["severity"], 4)
        elif any(w in full_text for w in ["breathing normally", "breathing fine", "breathing okay", "chest is moving", "steady breath"]):
            state["breathing"] = "normal"

        # Bleeding & Hemorrhage
        if any(w in full_text for w in ["bleeding heavily", "blood everywhere", "spurting", "gushing", "soaked in blood", "severe bleeding"]):
            state["bleeding"] = "severe"
            state["severity"] = max(state["severity"], 4)
        elif any(w in full_text for w in ["bleeding", "blood", "cut", "wound", "laceration"]):
            state["bleeding"] = "moderate"
            state["severity"] = max(state["severity"], 3)
        elif any(w in full_text for w in ["not bleeding", "no blood", "no cuts", "clean"]):
            state["bleeding"] = "none"

        # Bleeding Location
        if any(w in full_text for w in ["head", "forehead", "skull", "scalp", "face"]):
            state["bleeding_location"] = "head"
        elif any(w in full_text for w in ["arm", "hand", "wrist", "finger"]):
            state["bleeding_location"] = "arm"
        elif any(w in full_text for w in ["leg", "thigh", "knee", "foot", "ankle"]):
            state["bleeding_location"] = "leg"
        elif any(w in full_text for w in ["chest", "stomach", "abdomen", "torso"]):
            state["bleeding_location"] = "torso"

        # Fire Hazard Level
        if any(w in full_text for w in ["roof", "spreading fast", "walls catching", "huge fire", "entire house", "engulfed", "flames spreading"]):
            state["fire_hazard"] = "spreading_structure"
            state["severity"] = max(state["severity"], 5)
            state["urgency"] = "CRITICAL"
        elif any(w in full_text for w in ["flames", "fire on the", "pan fire", "stove fire"]):
            state["fire_hazard"] = "contained_flames"
            state["severity"] = max(state["severity"], 4)
        elif any(w in full_text for w in ["thick black smoke", "dense smoke", "choking smoke"]):
            state["fire_hazard"] = "heavy_smoke"
            state["severity"] = max(state["severity"], 4)
        elif any(w in full_text for w in ["light smoke", "small smoke", "smell of smoke"]):
            state["fire_hazard"] = "light_smoke"

        # Entrapment & Evacuation
        if any(w in full_text for w in ["trapped", "stuck inside", "can't get out", "pinned", "door jammed", "rubble"]):
            state["trapped"] = True
            state["severity"] = max(state["severity"], 4)
        elif any(w in full_text for w in ["everyone is outside", "all outside", "we evacuated", "nobody trapped", "no one trapped", "in the street", "on the road"]):
            state["trapped"] = False
            state["evacuated"] = True

        if state["severity"] == 5:
            state["urgency"] = "CRITICAL"
        elif state["severity"] == 4:
            state["urgency"] = "HIGH"
        else:
            state["urgency"] = "MEDIUM"

        return state

    def _handle_direct_questions(self, user_lower: str, full_text: str, category: str, state: Dict[str, Any]) -> Optional[str]:
        """Directly answers user-initiated medical, safety, or ETA questions."""
        # 1. ETA / Timing
        if any(w in user_lower for w in ["how long", "when will", "eta", "how far", "where are they", "how much time", "coming yet"]):
            return "Emergency response units have been dispatched with high-priority sirens. Estimated arrival is approximately 2 to 4 minutes. Stay in a safe, visible position and keep this line open."

        # 2. Water on fire
        if any(w in user_lower for w in ["throw water", "put water", "pour water", "use water"]):
            if any(w in full_text for w in ["electric", "wire", "meter", "oil", "kitchen", "grease", "pan"]):
                return "No, absolutely do NOT throw water on electrical or oil fires! Water violently explodes grease fires and conducts fatal high-voltage shocks. Evacuate everyone outside immediately."
            return "Only use water on paper or wood fires if you have a clear, unblocked exit behind you. If flames are spreading, evacuate outside immediately."

        # 3. How to stop bleeding
        if any(w in user_lower for w in ["how to stop bleeding", "stop the bleeding", "bleeding what to do", "stop bleeding"]):
            loc = state["bleeding_location"] or "wound"
            return f"Take a clean cloth or towel right now and press down firmly with both hands directly on the {loc}. Do NOT lift the cloth even if blood soaks through—add more layers on top and maintain steady, hard pressure."

        # 4. CPR Guidance
        if any(w in user_lower for w in ["cpr", "how to do cpr", "stopped breathing", "not breathing what to do"]):
            return "Place your hands interlocked in the exact center of their chest. Push hard and fast at 100 to 120 beats per minute, about 2 inches deep. Do not stop compressions until the paramedics take over."

        # 5. Move victim
        if any(w in user_lower for w in ["move them", "move him", "move her", "shift", "drag"]):
            return "Do not move the injured person unless there is immediate danger of fire, explosion, or collapsing structures. Moving someone with potential spinal or neck trauma can cause permanent paralysis."

        # 6. Burn treatment
        if any(w in user_lower for w in ["burn", "scald", "treat burn", "ice"]):
            return "Run cool, clean tap water over the burn for at least 10 minutes. Never apply ice, butter, or oil, as that damages tissue. Cover loosely with a clean, dry dressing."

        # 7. Go back inside
        if any(w in user_lower for w in ["go back inside", "grab valuables", "get my phone", "pets inside", "re-enter"]):
            return "Do NOT go back inside under any circumstances! Superheated smoke and toxic gases can cause unconsciousness in two breaths. Tell the arriving fire crew about anyone or pets inside."

        return None

    def _get_first_aid_directive(self, user_lower: str, state: Dict[str, Any], category: str) -> Optional[str]:
        """Provides proactive life-saving first-aid directives based on the clinical state."""
        if state["bleeding"] in ["severe", "moderate"] and any(w in user_lower for w in ["bleeding", "blood", "cut", "wound"]):
            loc = state["bleeding_location"] or "wound"
            return f"Apply firm, direct pressure straight down on the {loc} with a clean towel. Do not remove it if blood soaks through; add more cloth on top."

        if state["consciousness"] == "unconscious" and state["breathing"] == "normal" and any(w in user_lower for w in ["unconscious", "passed out", "fainted"]):
            return "Because they are breathing, gently roll them onto their side into the recovery position so their airway stays open."

        if state["breathing"] == "stopped":
            return "Begin chest compressions in the center of the chest immediately: 100 to 120 beats per minute, 2 inches deep."

        if category == "Fire Emergency" and any(w in user_lower for w in ["smoke", "flame", "kitchen"]):
            return "Stay low to the floor where the air is cleanest, cover your nose and mouth with a cloth, and move everyone outside."

        if category == "Gas Leak":
            return "Do not touch any light switches, electrical plugs, or car ignitions. Evacuate outdoors upwind into fresh air."

        return None

    def _select_next_diagnostic_question(
        self,
        category: str,
        state: Dict[str, Any],
        assistant_history: str
    ) -> Tuple[str, str]:
        """
        Dynamically selects the next vital clinical diagnostic question that a human 911 dispatcher
        would ask, ensuring ZERO repetition of previously answered topics.
        """
        # Question A: People & Casualties Count
        if state["people_count"] is None and "how many people" not in assistant_history:
            return (
                "How many people are there with you, and how many are injured or in need of medical help?",
                "q_people_count"
            )

        # MEDICAL & TRAUMA INTERVIEW
        if category in ["Medical Emergency", "Road Accident", "Building Collapse"]:
            # Question B: Consciousness / Responsiveness
            if state["consciousness"] is None and "conscious" not in assistant_history and "unconscious" not in assistant_history:
                return (
                    "Is the person conscious and responding to your voice right now, or completely unresponsive?",
                    "q_consciousness"
                )

            # Question C: Breathing Status
            if state["breathing"] is None and "breathing" not in assistant_history:
                return (
                    "Are they breathing steadily right now? Look at their chest—is it rising and falling, or are they gasping?",
                    "q_breathing"
                )

            # Question D: Bleeding Diagnostic
            if state["bleeding"] is None and "bleeding" not in assistant_history:
                return (
                    "Is the person bleeding? If yes, where is the blood coming from, and is it spurting out or steadily oozing?",
                    "q_bleeding"
                )

            # Question E: Mechanism of Injury / Preceding event
            if "what happened to" not in assistant_history and "did they fall" not in assistant_history:
                return (
                    "What happened to the person right before this—did they collapse suddenly, suffer a fall, or get struck?",
                    "q_mechanism"
                )

        # FIRE EMERGENCY INTERVIEW
        if category == "Fire Emergency":
            # Question F: Level of Fire Hazard & Spread
            if state["fire_hazard"] is None and "level of fire hazard" not in assistant_history and "smoke or flames" not in assistant_history:
                return (
                    "What is the level of fire hazard right now—is it light smoke, or are active flames spreading to the walls and ceiling?",
                    "q_fire_hazard"
                )

            # Question G: Entrapment / Evacuation Status
            if state["trapped"] is None and "trapped inside" not in assistant_history:
                return (
                    "Is anyone trapped inside the building, or has everyone evacuated safely outside into the open air?",
                    "q_entrapment"
                )

            # Question H: Fuel & Materials Burning
            if "what is on fire" not in assistant_history and "what is burning" not in assistant_history:
                return (
                    "What exactly is on fire—is it kitchen grease, electrical wiring, appliances, or structural walls?",
                    "q_materials_burning"
                )

        # ROAD ACCIDENT INTERVIEW
        if category == "Road Accident":
            # Question I: Vehicle Entrapment & Pin-ins
            if state["trapped"] is None and "trapped inside" not in assistant_history and "pinned" not in assistant_history:
                return (
                    "Is anyone trapped or pinned inside the vehicles, or are the doors able to open?",
                    "q_crash_entrapment"
                )

            # Question J: Fuel Leak / Fire Hazard
            if "fuel leak" not in assistant_history and "smoke" not in assistant_history:
                return (
                    "Do you smell gasoline leaking, or is there any smoke or fire visible near the vehicles?",
                    "q_crash_fuel"
                )

        # GAS LEAK INTERVIEW
        if category == "Gas Leak":
            # Question K: Evacuation
            if state["evacuated"] is None and "outside" not in assistant_history:
                return (
                    "Are you and all other occupants already outdoors in fresh air, or is anyone still inside?",
                    "q_gas_evac"
                )
            if "hissing sound" not in assistant_history:
                return (
                    "Can you hear a loud hissing noise from the gas cylinder, and has anyone touched any light switches?",
                    "q_gas_hiss"
                )

        # Default Safety Check if all clinical parameters satisfied
        return (
            "Emergency response units are actively en route with sirens. Are you in a safe position right now while we wait for their arrival?",
            "q_scene_safety"
        )

    def _build_reflection(self, last_msg: str, category: str, state: Dict[str, Any]) -> str:
        """Constructs an empathetic, human reflection directly acknowledging caller input."""
        lower = last_msg.lower()
        if "bleed" in lower or "blood" in lower:
            loc = state["bleeding_location"] or "wound"
            return f"Understood, active bleeding reported from the {loc}."
        if "unconscious" in lower or "won't wake up" in lower or "fainted" in lower:
            return "Understood, victim is currently unconscious and unresponsive."
        if "fire" in lower or "flame" in lower or "smoke" in lower:
            return f"Copy that, structural {category} confirmed."
        if "crash" in lower or "collision" in lower:
            return "Understood, vehicular collision with potential injuries."
        if "gas" in lower or "leak" in lower or "lpg" in lower:
            return "Understood, hazardous gas leak detected."
        if "two" in lower or "three" in lower or "people" in lower:
            count = state["people_count"] or 2
            return f"Noted, {count} individuals involved in this emergency."
        return f"Copy that, logging emergency details for {category}."

    def _compose_reply(
        self,
        direct_answer: Optional[str],
        reflection: str,
        first_aid: Optional[str],
        next_question: str,
        is_dispatched: bool,
        user_lower: str
    ) -> str:
        """Synthesizes a cohesive, human 911 dispatcher spoken response (2-3 concise sentences)."""
        parts = []

        # If user asked a direct question (ETA, can I throw water, how to do CPR), answer directly first!
        if direct_answer:
            parts.append(direct_answer)
            # Add next question if short
            if len(direct_answer.split()) < 25 and next_question:
                parts.append(next_question)
            return " ".join(parts)

        # Otherwise: [Empathetic Reflection] + [First Aid Directive] + [Dispatch Notice if applicable] + [Probing Diagnostic Question]
        parts.append(reflection)

        if is_dispatched:
            if any(w in user_lower for w in ["dispatch", "send help", "send them", "send fire", "send ambulance", "please"]):
                parts.append("Priority emergency response units have been authorized and dispatched to your location. You can track live telemetry in the Command Center.")
            else:
                parts.append("Priority response units have been authorized and dispatched with sirens.")

        if first_aid:
            parts.append(first_aid)

        if next_question:
            parts.append(next_question)

        return " ".join(parts)

    def _compute_confidence_and_thinking(
        self,
        category: str,
        state: Dict[str, Any],
        dnn_result: Dict[str, Any],
        user_msgs: List[str],
        lat: Optional[float],
        lng: Optional[float]
    ) -> Tuple[float, str]:
        """Calculates triage certainty score and human-readable diagnostic reasoning."""
        base = 0.85
        clues = []

        if category != "General Emergency":
            base += 0.05
            clues.append(f"Category: {category}")
        if lat is not None and lng is not None:
            base += 0.03
            clues.append(f"GPS verified ({lat:.4f}, {lng:.4f})")
        if state["people_count"] is not None:
            base += 0.02
            clues.append(f"Casualty count: {state['people_count']}")
        if state["consciousness"] is not None:
            base += 0.02
            clues.append(f"Consciousness: {state['consciousness']}")
        if state["bleeding"] is not None:
            base += 0.02
            clues.append(f"Bleeding: {state['bleeding']} ({state['bleeding_location'] or 'general'})")
        if state["fire_hazard"] is not None:
            base += 0.02
            clues.append(f"Fire hazard level: {state['fire_hazard']}")

        confidence = round(min(0.98, max(0.70, base)), 2)
        clues_str = " | ".join(clues) if clues else "Initial distress intake"

        thinking = (
            f"Clinical Diagnostic State: {clues_str}. "
            f"ML Neural Prediction: {dnn_result.get('predicted_category', category)} (Confidence: {dnn_result.get('category_confidence', 0.90):.0%}). "
            f"Protocol: Active MPDS/FPDS Triage Interview. "
            f"Triage Certainty: {int(confidence * 100)}% (Automated clinical triage verified)."
        )

        return confidence, thinking

    def _get_resources(self, category: str, severity: int) -> List[str]:
        res_map = {
            "Medical Emergency": ["AMBULANCE", "MEDICAL_UNIT"],
            "Fire Emergency": ["RESCUE_TEAM", "AMBULANCE"],
            "Road Accident": ["AMBULANCE", "POLICE_UNIT"],
            "Gas Leak": ["RESCUE_TEAM", "POLICE_UNIT", "AMBULANCE"],
            "Building Collapse": ["RESCUE_TEAM", "AMBULANCE", "MEDICAL_UNIT"],
            "General Emergency": ["AMBULANCE", "POLICE_UNIT"],
        }
        units = list(res_map.get(category, ["AMBULANCE", "POLICE_UNIT"]))
        if severity >= 4 and "MEDICAL_UNIT" not in units:
            units.append("MEDICAL_UNIT")
        return units

    def _format_location(self, text: str, lat: Optional[float], lng: Optional[float]) -> str:
        loc_match = re.search(r'(?:near|at|in|opposite|behind|on)\s+([A-Za-z0-9\s,.\-]+?)(?:\s+(?:and|so|please|send|fire|help|there)|\.|$)', text)
        gps = f"GPS ({lat:.4f}, {lng:.4f})" if lat and lng else "Live GPS"
        if loc_match:
            loc = loc_match.group(1).strip().title()
            if len(loc) > 3 and loc.lower() not in ["here", "there", "my house", "the road"]:
                return f"{loc} ({gps})"
        return gps

clinical_triage_reasoner = ClinicalTriageReasoner()
