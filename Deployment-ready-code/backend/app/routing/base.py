"""Abstract route provider."""
from abc import ABC, abstractmethod
from typing import Optional, Tuple
from pydantic import BaseModel

class RouteResult(BaseModel):
    distance_km: float
    eta_minutes: float
    route_status: str = "OK"
    route_geometry: Optional[list] = None

class RouteProvider(ABC):
    @abstractmethod
    async def calculate_route(self, from_lat: float, from_lng: float,
                              to_lat: float, to_lng: float) -> RouteResult:
        pass
