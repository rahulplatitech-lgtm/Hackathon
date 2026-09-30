"""Tests for the 100m radius passerby emergency alert and outlets API."""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_nearby_passerby_detection():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/passerby/nearby?lat=12.9716&lng=77.5946&radius=100")
        assert res.status_code == 200
        citizens = res.json()
        assert len(citizens) > 0
        inside_100m = [c for c in citizens if c["is_within_100m"]]
        assert len(inside_100m) > 0
        assert all(c["distance_meters"] <= 100 for c in inside_100m)

@pytest.mark.asyncio
async def test_passerby_100m_broadcast():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "incident_id": "INC-TEST-100",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "radius_meters": 100.0,
            "emergency_type": "Structure Fire",
            "severity": 4
        }
        res = await client.post("/api/passerby/broadcast", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["incident_id"] == "INC-TEST-100"
        assert data["radius_meters"] == 100.0
        assert data["total_citizens_detected"] > 0
        assert "100" in data["alert_title"] or "URGENT" in data["alert_title"]
        assert len(data["recipients"]) > 0

@pytest.mark.asyncio
async def test_emergency_outlets():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/passerby/outlets")
        assert res.status_code == 200
        outlets = res.json()
        assert len(outlets) >= 5
        types = {o["type"] for o in outlets}
        assert "HOSPITAL" in types
        assert "AMBULANCE" in types
        assert "AED" in types
