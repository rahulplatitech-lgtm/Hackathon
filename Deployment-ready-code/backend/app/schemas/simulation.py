from pydantic import BaseModel, Field
from typing import Optional

class SimNewIncident(BaseModel):
    type: str = "Gas Leak Explosion"
    severity: int = Field(default=5, ge=1, le=5)
    urgency: str = "CRITICAL"
    people_affected: int = 8
    latitude: float = 12.9550
    longitude: float = 77.5750
    location_text: str = "Basavanagudi, Bangalore"

class SimResourceUnavailable(BaseModel):
    resource_id: str = "A2"

class SimChangeSeverity(BaseModel):
    incident_id: str
    new_severity: int = Field(..., ge=1, le=5)

class SimBlockRoute(BaseModel):
    from_lat: float
    from_lng: float
    to_lat: float
    to_lng: float
