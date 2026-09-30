"""Resource API endpoints."""
from fastapi import APIRouter, HTTPException
from typing import List
from app.db.database import async_session
from app.models.all_models import Resource
from app.schemas.resources import ResourceResponse, ResourceStatusUpdate
from app.services.websocket_manager import ws_manager
from sqlalchemy import select

router = APIRouter()

@router.get("", response_model=List[ResourceResponse])
async def list_resources():
    async with async_session() as session:
        result = await session.execute(select(Resource))
        resources = result.scalars().all()
        return [ResourceResponse.model_validate(r) for r in resources]

@router.patch("/{resource_id}/status", response_model=ResourceResponse)
async def update_resource_status(resource_id: str, req: ResourceStatusUpdate):
    async with async_session() as session:
        result = await session.execute(select(Resource).where(Resource.id == resource_id))
        resource = result.scalar_one_or_none()
        if not resource:
            raise HTTPException(status_code=404, detail="Resource not found")
        resource.status = req.status
        if req.status == "UNAVAILABLE":
            resource.current_incident_id = None
        await session.commit()
        await session.refresh(resource)
    await ws_manager.broadcast("resource.updated", {"id": resource.id, "status": resource.status})
    return ResourceResponse.model_validate(resource)
