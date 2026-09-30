"""Haversine-based fallback routing for hackathon reliability."""
import math
from .base import RouteProvider, RouteResult

class HaversineRouter(RouteProvider):
    AVERAGE_SPEED_KMH = 40.0  # city driving speed

    async def calculate_route(self, from_lat: float, from_lng: float,
                              to_lat: float, to_lng: float) -> RouteResult:
        distance = self._haversine(from_lat, from_lng, to_lat, to_lng)
        eta = (distance / self.AVERAGE_SPEED_KMH) * 60  # minutes
        eta = max(eta, 1.0)  # minimum 1 minute
        return RouteResult(
            distance_km=round(distance, 2),
            eta_minutes=round(eta, 1),
            route_status="OK",
            route_geometry=[[from_lat, from_lng], [to_lat, to_lng]],
        )

    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

router_provider = HaversineRouter()
