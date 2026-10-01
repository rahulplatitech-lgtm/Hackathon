"""Emergency Clinical Triage Dataset for CrisisSync AI.
Comprehensive multi-turn emergency dialogue dataset annotated with:
- incident_type
- severity (1 to 5)
- urgency (LOW, MEDIUM, HIGH, CRITICAL)
- clinical entities: [has_bleeding, is_unconscious, breathing_distress, fire_hazard_level, is_trapped, casualty_count]
- recommended_clinical_question: The next clinical diagnostic question a human 911 dispatcher would ask.
"""
from typing import List, Dict, Any

EMERGENCY_TRIAGE_SAMPLES: List[Dict[str, Any]] = [
    # --- 1. MEDICAL EMERGENCIES: UNCONSCIOUSNESS & COLLAPSE ---
    {
        "text": "My father just collapsed on the living room floor and won't wake up",
        "category": "Medical Emergency",
        "severity": 4,
        "urgency": "CRITICAL",
        "has_bleeding": False,
        "is_unconscious": True,
        "breathing_distress": True,
        "fire_hazard": "none",
        "is_trapped": False,
        "people_count": 1,
        "injured_count": 1,
        "action": "check_breathing",
        "question": "Is your father breathing steadily right now? Look closely at his chest—is it rising and falling, or is he gasping?"
    },
    {
        "text": "Someone fainted at the bus stop and is lying unconscious on the sidewalk",
        "category": "Medical Emergency",
        "severity": 4,
        "urgency": "HIGH",
        "has_bleeding": False,
        "is_unconscious": True,
        "breathing_distress": False,
        "fire_hazard": "none",
        "is_trapped": False,
        "people_count": 1,
        "injured_count": 1,
        "action": "check_responsiveness",
        "question": "Tap them gently on the shoulder and speak loudly. Are they responding to your voice, and are they breathing?"
    },
    {
        "text": "My coworker had a sudden seizure, fell backward, and hit his head on the concrete",
        "category": "Medical Emergency",
        "severity": 4,
        "urgency": "CRITICAL",
        "has_bleeding": True,
        "is_unconscious": True,
        "breathing_distress": False,
        "fire_hazard": "none",
        "is_trapped": False,
        "people_count": 1,
        "injured_count": 1,
        "action": "check_head_bleeding",
        "question": "Is there active bleeding from his head, and is he currently having convulsions or still unconscious?"
    },
    {
        "text": "He is not breathing at all, I cannot feel any pulse or breath",
        "category": "Medical Emergency",
        "severity": 5,
        "urgency": "CRITICAL",
        "has_bleeding": False,
        "is_unconscious": True,
        "breathing_distress": True,
        "fire_hazard": "none",
        "is_trapped": False,
        "people_count": 1,
        "injured_count": 1,
        "action": "immediate_cpr",
        "question": "Start chest compressions immediately! Interlock your hands in the center of his chest and push hard and fast at 100 to 120 beats per minute. Can you do that right now?"
    },
    {
        "text": "My elderly mother is having severe chest pain radiating down her left arm and shortness of breath",
        "category": "Medical Emergency",
        "severity": 5,
        "urgency": "CRITICAL",
        "has_bleeding": False,
        "is_unconscious": False,
        "breathing_distress": True,
        "fire_hazard": "none",
        "is_trapped": False,
        "people_count": 1,
        "injured_count": 1,
        "action": "cardiac_assessment",
        "question": "Is she conscious and able to talk? Have her sit down in a comfortable position, loosen any tight clothing, and ask if she has prescribed nitroglycerin."
    },

    # --- 2. TRAUMA & SEVERE BLEEDING ---
    {
        "text": "There was a bad cut from broken glass, he is bleeding heavily from his arm and blood is everywhere",
        "category": "Medical Emergency",
        "severity": 4,
        "urgency": "CRITICAL",
        "has_bleeding": True,
        "is_unconscious": False,
        "breathing_distress": False,
        "fire_hazard": "none",
        "is_trapped": False,
        "people_count": 1,
        "injured_count": 1,
        "action": "hemorrhage_control",
        "question": "Is the blood spurting out in rhythmic pulses, or is it a steady flow? Take a clean cloth and apply firm, direct pressure without letting go."
    },
    {
        "text": "He got stabbed in the upper abdomen and is bleeding profusely",
        "category": "Medical Emergency",
        "severity": 5,
        "urgency": "CRITICAL",
        "has_bleeding": True,
        "is_unconscious": False,
        "breathing_distress": True,
        "fire_hazard": "none",
        "is_trapped": False,
        "people_count": 1,
        "injured_count": 1,
        "action": "penetrating_trauma",
        "question": "Is the knife or object still in the wound? Do NOT remove it. Apply firm pressure around the object with clean cloth. Is he alert or becoming pale and faint?"
    },
    {
        "text": "A worker fell from a 15-foot ladder, his leg looks deformed and bone is sticking out with bleeding",
        "category": "Medical Emergency",
        "severity": 4,
        "urgency": "CRITICAL",
        "has_bleeding": True,
        "is_unconscious": False,
        "breathing_distress": False,
        "fire_hazard": "none",
        "is_trapped": False,
        "people_count": 1,
        "injured_count": 1,
        "action": "compound_fracture",
        "question": "Do not attempt to push the bone back or move his leg. Cover the wound with a clean dry dressing. Is he experiencing severe neck or back pain?"
    },

    # --- 3. STRUCTURE FIRES & THERMAL HAZARDS ---
    {
        "text": "There is a fire in my apartment kitchen, grease pan caught fire and flames are reaching the cabinets",
        "category": "Fire Emergency",
        "severity": 4,
        "urgency": "CRITICAL",
        "has_bleeding": False,
        "is_unconscious": False,
        "breathing_distress": True,
        "fire_hazard": "spreading_structure",
        "is_trapped": False,
        "people_count": 1,
        "injured_count": 0,
        "action": "grease_fire_evacuation",
        "question": "Do NOT throw water on grease! What is the level of fire hazard right now—is everyone outside the apartment, or is anyone still in the bedrooms?"
    },
    {
        "text": "Thick black smoke is billowing from the apartment building opposite mine, I can see bright orange flames on the 3rd floor",
        "category": "Fire Emergency",
        "severity": 5,
        "urgency": "CRITICAL",
        "has_bleeding": False,
        "is_unconscious": False,
        "breathing_distress": True,
        "fire_hazard": "spreading_structure",
        "is_trapped": True,
        "people_count": 5,
        "injured_count": 2,
        "action": "structure_fire_rescue",
        "question": "Are there people trapped on balconies or at the windows? Can you see if the main stairwell is blocked by smoke?"
    },
    {
        "text": "Smell of burning electrical wires inside the wall, wall is warm to touch and sparking",
        "category": "Fire Emergency",
        "severity": 3,
        "urgency": "HIGH",
        "has_bleeding": False,
        "is_unconscious": False,
        "breathing_distress": False,
        "fire_hazard": "contained_flames",
        "is_trapped": False,
        "people_count": 2,
        "injured_count": 0,
        "action": "electrical_fire_safety",
        "question": "Can you safely access the main circuit breaker to shut off master electrical power without touching the sparking wall? How many people are in the house?"
    },
    {
        "text": "The entire roof is engulfed in flames and embers are raining down onto neighboring houses",
        "category": "Fire Emergency",
        "severity": 5,
        "urgency": "CRITICAL",
        "has_bleeding": False,
        "is_unconscious": False,
        "breathing_distress": True,
        "fire_hazard": "spreading_structure",
        "is_trapped": False,
        "people_count": 8,
        "injured_count": 1,
        "action": "wildfire_structure_spread",
        "question": "Has everyone evacuated out to the street at least 150 feet away? Are there nearby cars or propane tanks close to the fire line?"
    },

    # --- 4. ROAD ACCIDENTS & VEHICLE COLLISIONS ---
    {
        "text": "Two cars collided at high speed at the junction, one car flipped over onto its roof",
        "category": "Road Accident",
        "severity": 4,
        "urgency": "CRITICAL",
        "has_bleeding": True,
        "is_unconscious": False,
        "breathing_distress": False,
        "fire_hazard": "none",
        "is_trapped": True,
        "people_count": 3,
        "injured_count": 2,
        "action": "vehicle_extrication",
        "question": "How many people are there inside the overturned car, and are they trapped or able to crawl out? Do you smell gasoline leaking?"
    },
    {
        "text": "A motorcycle hit a pedestrian crossing the road, both are down and not moving",
        "category": "Road Accident",
        "severity": 4,
        "urgency": "CRITICAL",
        "has_bleeding": True,
        "is_unconscious": True,
        "breathing_distress": False,
        "fire_hazard": "none",
        "is_trapped": False,
        "people_count": 2,
        "injured_count": 2,
        "action": "multi_casualty_traffic",
        "question": "Are both individuals conscious, and is anyone bleeding heavily? Do not move their heads or necks to prevent spinal cord injury."
    },
    {
        "text": "A truck smashed into a road divider, the driver is pinned by the steering wheel and bleeding from his face",
        "category": "Road Accident",
        "severity": 5,
        "urgency": "CRITICAL",
        "has_bleeding": True,
        "is_unconscious": False,
        "breathing_distress": True,
        "fire_hazard": "smoke_only",
        "is_trapped": True,
        "people_count": 1,
        "injured_count": 1,
        "action": "pinned_driver_rescue",
        "question": "Is the driver conscious and talking to you? Is there any smoke or fire coming from the engine compartment?"
    },

    # --- 5. HAZARDOUS GAS LEAKS & CHEMICAL THREATS ---
    {
        "text": "Extremely strong smell of LPG cooking gas inside the kitchen, loud hissing sound from the cylinder regulator",
        "category": "Gas Leak",
        "severity": 4,
        "urgency": "CRITICAL",
        "has_bleeding": False,
        "is_unconscious": False,
        "breathing_distress": True,
        "fire_hazard": "none",
        "is_trapped": False,
        "people_count": 2,
        "injured_count": 0,
        "action": "gas_leak_evacuation",
        "question": "Do NOT turn on or off any light switches or appliances! Are you and everyone else already outside in fresh air?"
    },
    {
        "text": "People are coughing and fainting in the basement from an unknown chemical or sewer gas smell",
        "category": "Gas Leak",
        "severity": 5,
        "urgency": "CRITICAL",
        "has_bleeding": False,
        "is_unconscious": True,
        "breathing_distress": True,
        "fire_hazard": "none",
        "is_trapped": True,
        "people_count": 4,
        "injured_count": 3,
        "action": "toxic_gas_rescue",
        "question": "Do not enter the basement yourself. How many people are down there, and can anyone walk out on their own?"
    },

    # --- 6. STRUCTURAL COLLAPSE & ENTRAPMENT ---
    {
        "text": "An old building wall collapsed during renovation, two workers are trapped under bricks and concrete debris",
        "category": "Building Collapse",
        "severity": 5,
        "urgency": "CRITICAL",
        "has_bleeding": True,
        "is_unconscious": False,
        "breathing_distress": True,
        "fire_hazard": "none",
        "is_trapped": True,
        "people_count": 2,
        "injured_count": 2,
        "action": "collapse_entrapment",
        "question": "Are the trapped workers calling out or responding to you? Do you see any severed live electrical cables nearby?"
    },
    {
        "text": "A balcony slab fell down onto the walkway below and struck someone passing by",
        "category": "Building Collapse",
        "severity": 4,
        "urgency": "CRITICAL",
        "has_bleeding": True,
        "is_unconscious": True,
        "breathing_distress": False,
        "fire_hazard": "none",
        "is_trapped": False,
        "people_count": 1,
        "injured_count": 1,
        "action": "falling_debris_strike",
        "question": "Is the person conscious, and are they bleeding from the head or chest? Move them only if more debris is actively falling."
    }
]

# Generate synthesized and augmented permutations for robust NLP training
def get_augmented_triage_dataset(multiplier: int = 50) -> List[Dict[str, Any]]:
    """Generates an extensive augmented dataset with variation in phrasing, severity, and victim counts."""
    augmented = []
    modifiers = [
        "", "please hurry ", "oh my god ", "someone help ", "emergency here ", 
        "right now ", "urgent dispatch needed ", "we have a critical situation "
    ]
    location_suffixes = [
        "", " near the city center", " on 4th cross road", " in our residential apartment",
        " behind the metro station", " near the main market", " outside our office"
    ]

    for item in EMERGENCY_TRIAGE_SAMPLES:
        augmented.append(item)
        for mod in modifiers:
            for loc in location_suffixes[:3]:
                text = f"{mod}{item['text']}{loc}".strip()
                new_item = dict(item)
                new_item["text"] = text
                augmented.append(new_item)

    return augmented
