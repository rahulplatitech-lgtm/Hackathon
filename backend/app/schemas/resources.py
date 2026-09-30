from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ResourceStatusUpdate(BaseModel):
    status: str  # AVAILABLE, ASSIGNED, EN_ROUTE, ON_SCENE, UNAVAILABLE

class ResourceResponse(BaseModel):
    id: str
    name: str
    type: str
    latitude: float
    longitude: float
    capacity: int
    capabilities: List[str] = []
    status: str
    current_incident_id: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True
