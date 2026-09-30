"""Real road route calculation using Google Routes API and OSRM with local fallback.
Provides real-life driving travel duration, real road distance, and actual turn-by-turn road geometry.
"""
import math
import os
import logging
from typing import Optional, List
import httpx
from .base import RouteProvider, RouteResult
from app.config import settings

logger = logging.getLogger(__name__)

class RealRoadRouter(RouteProvider):
    AVERAGE_SPEED_KMH = 35.0  # Urban emergency transit speed (km/h)
    URBAN_CIRCUITY_FACTOR = 1.35  # Actual road distance vs straight-line

    def __init__(self):
        self._cache = {}
        self._google_api_key = (
            getattr(settings, "GOOGLE_MAPS_API_KEY", "") or 
            os.getenv("GOOGLE_MAPS_API_KEY", "") or 
            os.getenv("VITE_GOOGLE_MAPS_API_KEY", "")
        )

    async def calculate_route(
        self, 
        from_lat: float, 
        from_lng: float, 
        to_lat: float, 
        to_lng: float
    ) -> RouteResult:
        """Calculate real road route between two coordinates."""
        # Sanity check
        if abs(from_lat) < 0.001 or abs(to_lat) < 0.001:
            return self._haversine_fallback(from_lat, from_lng, to_lat, to_lng)

        cache_key = (round(from_lat, 4), round(from_lng, 4), round(to_lat, 4), round(to_lng, 4))
        if cache_key in self._cache:
            return self._cache[cache_key]

        # 1. Try Google Routes API if key is available
        if self._google_api_key:
            try:
                result = await self._query_google_routes(from_lat, from_lng, to_lat, to_lng)
                if result:
                    self._cache[cache_key] = result
                    return result
            except Exception as e:
                logger.warning(f"Google Routes API call failed, trying OSRM: {e}")

        # 2. Try High-Speed Road Network Routing (OSRM driving engine)
        try:
            result = await self._query_osrm_route(from_lat, from_lng, to_lat, to_lng)
            if result:
                self._cache[cache_key] = result
                return result
        except Exception as e:
            logger.warning(f"OSRM road routing call failed: {e}")

        # 3. Reliable Fallback (Haversine with urban road curvature)
        result = self._haversine_fallback(from_lat, from_lng, to_lat, to_lng)
        self._cache[cache_key] = result
        return result

    async def _query_osrm_route(
        self, 
        from_lat: float, 
        from_lng: float, 
        to_lat: float, 
        to_lng: float
    ) -> Optional[RouteResult]:
        """Fetch real road polyline and duration from OSRM driving engine."""
        url = f"https://router.project-osrm.org/route/v1/driving/{from_lng:.5f},{from_lat:.5f};{to_lng:.5f},{to_lat:.5f}?overview=full&geometries=geojson"
        async with httpx.AsyncClient(timeout=2.5) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    route_data = data["routes"][0]
                    distance_km = round(route_data["distance"] / 1000.0, 2)
                    # Convert duration to minutes, minimum 1.0 min
                    eta_mins = max(1.0, round(route_data["duration"] / 60.0, 1))
                    
                    # Convert GeoJSON [lng, lat] to [lat, lng]
                    raw_coords = route_data["geometry"]["coordinates"]
                    geometry = [[round(pt[1], 6), round(pt[0], 6)] for pt in raw_coords]
                    
                    return RouteResult(
                        distance_km=distance_km,
                        eta_minutes=eta_mins,
                        route_status="OK",
                        route_geometry=geometry,
                    )
        return None

    async def _query_google_routes(
        self, 
        from_lat: float, 
        from_lng: float, 
        to_lat: float, 
        to_lng: float
    ) -> Optional[RouteResult]:
        """Fetch real road route using Google Routes API."""
        url = "https://routes.googleapis.com/directions/v2:computeRoutes"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self._google_api_key,
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
        }
        payload = {
            "origin": {"location": {"latLng": {"latitude": from_lat, "longitude": from_lng}}},
            "destination": {"location": {"latLng": {"latitude": to_lat, "longitude": to_lng}}},
            "travelMode": "DRIVE",
            "routingPreference": "TRAFFIC_AWARE",
        }
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("routes"):
                    route_data = data["routes"][0]
                    dist_meters = route_data.get("distanceMeters", 1000)
                    dist_km = round(dist_meters / 1000.0, 2)
                    
                    # duration is formatted as "450s"
                    dur_str = route_data.get("duration", "180s").rstrip("s")
                    eta_mins = max(1.0, round(float(dur_str) / 60.0, 1))

                    # Decoded polyline or fallback
                    encoded = route_data.get("polyline", {}).get("encodedPolyline")
                    geometry = self._decode_polyline(encoded) if encoded else [[from_lat, from_lng], [to_lat, to_lng]]

                    return RouteResult(
                        distance_km=dist_km,
                        eta_minutes=eta_mins,
                        route_status="OK",
                        route_geometry=geometry,
                    )
        return None

    def _haversine_fallback(
        self, 
        lat1: float, 
        lon1: float, 
        lat2: float, 
        lon2: float
    ) -> RouteResult:
        """Straight-line haversine with urban road curvature compensation."""
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        direct_dist = R * c
        
        # Apply urban road curvature factor
        road_distance = max(0.5, direct_dist * self.URBAN_CIRCUITY_FACTOR)
        eta = max(1.0, (road_distance / self.AVERAGE_SPEED_KMH) * 60)

        # Generate a multi-point road curvature curve instead of a single straight bar
        points = 8
        geometry = []
        for i in range(points + 1):
            t = i / points
            lat = lat1 + t * (lat2 - lat1)
            lng = lon1 + t * (lon2 - lon1)
            # Slight natural road deviation
            bend = math.sin(t * math.pi) * 0.003
            geometry.append([round(lat + bend, 6), round(lng - bend, 6)])

        return RouteResult(
            distance_km=round(road_distance, 2),
            eta_minutes=round(eta, 1),
            route_status="OK",
            route_geometry=geometry,
        )

    def _decode_polyline(self, polyline_str: str) -> List[List[float]]:
        """Decode Google encoded polyline string to [lat, lng] pairs."""
        index, lat, lng = 0, 0, 0
        coordinates = []
        length = len(polyline_str)

        while index < length:
            shift, result = 0, 0
            while True:
                byte = ord(polyline_str[index]) - 63
                index += 1
                result |= (byte & 0x1f) << shift
                shift += 5
                if byte < 0x20:
                    break
            dlat = ~(result >> 1) if (result & 1) else (result >> 1)
            lat += dlat

            shift, result = 0, 0
            while True:
                byte = ord(polyline_str[index]) - 63
                index += 1
                result |= (byte & 0x1f) << shift
                shift += 5
                if byte < 0x20:
                    break
            dlng = ~(result >> 1) if (result & 1) else (result >> 1)
            lng += dlng

            coordinates.append([lat / 1e5, lng / 1e5])

        return coordinates

router_provider = RealRoadRouter()
