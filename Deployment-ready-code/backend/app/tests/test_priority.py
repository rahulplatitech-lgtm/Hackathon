"""Tests for priority/triage agent."""
from app.agents.priority_triage import triage_agent

def test_priority_ranking():
    incidents = [
        {"id": "A", "severity": 3, "urgency": "MEDIUM", "people_affected": 2,
         "required_resources": ["AMBULANCE"], "status": "ACTIVE"},
        {"id": "B", "severity": 5, "urgency": "CRITICAL", "people_affected": 10,
         "required_resources": ["AMBULANCE", "MEDICAL_UNIT"], "status": "ACTIVE"},
        {"id": "C", "severity": 4, "urgency": "HIGH", "people_affected": 1,
         "required_resources": ["AMBULANCE"], "status": "ACTIVE"},
    ]
    result = triage_agent.calculate_priorities(incidents)
    assert len(result) == 3
    assert result[0]["incident_id"] == "B"  # Highest priority
    assert result[0]["priority_rank"] == 1
    assert result[0]["priority_score"] > result[1]["priority_score"]

def test_priority_filters_inactive():
    incidents = [
        {"id": "A", "severity": 5, "status": "RESOLVED"},
        {"id": "B", "severity": 3, "status": "ACTIVE"},
    ]
    result = triage_agent.calculate_priorities(incidents)
    assert len(result) == 1
    assert result[0]["incident_id"] == "B"
