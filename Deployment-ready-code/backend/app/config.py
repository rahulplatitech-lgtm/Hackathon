from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./crisis_command.db"
    GEMINI_API_KEY: str = ""
    AI_CONFIDENCE_THRESHOLD: float = 0.70
    DEMO_MODE: bool = True
    SEVERITY_WEIGHT: float = 0.30
    URGENCY_WEIGHT: float = 0.25
    VICTIM_WEIGHT: float = 0.20
    WAITING_TIME_WEIGHT: float = 0.15
    SCARCITY_WEIGHT: float = 0.10
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"

settings = Settings()
