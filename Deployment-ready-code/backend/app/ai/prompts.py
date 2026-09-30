"""Prompt templates for AI interactions."""

EMERGENCY_ANALYSIS_PROMPT = """Analyze this emergency report and extract structured information.
Return ONLY valid JSON with these fields:
- incident_type: string
- severity: integer 1-5
- urgency: LOW|MEDIUM|HIGH|CRITICAL
- people_affected: integer
- required_resources: list of AMBULANCE|MEDICAL_UNIT|RESCUE_TEAM|POLICE_UNIT|SHELTER
- extracted_location: string
- confidence: float 0-1
- missing_info: list of strings

Report: {text}
"""

REALLOCATION_EXPLANATION_PROMPT = """Explain this emergency resource reallocation:
Old allocations: {old_allocations}
New allocations: {new_allocations}
Trigger: {trigger}
Be concise and professional. Explain what changed and why."""
