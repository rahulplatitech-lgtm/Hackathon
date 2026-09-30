"""Tests for dynamic replanning."""
import asyncio
from app.agents.dynamic_replanning import replanning_agent

def test_replan_diff():
    incidents = [
        {"id": "INC-A", "type": "Accident", "severity": 4, "urgency": "HIGH",
         "people_affected": 3, "latitude": 12.97, "longitude": 77.59,
         "required_resources": ["AMBULANCE"], "status": "ACTIVE", "priority_score": 0},
        {"id": "INC-C", "type": "Medical", "severity": 5, "urgency": "CRITICAL",
         "people_affected": 1, "latitude": 12.96, "longitude": 77.58,
         "required_resources": ["AMBULANCE", "MEDICAL_UNIT"], "status": "ACTIVE", "priority_score": 0},
    ]
    resources = [
        {"id": "A1", "name": "Ambulance A1", "type": "AMBULANCE", "latitude": 12.975,
         "longitude": 77.59, "status": "AVAILABLE"},
        {"id": "A2", "name": "Ambulance A2", "type": "AMBULANCE", "latitude": 12.965,
         "longitude": 77.58, "status": "UNAVAILABLE"},
        {"id": "M1", "name": "Medical M1", "type": "MEDICAL_UNIT", "latitude": 12.968,
         "longitude": 77.588, "status": "AVAILABLE"},
    ]
    old_plan = {
        "id": "old-plan",
        "version": 1,
        "allocations": [
            {"resource_id": "A1", "incident_id": "INC-A"},
            {"resource_id": "A2", "incident_id": "INC-C"},
        ],
    }

    result = asyncio.get_event_loop().run_until_complete(
        replanning_agent.replan(incidents, resources, old_plan, "A2_unavailable")
    )

    new_plan = result["new_plan"]
    changes = result["plan_change"]["changes"]

    # A2 should be marked unavailable
    a2_change = [c for c in changes if c["resource_id"] == "A2"]
    assert len(a2_change) == 1
    assert a2_change[0]["change_type"] == "UNAVAILABLE"

    # A1 should be allocated to highest priority
    a1_allocs = [a for a in new_plan["allocations"] if a["resource_id"] == "A1"]
    assert len(a1_allocs) == 1
