from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

class StatusResponse(BaseModel):
    status: str
    message: str

class ErrorResponse(BaseModel):
    detail: str
