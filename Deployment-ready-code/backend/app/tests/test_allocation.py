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

def test_distant_incident_and_decision_rationale():
    allocator = ResourceAllocator()
    incidents = [
        {"id": "INC-FAR", "severity": 3, "type": "Gas Leak", "latitude": 13.0064,
         "longitude": 77.4892, "required_resources": ["RESCUE_TEAM"], "status": "ACTIVE", "priority_score": 40},
    ]
    resources = [
        {"id": "R1", "type": "RESCUE_TEAM", "name": "Rescue Team Bravo-1", "latitude": 12.9780, "longitude": 77.5950, "status": "AVAILABLE"},
        {"id": "R2", "type": "RESCUE_TEAM", "name": "Rescue Team Bravo-2", "latitude": 12.9700, "longitude": 77.6000, "status": "AVAILABLE"},
        {"id": "P1", "type": "POLICE_UNIT", "name": "Police Unit P1", "latitude": 12.9730, "longitude": 77.5920, "status": "AVAILABLE"},
    ]
    result = allocator.allocate(incidents, resources)
    assert len(result["allocations"]) == 1
    alloc = result["allocations"][0]
    assert alloc["incident_id"] == "INC-FAR"
    assert alloc["resource_id"] == "R1"  # Closest rescue team
    assert "decision_rationale" in alloc
    assert "why_chosen" in alloc["decision_rationale"]
    assert len(alloc["decision_rationale"]["why_others_not_chosen"]) == 2
    # Verify why P1 wasn't chosen (capability mismatch)
    p1_alt = next(a for a in alloc["decision_rationale"]["why_others_not_chosen"] if a["resource_id"] == "P1")
    assert p1_alt["status_tag"] == "CAPABILITY_MISMATCH"

