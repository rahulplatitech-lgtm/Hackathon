"""Agent 7 - Route/Logistics Agent.
Calculates route, distance, ETA for allocations."""
from typing import List, Dict, Any
from app.routing.fallback import router_provider

class RouteLogisticsAgent:
    async def calculate_routes(self, allocations: List[Dict], resources: Dict[str, Dict],
                               incidents: Dict[str, Dict]) -> List[Dict[str, Any]]:
        """Calculate routes for all allocations."""
        enriched = []
        for alloc in allocations:
            res = resources.get(alloc["resource_id"], {})
            inc = incidents.get(alloc["incident_id"], {})
            if res and inc:
                route = await router_provider.calculate_route(
                    res.get("latitude", 0), res.get("longitude", 0),
                    inc.get("latitude", 0), inc.get("longitude", 0),
                )
                alloc["distance_km"] = route.distance_km
                alloc["eta_minutes"] = route.eta_minutes
                alloc["route_status"] = route.route_status
                alloc["route_geometry"] = route.route_geometry
            enriched.append(alloc)
        return enriched

route_agent = RouteLogisticsAgent()
