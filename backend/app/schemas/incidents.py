from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class IncidentCreate(BaseModel):
    type: str
    severity: int = Field(..., ge=1, le=5)
    urgency: str = Field(..., pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    people_affected: int = Field(default=1, ge=0)
    latitude: float
    longitude: float
    location_text: str = ""
    required_resources: List[str] = []

class IncidentUpdate(BaseModel):
    severity: Optional[int] = Field(None, ge=1, le=5)
    urgency: Optional[str] = None
    people_affected: Optional[int] = None
    status: Optional[str] = None

class AllocationResponse(BaseModel):
    id: str
    incident_id: str
    resource_id: str
    resource_name: Optional[str] = None
    resource_type: Optional[str] = None
    eta_minutes: Optional[float] = None
    distance_km: Optional[float] = None
    status: str
    plan_id: Optional[str] = None

    class Config:
        from_attributes = True

class IncidentResponse(BaseModel):
    id: str
    report_id: Optional[str] = None
    type: str
    severity: int
    urgency: str
    people_affected: int
    latitude: float
    longitude: float
    location_text: str
    required_resources: List[str] = []
    priority_score: float
    status: str
    assigned_resources: List[AllocationResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
