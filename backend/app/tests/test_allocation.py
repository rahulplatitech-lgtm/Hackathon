"""Tests for OR-Tools resource allocation."""
from app.optimization.allocator import ResourceAllocator

def test_basic_allocation():
    allocator = ResourceAllocator()
    incidents = [
        {"id": "INC-A", "severity": 4, "urgency": "HIGH", "latitude": 12.97,
         "longitude": 77.59, "required_resources": ["AMBULANCE"], "status": "ACTIVE", "priority_score": 80},
    ]
    resources = [
        {"id": "A1", "name": "Ambulance A1", "type": "AMBULANCE", "latitude": 12.98,
         "longitude": 77.60, "status": "AVAILABLE"},
    ]
    result = allocator.allocate(incidents, resources)
    assert len(result["allocations"]) == 1
    assert result["allocations"][0]["incident_id"] == "INC-A"
    assert result["allocations"][0]["resource_id"] == "A1"

def test_unavailable_excluded():
    allocator = ResourceAllocator()
    incidents = [
        {"id": "INC-A", "severity": 4, "latitude": 12.97, "longitude": 77.59,
         "required_resources": ["AMBULANCE"], "status": "ACTIVE", "priority_score": 80},
    ]
    resources = [
        {"id": "A1", "type": "AMBULANCE", "name": "A1", "latitude": 12.98,
         "longitude": 77.60, "status": "UNAVAILABLE"},
        {"id": "A2", "type": "AMBULANCE", "name": "A2", "latitude": 12.96,
         "longitude": 77.58, "status": "AVAILABLE"},
    ]
    result = allocator.allocate(incidents, resources)
    assigned_ids = [a["resource_id"] for a in result["allocations"]]
    assert "A1" not in assigned_ids
    assert "A2" in assigned_ids

def test_type_compatibility():
    allocator = ResourceAllocator()
    incidents = [
        {"id": "INC-A", "severity": 4, "latitude": 12.97, "longitude": 77.59,
         "required_resources": ["AMBULANCE"], "status": "ACTIVE", "priority_score": 80},
    ]
    resources = [
        {"id": "R1", "type": "RESCUE_TEAM", "name": "R1", "latitude": 12.98,
         "longitude": 77.60, "status": "AVAILABLE"},
    ]
    result = allocator.allocate(incidents, resources)
    assert len(result["allocations"]) == 0  # No compatible resource
    assert len(result["unmet"]) == 1
