"""Seed the database with demo scenario data."""
from app.db.database import async_session
from app.models.all_models import Incident, Resource, gen_id
from datetime import datetime, timezone
import copy

SEED_INCIDENTS = [
    {
        "id": "INC-A",
        "type": "Road Accident",
        "severity": 4,
        "urgency": "HIGH",
        "people_affected": 3,
        "latitude": 12.9716,
        "longitude": 77.5946,
        "location_text": "MG Road, Bangalore",
        "required_resources": ["AMBULANCE", "POLICE_UNIT"],
        "status": "ACTIVE",
    },
    {
        "id": "INC-B",
        "type": "Building Evacuation",
        "severity": 3,
        "urgency": "MEDIUM",
        "people_affected": 15,
        "latitude": 12.9816,
        "longitude": 77.6046,
        "location_text": "Indiranagar, Bangalore",
        "required_resources": ["SHELTER"],
        "status": "ACTIVE",
    },
    {
        "id": "INC-C",
        "type": "Medical Emergency",
        "severity": 5,
        "urgency": "CRITICAL",
        "people_affected": 1,
        "latitude": 12.9616,
        "longitude": 77.5846,
        "location_text": "Jayanagar, Bangalore",
        "required_resources": ["AMBULANCE", "MEDICAL_UNIT"],
        "status": "ACTIVE",
    },
]

# 14 Full City Fleet Resources with Strategic Reserve Backups
SEED_RESOURCES = [
    # Ambulances (Primary & Reserve Fleet)
    {"id": "A1", "name": "Ambulance Alpha-1", "type": "AMBULANCE", "latitude": 12.9750, "longitude": 77.5900, "capacity": 2, "capabilities": ["BLS", "ALS"], "status": "AVAILABLE"},
    {"id": "A2", "name": "Ambulance Alpha-2", "type": "AMBULANCE", "latitude": 12.9650, "longitude": 77.5800, "capacity": 2, "capabilities": ["BLS"], "status": "AVAILABLE"},
    {"id": "A3", "name": "Ambulance Alpha-3", "type": "AMBULANCE", "latitude": 12.9850, "longitude": 77.6100, "capacity": 2, "capabilities": ["BLS", "ALS"], "status": "AVAILABLE"},
    {"id": "A4", "name": "Ambulance Alpha-4 (Reserve)", "type": "AMBULANCE", "latitude": 12.9600, "longitude": 77.5950, "capacity": 2, "capabilities": ["BLS", "ALS"], "status": "AVAILABLE"},
    {"id": "A5", "name": "Ambulance Alpha-5 (Reserve)", "type": "AMBULANCE", "latitude": 12.9720, "longitude": 77.6200, "capacity": 2, "capabilities": ["BLS"], "status": "AVAILABLE"},
    
    # Rescue & Fire Teams
    {"id": "R1", "name": "Rescue Team Bravo-1", "type": "RESCUE_TEAM", "latitude": 12.9780, "longitude": 77.5950, "capacity": 5, "capabilities": ["urban_rescue", "fire"], "status": "AVAILABLE"},
    {"id": "R2", "name": "Rescue Team Bravo-2", "type": "RESCUE_TEAM", "latitude": 12.9700, "longitude": 77.6000, "capacity": 5, "capabilities": ["urban_rescue"], "status": "AVAILABLE"},
    {"id": "R3", "name": "Rescue Team Bravo-3 (Reserve)", "type": "RESCUE_TEAM", "latitude": 12.9580, "longitude": 77.5890, "capacity": 5, "capabilities": ["fire", "hazmat"], "status": "AVAILABLE"},
    
    # Medical Trauma Units
    {"id": "M1", "name": "Medical Unit M1", "type": "MEDICAL_UNIT", "latitude": 12.9680, "longitude": 77.5880, "capacity": 10, "capabilities": ["trauma", "surgery"], "status": "AVAILABLE"},
    {"id": "M2", "name": "Medical Unit M2 (Reserve)", "type": "MEDICAL_UNIT", "latitude": 12.9820, "longitude": 77.5980, "capacity": 8, "capabilities": ["triage", "burns"], "status": "AVAILABLE"},
    
    # Emergency Shelters
    {"id": "S1", "name": "Relief Shelter S1", "type": "SHELTER", "latitude": 12.9900, "longitude": 77.6050, "capacity": 50, "capabilities": ["housing", "food"], "status": "AVAILABLE"},
    {"id": "S2", "name": "Relief Shelter S2 (Reserve)", "type": "SHELTER", "latitude": 12.9620, "longitude": 77.5720, "capacity": 40, "capabilities": ["housing"], "status": "AVAILABLE"},
    
    # Police Patrol Units
    {"id": "P1", "name": "Police Unit P1", "type": "POLICE_UNIT", "latitude": 12.9730, "longitude": 77.5920, "capacity": 4, "capabilities": ["traffic", "crowd_control"], "status": "AVAILABLE"},
    {"id": "P2", "name": "Police Unit P2 (Reserve)", "type": "POLICE_UNIT", "latitude": 12.9660, "longitude": 77.6080, "capacity": 4, "capabilities": ["security", "cordon"], "status": "AVAILABLE"},
]

async def seed_database(lat: float = None, lng: float = None):
    """Reset and seed the database with demo data."""
    # Calculate offset based on center of Bangalore (12.9716, 77.5946)
    base_lat = 12.9716
    base_lng = 77.5946
    
    lat_offset = lat - base_lat if lat else 0
    lng_offset = lng - base_lng if lng else 0

    async with async_session() as session:
        # Clear existing data
        from sqlalchemy import text
        for table in ["allocations", "plan_changes", "response_plans", "human_reviews",
                      "system_events", "incidents", "incident_reports", "resources"]:
            await session.execute(text(f"DELETE FROM {table}"))
        await session.commit()

        # Seed incidents
        for data in SEED_INCIDENTS:
            modified_data = copy.deepcopy(data)
            modified_data["latitude"] += lat_offset
            modified_data["longitude"] += lng_offset
            if lat and lng:
                modified_data["location_text"] = "Current Area"
            incident = Incident(**modified_data)
            session.add(incident)

        # Seed resources
        for data in SEED_RESOURCES:
            modified_data = copy.deepcopy(data)
            modified_data["latitude"] += lat_offset
            modified_data["longitude"] += lng_offset
            resource = Resource(**modified_data)
            session.add(resource)

        await session.commit()
        print(f"Seeded {len(SEED_INCIDENTS)} incidents and {len(SEED_RESOURCES)} resources.")

DEMO_INCIDENT_D = {
    "id": "INC-D",
    "type": "Gas Leak Explosion",
    "severity": 5,
    "urgency": "CRITICAL",
    "people_affected": 8,
    "latitude": 12.9550,
    "longitude": 77.5750,
    "location_text": "Basavanagudi, Bangalore",
    "required_resources": ["RESCUE_TEAM", "AMBULANCE", "POLICE_UNIT"],
    "status": "ACTIVE",
}
