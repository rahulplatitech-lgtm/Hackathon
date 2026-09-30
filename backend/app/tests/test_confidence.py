"""Tests for confidence/distress agent."""
from app.agents.distress_confidence import confidence_agent

def test_high_confidence():
    intake = {
        "reporter_latitude": 12.97,
        "reporter_longitude": 77.59,
        "missing_information": [],
        "analysis": {"incident_type": "Road Accident", "confidence": 0.9},
    }
    result = confidence_agent.calculate_confidence(intake)
    assert result["confidence"] >= 0.7
    assert not result["requires_human_review"]

def test_low_confidence_missing_fields():
    intake = {
        "reporter_latitude": None,
        "reporter_longitude": None,
        "missing_information": ["exact_location", "victim_count"],
        "analysis": {"incident_type": None, "confidence": 0.3},
    }
    result = confidence_agent.calculate_confidence(intake)
    assert result["confidence"] < 0.7
    assert result["requires_human_review"]
