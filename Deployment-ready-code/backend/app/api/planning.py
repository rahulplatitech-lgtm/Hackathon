"""Planning API endpoints."""
from fastapi import APIRouter, HTTPException
from app.db.database import async_session
from app.models.all_models import Incident, Resource, ResponsePlan, PlanChange, Allocation, gen_id
from app.services.pipeline import pipeline
from app.agents.dynamic_replanning import replanning_agent
from app.services.websocket_manager import ws_manager
from app.schemas.planning import ResponsePlanResponse, PlanChangeResponse, PlanApprovalRequest
from sqlalchemy import select
from typing import List, Optional

router = APIRouter()

async def _get_all_incidents():
    async with async_session() as session:
        result = await session.execute(select(Incident).where(Incident.status == "ACTIVE"))
        return [{"id": i.id, "type": i.type, "severity": i.severity, "urgency": i.urgency,
                 "people_affected": i.people_affected, "latitude": i.latitude,
                 "longitude": i.longitude, "location_text": i.location_text,
                 "required_resources": i.required_resources or [],
                 "priority_score": i.priority_score or 0, "status": i.status,
                 "created_at": i.created_at.isoformat() if i.created_at else None}
                for i in result.scalars().all()]

async def _get_all_resources():
    async with async_session() as session:
        result = await session.execute(select(Resource))
        return [{"id": r.id, "name": r.name, "type": r.type, "latitude": r.latitude,
                 "longitude": r.longitude, "capacity": r.capacity,
                 "capabilities": r.capabilities or [], "status": r.status,
                 "current_incident_id": r.current_incident_id}
                for r in result.scalars().all()]

@router.post("/generate")
async def generate_plan():
    """Generate a new response plan from current state."""
    incidents = await _get_all_incidents()
    resources = await _get_all_resources()

    if not incidents:
        return {"message": "No active incidents", "plan": None}

    result = await pipeline.generate_full_plan(incidents, resources)
    plan_data = result["plan"]

    # Save plan to DB
    async with async_session() as session:
        plan = ResponsePlan(
            id=plan_data["id"],
            version=plan_data["version"],
            status="ACTIVE",
            allocations_data=plan_data["allocations"],
            unmet_requirements=plan_data.get("unmet_requirements", []),
            warnings=plan_data.get("warnings", []),
            approval_required=plan_data.get("approval_required", False),
            explanation=plan_data.get("explanation", ""),
            objective_score=plan_data.get("objective_score", 0),
        )
        # Supersede old plans
        old_plans = await session.execute(select(ResponsePlan).where(ResponsePlan.status == "ACTIVE"))
        for old in old_plans.scalars().all():
            if old.id != plan.id:
                old.status = "SUPERSEDED"
        session.add(plan)

        # Clear old allocations
        old_allocs = await session.execute(select(Allocation))
        for a in old_allocs.scalars().all():
            await session.delete(a)

        # Reset all non-unavailable resources to AVAILABLE first
        all_res = await session.execute(select(Resource))
        for r in all_res.scalars().all():
            if r.status != "UNAVAILABLE":
                r.status = "AVAILABLE"
                r.current_incident_id = None

        # Save allocations
        for alloc_data in plan_data["allocations"]:
            alloc = Allocation(
                id=gen_id(), incident_id=alloc_data["incident_id"],
                resource_id=alloc_data["resource_id"],
                eta_minutes=alloc_data.get("eta_minutes"),
                distance_km=alloc_data.get("distance_km"),
                status="ASSIGNED", plan_id=plan.id,
            )
            session.add(alloc)

            # Update resource status
            res_result = await session.execute(select(Resource).where(Resource.id == alloc_data["resource_id"]))
            res = res_result.scalar_one_or_none()
            if res:
                res.status = "ASSIGNED"
                res.current_incident_id = alloc_data["incident_id"]

        # Update incident priority scores
        for p in result.get("priorities", []):
            inc_result = await session.execute(select(Incident).where(Incident.id == p["incident_id"]))
            inc = inc_result.scalar_one_or_none()
            if inc:
                inc.priority_score = p["priority_score"]

        await session.commit()

    await ws_manager.broadcast("plan.updated", {"plan_id": plan_data["id"]})
    return result

