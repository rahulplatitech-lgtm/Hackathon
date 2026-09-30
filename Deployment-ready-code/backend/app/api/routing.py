"""API endpoints for real-life road routing and ETA calculations."""
from fastapi import APIRouter, Query
from app.routing.base import RouteResult
from app.routing.fallback import router_provider

router = APIRouter()

@router.get("/route", response_model=RouteResult)
async def get_route(
    from_lat: float = Query(..., description="Origin latitude"),
    from_lng: float = Query(..., description="Origin longitude"),
    to_lat: float = Query(..., description="Destination latitude"),
    to_lng: float = Query(..., description="Destination longitude"),
):
    """
    Calculate real road driving route, driving distance, ETA, and road polyline geometry.
    Uses Google Routes API or high-speed road network engine.
    """
    return await router_provider.calculate_route(
        from_lat=from_lat,
        from_lng=from_lng,
        to_lat=to_lat,
        to_lng=to_lng,
    )
