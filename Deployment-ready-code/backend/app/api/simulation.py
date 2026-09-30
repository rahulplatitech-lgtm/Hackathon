"""Simulation control API for hackathon demos."""
from fastapi import APIRouter
from app.db.database import async_session
from app.db.seed_data import seed_database, SEED_INCIDENTS, SEED_RESOURCES, DEMO_INCIDENT_D
from app.models.all_models import Incident, Resource, Allocation, ResponsePlan, PlanChange, gen_id
from app.services.websocket_manager import ws_manager
from app.schemas.simulation import SimNewIncident, SimResourceUnavailable, SimChangeSeverity
from sqlalchemy import select, delete

router = APIRouter()

from pydantic import BaseModel
from typing import Optional

class SeedRequest(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None

@router.post("/seed")
async def seed(req: SeedRequest = SeedRequest()):
    """Seed database with demo scenario data."""
    await seed_database(req.lat, req.lng)
    return {"status": "seeded", "incidents": len(SEED_INCIDENTS), "resources": len(SEED_RESOURCES)}

@router.post("/new-incident")
async def new_incident(req: SimNewIncident = SimNewIncident()):
    """Add a new critical incident for demo."""
    inc = Incident(
        id=f"INC-{gen_id()[:4].upper()}", type=req.type, severity=req.severity,
        urgency=req.urgency, people_affected=req.people_affected,
        latitude=req.latitude, longitude=req.longitude,
        location_text=req.location_text,
        required_resources=["AMBULANCE", "RESCUE_TEAM", "MEDICAL_UNIT", "POLICE_UNIT"],
    )
    async with async_session() as session:
        session.add(inc)
        await session.commit()
        await session.refresh(inc)

    await ws_manager.broadcast("incident.created", {
        "id": inc.id, "type": inc.type, "severity": inc.severity,
    })
    return {"status": "created", "incident_id": inc.id, "type": inc.type, "severity": inc.severity}

@router.post("/resource-unavailable")
async def resource_unavailable(req: SimResourceUnavailable = SimResourceUnavailable()):
    """Make a resource unavailable for demo."""
    async with async_session() as session:
        result = await session.execute(select(Resource).where(Resource.id == req.resource_id))
        resource = result.scalar_one_or_none()
        if not resource:
            return {"status": "error", "message": f"Resource {req.resource_id} not found"}
        resource.status = "UNAVAILABLE"
        resource.current_incident_id = None
        await session.commit()

    await ws_manager.broadcast("resource.updated", {"id": req.resource_id, "status": "UNAVAILABLE"})
    return {"status": "unavailable", "resource_id": req.resource_id}

@router.post("/change-severity")
async def change_severity(req: SimChangeSeverity):
    """Change incident severity for demo."""
    urgency_map = {5: "CRITICAL", 4: "HIGH", 3: "MEDIUM", 2: "LOW", 1: "LOW"}
    async with async_session() as session:
        result = await session.execute(select(Incident).where(Incident.id == req.incident_id))
        inc = result.scalar_one_or_none()
        if not inc:
            return {"status": "error", "message": "Incident not found"}
        inc.severity = req.new_severity
        inc.urgency = urgency_map.get(req.new_severity, "MEDIUM")
        await session.commit()

    await ws_manager.broadcast("incident.updated", {
        "id": req.incident_id, "severity": req.new_severity,
    })
    return {"status": "updated", "incident_id": req.incident_id, "new_severity": req.new_severity}

@router.post("/reset")
async def reset_simulation():
    """Reset everything and reseed."""
    async with async_session() as session:
        from sqlalchemy import text
        for table in ["allocations", "plan_changes", "response_plans", "human_reviews",
                      "system_events", "incident_reports", "incidents", "resources"]:
            try:
                await session.execute(text(f"DELETE FROM {table}"))
            except Exception:
                pass
        await session.commit()
    await seed_database()
    await ws_manager.broadcast("simulation.reset", {})
    return {"status": "reset", "message": "Database reset and reseeded"}