@router.post("/replan")
async def replan(trigger: str = "manual_replan"):
    """Trigger replanning based on current state."""
    incidents = await _get_all_incidents()
    resources = await _get_all_resources()

    # Get current plan
    async with async_session() as session:
        result = await session.execute(
            select(ResponsePlan).where(ResponsePlan.status == "ACTIVE").order_by(ResponsePlan.created_at.desc())
        )
        current_plan_row = result.scalar_one_or_none()

    old_plan = None
    if current_plan_row:
        old_plan = {
            "id": current_plan_row.id,
            "version": current_plan_row.version,
            "allocations": current_plan_row.allocations_data or [],
        }

    replan_result = await replanning_agent.replan(incidents, resources, old_plan, trigger)
    new_plan_data = replan_result["new_plan"]
    plan_change_data = replan_result["plan_change"]

    # Save to DB
    async with async_session() as session:
        # Supersede old plans
        old_plans = await session.execute(select(ResponsePlan).where(ResponsePlan.status == "ACTIVE"))
        for old in old_plans.scalars().all():
            old.status = "SUPERSEDED"

        # Clear old allocations
        old_allocs = await session.execute(select(Allocation))
        for a in old_allocs.scalars().all():
            await session.delete(a)

        # Reset resource statuses
        all_res = await session.execute(select(Resource))
        for r in all_res.scalars().all():
            if r.status != "UNAVAILABLE":
                r.status = "AVAILABLE"
                r.current_incident_id = None

        new_plan = ResponsePlan(
            id=new_plan_data["id"],
            version=new_plan_data["version"],
            status="ACTIVE",
            allocations_data=new_plan_data["allocations"],
            unmet_requirements=new_plan_data.get("unmet_requirements", []),
            warnings=new_plan_data.get("warnings", []),
            approval_required=new_plan_data.get("approval_required", False),
            explanation=new_plan_data.get("explanation", ""),
            objective_score=new_plan_data.get("objective_score", 0),
        )
        session.add(new_plan)

        change = PlanChange(
            id=plan_change_data["id"],
            old_plan_id=plan_change_data.get("old_plan_id"),
            new_plan_id=plan_change_data["new_plan_id"],
            trigger_event=plan_change_data["trigger_event"],
            changes=plan_change_data["changes"],
            explanation=plan_change_data["explanation"],
            approval_required=plan_change_data["approval_required"],
        )
        session.add(change)

        # Create new allocations
        for alloc_data in new_plan_data["allocations"]:
            alloc = Allocation(
                id=gen_id(), incident_id=alloc_data["incident_id"],
                resource_id=alloc_data["resource_id"],
                eta_minutes=alloc_data.get("eta_minutes"),
                distance_km=alloc_data.get("distance_km"),
                status="ASSIGNED", plan_id=new_plan.id,
            )
            session.add(alloc)

            res_result = await session.execute(select(Resource).where(Resource.id == alloc_data["resource_id"]))
            res = res_result.scalar_one_or_none()
            if res:
                res.status = "ASSIGNED"
                res.current_incident_id = alloc_data["incident_id"]

        for p in replan_result.get("priorities", []):
            inc_result = await session.execute(select(Incident).where(Incident.id == p["incident_id"]))
            inc = inc_result.scalar_one_or_none()
            if inc:
                inc.priority_score = p["priority_score"]

        await session.commit()

    await ws_manager.broadcast("plan.updated", {
        "plan_id": new_plan_data["id"],
        "change_id": plan_change_data["id"],
        "trigger": trigger,
    })

    return replan_result

@router.get("/current")
async def get_current_plan():
    """Get the current active response plan."""
    incidents = await _get_all_incidents()
    resources = await _get_all_resources()

    async with async_session() as session:
        result = await session.execute(
            select(ResponsePlan).where(ResponsePlan.status == "ACTIVE").order_by(ResponsePlan.created_at.desc())
        )
        plan = result.scalar_one_or_none()
        if not plan:
            return {"plan": None, "incidents": incidents, "resources": resources}

        # Get latest plan change
        change_result = await session.execute(
            select(PlanChange).where(PlanChange.new_plan_id == plan.id)
        )
        change = change_result.scalar_one_or_none()

        return {
            "plan": {
                "id": plan.id,
                "version": plan.version,
                "status": plan.status,
                "allocations": plan.allocations_data or [],
                "unmet_requirements": plan.unmet_requirements or [],
                "warnings": plan.warnings or [],
                "approval_required": plan.approval_required,
                "explanation": plan.explanation,
                "objective_score": plan.objective_score,
                "created_at": plan.created_at.isoformat() if plan.created_at else None,
            },
            "plan_change": {
                "id": change.id,
                "old_plan_id": change.old_plan_id,
                "new_plan_id": change.new_plan_id,
                "trigger_event": change.trigger_event,
                "changes": change.changes or [],
                "explanation": change.explanation,
                "approval_required": change.approval_required,
                "approved": change.approved,
            } if change else None,
            "incidents": incidents,
            "resources": resources,
        }

@router.post("/approve/{change_id}")
async def approve_plan_change(change_id: str, req: PlanApprovalRequest):
    async with async_session() as session:
        result = await session.execute(select(PlanChange).where(PlanChange.id == change_id))
        change = result.scalar_one_or_none()
        if not change:
            raise HTTPException(status_code=404, detail="Plan change not found")
        change.approved = req.approved
        await session.commit()

    if not req.approved and req.constraints:
        return await replan(trigger=f"Human modified: {req.constraints}")

    return {"status": "approved" if req.approved else "rejected", "change_id": change_id}
