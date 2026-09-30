from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class PlanDiffItem(BaseModel):
    resource_id: str
    resource_name: str
    old_incident_id: Optional[str] = None
    new_incident_id: Optional[str] = None
    old_incident_type: Optional[str] = None
    new_incident_type: Optional[str] = None
    change_type: str  # UNCHANGED, REASSIGNED, NEW_ASSIGNMENT, UNAVAILABLE, UNASSIGNED

class UnmetRequirement(BaseModel):
    incident_id: str
    incident_type: str = ""
    resource_type: str
    count_needed: int

class ResponsePlanResponse(BaseModel):
    id: str
    version: int
    status: str
    allocations: list = []
    unmet_requirements: List[UnmetRequirement] = []
    warnings: List[str] = []
    approval_required: bool
    explanation: str
    objective_score: float
    created_at: datetime

    class Config:
        from_attributes = True

class PlanChangeResponse(BaseModel):
    id: str
    old_plan_id: Optional[str] = None
    new_plan_id: str
    trigger_event: str
    changes: List[PlanDiffItem] = []
    explanation: str
    approval_required: bool
    approved: Optional[bool] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PlanApprovalRequest(BaseModel):
    approved: bool
    constraints: Optional[str] = None
