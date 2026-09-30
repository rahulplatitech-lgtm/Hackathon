"""All SQLAlchemy database models for Crisis Command AI."""
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from .base import Base

def gen_id() -> str:
    return str(uuid.uuid4())[:8]

class IncidentReport(Base):
    __tablename__ = "incident_reports"
    id = Column(String, primary_key=True, default=gen_id)
    input_type = Column(String, nullable=False)  # text or voice
    raw_text = Column(Text, default="")
    transcript = Column(Text, nullable=True)
    audio_path = Column(String, nullable=True)
    reporter_lat = Column(Float, nullable=True)
    reporter_lng = Column(Float, nullable=True)
    ai_confidence = Column(Float, default=0.0)
    voice_distress_signal = Column(String, nullable=True)
    human_review_required = Column(Boolean, default=False)
    preliminary_type = Column(String, nullable=True)
    extracted_location = Column(String, nullable=True)
    missing_info = Column(JSON, nullable=True)
    status = Column(String, default="pending")  # pending, reviewing, confirmed, rejected
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Incident(Base):
    __tablename__ = "incidents"
    id = Column(String, primary_key=True, default=gen_id)
    report_id = Column(String, ForeignKey("incident_reports.id"), nullable=True)
    type = Column(String, nullable=False)
    severity = Column(Integer, nullable=False)  # 1-5
    urgency = Column(String, nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    people_affected = Column(Integer, default=1)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_text = Column(String, default="")
    required_resources = Column(JSON, default=list)
    special_constraints = Column(JSON, default=list)
    priority_score = Column(Float, default=0.0)
    status = Column(String, default="ACTIVE")  # ACTIVE, RESOLVED, REJECTED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class Resource(Base):
    __tablename__ = "resources"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # AMBULANCE, MEDICAL_UNIT, RESCUE_TEAM, POLICE_UNIT, SHELTER
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    capacity = Column(Integer, default=1)
    capabilities = Column(JSON, default=list)
    status = Column(String, default="AVAILABLE")  # AVAILABLE, ASSIGNED, EN_ROUTE, ON_SCENE, UNAVAILABLE
    current_incident_id = Column(String, ForeignKey("incidents.id"), nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class Allocation(Base):
    __tablename__ = "allocations"
    id = Column(String, primary_key=True, default=gen_id)
    incident_id = Column(String, ForeignKey("incidents.id"), nullable=False)
    resource_id = Column(String, ForeignKey("resources.id"), nullable=False)
    eta_minutes = Column(Float, nullable=True)
    distance_km = Column(Float, nullable=True)
    status = Column(String, default="ASSIGNED")
    plan_id = Column(String, ForeignKey("response_plans.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class HumanReview(Base):
    __tablename__ = "human_reviews"
    id = Column(String, primary_key=True, default=gen_id)
    report_id = Column(String, ForeignKey("incident_reports.id"), nullable=False)
    operator_action = Column(String, nullable=True)  # CONFIRM, MODIFY, REJECT, CALL
    corrected_data = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class ResponsePlan(Base):
    __tablename__ = "response_plans"
    id = Column(String, primary_key=True, default=gen_id)
    version = Column(Integer, default=1)
    status = Column(String, default="ACTIVE")  # DRAFT, ACTIVE, SUPERSEDED
    allocations_data = Column(JSON, default=list)
    unmet_requirements = Column(JSON, default=list)
    warnings = Column(JSON, default=list)
    approval_required = Column(Boolean, default=False)
    explanation = Column(Text, default="")
    objective_score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class PlanChange(Base):
    __tablename__ = "plan_changes"
    id = Column(String, primary_key=True, default=gen_id)
    old_plan_id = Column(String, ForeignKey("response_plans.id"), nullable=True)
    new_plan_id = Column(String, ForeignKey("response_plans.id"), nullable=False)
    trigger_event = Column(String, default="")
    changes = Column(JSON, default=list)
    explanation = Column(Text, default="")
    approval_required = Column(Boolean, default=False)
    approved = Column(Boolean, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class SystemEvent(Base):
    __tablename__ = "system_events"
    id = Column(String, primary_key=True, default=gen_id)
    event_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=True)
    data = Column(JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
