"""Incident API endpoints."""
from fastapi import APIRouter, HTTPException
from typing import List
from app.db.database import async_session
from app.models.all_models import Incident, Allocation
from app.schemas.incidents import IncidentCreate, IncidentUpdate, IncidentResponse, AllocationResponse
from app.services.websocket_manager import ws_manager
from sqlalchemy import select
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("", response_model=List[IncidentResponse])
async def list_incidents():
    async with async_session() as session:
        result = await session.execute(select(Incident))
        incidents = result.scalars().all()
        response = []
        for inc in incidents:
            alloc_result = await session.execute(
                select(Allocation).where(Allocation.incident_id == inc.id)
            )
            allocs = alloc_result.scalars().all()
            inc_dict = IncidentResponse(
                id=inc.id, report_id=inc.report_id, type=inc.type,
                severity=inc.severity, urgency=inc.urgency,
                people_affected=inc.people_affected,
                latitude=inc.latitude, longitude=inc.longitude,
                location_text=inc.location_text,
                required_resources=inc.required_resources or [],
                priority_score=inc.priority_score or 0,
                status=inc.status,
                assigned_resources=[AllocationResponse.model_validate(a) for a in allocs],
                created_at=inc.created_at, updated_at=inc.updated_at,
            )
            response.append(inc_dict)
        return response

@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(incident_id: str):
    async with async_session() as session:
        result = await session.execute(select(Incident).where(Incident.id == incident_id))
        inc = result.scalar_one_or_none()
        if not inc:
            raise HTTPException(status_code=404, detail="Incident not found")
        alloc_result = await session.execute(
            select(Allocation).where(Allocation.incident_id == inc.id)
        )
        allocs = alloc_result.scalars().all()
        return IncidentResponse(
            id=inc.id, report_id=inc.report_id, type=inc.type,
            severity=inc.severity, urgency=inc.urgency,
            people_affected=inc.people_affected,
            latitude=inc.latitude, longitude=inc.longitude,
            location_text=inc.location_text,
            required_resources=inc.required_resources or [],
            priority_score=inc.priority_score or 0,
            status=inc.status,
            assigned_resources=[AllocationResponse.model_validate(a) for a in allocs],
            created_at=inc.created_at, updated_at=inc.updated_at,
        )

@router.post("", response_model=IncidentResponse)
async def create_incident(req: IncidentCreate):
    from app.models.all_models import gen_id
    inc = Incident(
        id=f"INC-{gen_id()[:4].upper()}", type=req.type, severity=req.severity,
        urgency=req.urgency, people_affected=req.people_affected,
        latitude=req.latitude, longitude=req.longitude,
        location_text=req.location_text, required_resources=req.required_resources,
    )
    async with async_session() as session:
        session.add(inc)
        await session.commit()
        await session.refresh(inc)
    await ws_manager.broadcast("incident.created", {"id": inc.id, "type": inc.type, "severity": inc.severity})
    return IncidentResponse(
        id=inc.id, type=inc.type, severity=inc.severity, urgency=inc.urgency,
        people_affected=inc.people_affected, latitude=inc.latitude, longitude=inc.longitude,
        location_text=inc.location_text, required_resources=inc.required_resources or [],
        priority_score=0, status=inc.status,
        assigned_resources=[], created_at=inc.created_at, updated_at=inc.updated_at,
    )

@router.patch("/{incident_id}", response_model=IncidentResponse)
async def update_incident(incident_id: str, req: IncidentUpdate):
    async with async_session() as session:
        result = await session.execute(select(Incident).where(Incident.id == incident_id))
        inc = result.scalar_one_or_none()
        if not inc:
            raise HTTPException(status_code=404, detail="Incident not found")
        if req.severity is not None:
            inc.severity = req.severity
        if req.urgency is not None:
            inc.urgency = req.urgency
        if req.people_affected is not None:
            inc.people_affected = req.people_affected
        if req.status is not None:
            inc.status = req.status
        await session.commit()
        await session.refresh(inc)
    await ws_manager.broadcast("incident.updated", {"id": inc.id, "severity": inc.severity})
    return IncidentResponse(
        id=inc.id, report_id=inc.report_id, type=inc.type,
        severity=inc.severity, urgency=inc.urgency,
        people_affected=inc.people_affected,
        latitude=inc.latitude, longitude=inc.longitude,
        location_text=inc.location_text, required_resources=inc.required_resources or [],
        priority_score=inc.priority_score or 0, status=inc.status,
        assigned_resources=[], created_at=inc.created_at, updated_at=inc.updated_at,
    )
