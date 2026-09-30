"""Tests for real road routing calculation."""
import pytest
from app.routing.fallback import router_provider

@pytest.mark.asyncio
async def test_real_road_routing():
    res = await router_provider.calculate_route(
        from_lat=12.9716,
        from_lng=77.5946,
        to_lat=12.9400,
        to_lng=77.5700,
    )
    assert res.distance_km > 0
    assert res.eta_minutes > 0
    assert res.route_status == "OK"
    assert res.route_geometry is not None
    assert len(res.route_geometry) >= 2
    # Ensure points have valid lat/lng pairs
    first_pt = res.route_geometry[0]
    assert len(first_pt) == 2
    assert 12.0 < first_pt[0] < 14.0
    assert 77.0 < first_pt[1] < 79.0
