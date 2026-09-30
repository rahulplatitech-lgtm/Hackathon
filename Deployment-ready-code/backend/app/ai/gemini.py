"""Gemini AI provider (optional, falls back to demo)."""
import json
from typing import Dict, Any, Optional
from .base import AIProvider
from .demo import demo_ai
from app.config import settings

class GeminiProvider(AIProvider):
    def __init__(self):
        self._client = None
        if settings.GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self._client = genai.GenerativeModel("gemini-1.5-flash")
            except Exception:
                pass

    async def analyze_emergency(self, text: str, location: Optional[str] = None) -> Dict[str, Any]:
        if not self._client:
            return await demo_ai.analyze_emergency(text, location)
        try:
            prompt = f"""Analyze this emergency report and return ONLY valid JSON:
{{
  "incident_type": "type of emergency",
  "severity": 1-5 integer,
  "urgency": "LOW|MEDIUM|HIGH|CRITICAL",
  "people_affected": integer,
  "required_resources": ["AMBULANCE","MEDICAL_UNIT","RESCUE_TEAM","POLICE_UNIT","SHELTER"],
  "extracted_location": "location description",
  "confidence": 0.0-1.0,
  "missing_info": ["list of missing critical info"]
}}

Report: {text}
Location context: {location or 'Not provided'}"""
            response = self._client.generate_content(prompt)
            text_resp = response.text.strip()
            if text_resp.startswith("```"):
                text_resp = text_resp.split("\n", 1)[1].rsplit("```", 1)[0]
            return json.loads(text_resp)
        except Exception:
            return await demo_ai.analyze_emergency(text, location)

    async def generate_explanation(self, context: Dict[str, Any]) -> str:
        if not self._client:
            return await demo_ai.generate_explanation(context)
        try:
            prompt = f"""Explain this emergency resource reallocation briefly and clearly:
{json.dumps(context, indent=2)}
Be concise, professional. Explain what changed, why, and the impact."""
            response = self._client.generate_content(prompt)
            return response.text.strip()
        except Exception:
            return await demo_ai.generate_explanation(context)

def get_ai_provider() -> AIProvider:
    if settings.GEMINI_API_KEY:
        return GeminiProvider()
    return demo_ai
