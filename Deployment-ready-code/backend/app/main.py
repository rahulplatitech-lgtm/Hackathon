"""Crisis Command AI - FastAPI Backend Entry Point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
import os

from app.config import settings
from app.db.database import init_db
from app.api import reports, incidents, resources, planning, human_review, simulation, websocket, routing, passerby

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting CrisisSync AI Backend...")
    await init_db()
    # Auto-seed in demo mode
    if settings.DEMO_MODE:
        from app.db.seed_data import seed_database
        try:
            await seed_database()
            logger.info("Demo data seeded.")
        except Exception as e:
            logger.warning(f"Seed skipped (may already exist): {e}")
    yield
    logger.info("Shutting down CrisisSync AI Backend.")

app = FastAPI(
    title="CrisisSync AI",
    description="Multi-Agent Emergency Response, 100m Passerby Alert & Resource Coordination Platform. PROTOTYPE - Not for real emergency use.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure uploads directory exists
os.makedirs("uploads", exist_ok=True)

# API Routes
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(incidents.router, prefix="/api/incidents", tags=["Incidents"])
app.include_router(resources.router, prefix="/api/resources", tags=["Resources"])
app.include_router(planning.router, prefix="/api/planning", tags=["Planning"])
app.include_router(passerby.router, prefix="/api/passerby", tags=["Passerby Alerts"])
app.include_router(human_review.router, prefix="/api/human-review", tags=["Human Review"])
app.include_router(simulation.router, prefix="/api/simulation", tags=["Simulation"])
app.include_router(routing.router, prefix="/api/routing", tags=["Routing"])
app.include_router(websocket.router, tags=["WebSocket"])

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "CrisisSync AI",
        "version": "1.0.0",
        "disclaimer": "PROTOTYPE for simulated emergency coordination. NOT for real emergency use.",
    }

@app.get("/health")
def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
