from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class TextReportRequest(BaseModel):
    text: str = Field(..., min_length=5, description="Emergency description")
    reporter_lat: Optional[float] = None
    reporter_lng: Optional[float] = None

class ClarifyRequest(BaseModel):
    answer: str

class ReportResponse(BaseModel):
    id: str
    input_type: str
    raw_text: str
    transcript: Optional[str] = None
    audio_path: Optional[str] = None
    reporter_lat: Optional[float] = None
    reporter_lng: Optional[float] = None
    ai_confidence: float
    voice_distress_signal: Optional[str] = None
    human_review_required: bool
    preliminary_type: Optional[str] = None
    extracted_location: Optional[str] = None
    missing_info: Optional[List[str]] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class IntakeResult(BaseModel):
    report_id: str
    raw_text: str
    transcript: Optional[str] = None
    audio_url: Optional[str] = None
    reporter_latitude: Optional[float] = None
    reporter_longitude: Optional[float] = None
    extracted_location: Optional[str] = None
    preliminary_incident_type: Optional[str] = None
    missing_information: List[str] = []
    timestamp: datetime

class VoiceChatMessage(BaseModel):
    role: str
    content: str

class VoiceChatRequest(BaseModel):
    messages: List[VoiceChatMessage]
    reporter_lat: Optional[float] = None
    reporter_lng: Optional[float] = None
    dispatch_now: bool = False

class VoiceChatResponse(BaseModel):
    reply: str
    incident_type: str
    severity: int
    urgency: str
    people_affected: int
    required_resources: List[str]
    ready_to_dispatch: bool
    dispatched: bool = False
    report_id: Optional[str] = None
    incident_id: Optional[str] = None
    extracted_location: Optional[str] = None
