from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class ReviewModifyRequest(BaseModel):
    corrected_data: Dict[str, Any]
    notes: Optional[str] = None

class HumanReviewResponse(BaseModel):
    id: str
    report_id: str
    report: Optional[dict] = None
    operator_action: Optional[str] = None
    corrected_data: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
