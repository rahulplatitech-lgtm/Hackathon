"""100m Radius Passerby Emergency Alert & Nearby Outlets API for CrisisSync AI.
Enables instant geofenced emergency broadcasts to all citizens within 100 meters
of an incident location to mobilize bystander first-aid and clear emergency corridors.
Also provides local emergency outlets (hospitals, AEDs, ambulances, police).
"""
import math
import random
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Query
from app.api.websocket import ws_manager

router = APIRouter()

# Haversine distance in meters
def get_distance_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(delta_lambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

class PasserbyCitizen(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    distance_meters: float
    is_within_100m: bool
    skill: str
    phone_masked: str
    status: str
    has_first_aid_kit: bool

class PasserbyBroadcastRequest(BaseModel):
    incident_id: Optional[str] = "INC-100M"
    latitude: float
    longitude: float
    radius_meters: float = 100.0
    emergency_type: str = "General Emergency"
    severity: int = 4
    custom_message: Optional[str] = None

class PasserbyBroadcastResponse(BaseModel):
    broadcast_id: str
    timestamp: str
    incident_id: str
    latitude: float
    longitude: float
    radius_meters: float
    total_citizens_detected: int
    alerts_transmitted: int
    bystander_first_aiders: int
    alert_title: str
    alert_message: str
    recipients: List[PasserbyCitizen]

class EmergencyOutlet(BaseModel):
    id: str
    name: str
    type: str  # HOSPITAL, AMBULANCE, AED, POLICE, PHARMACY
    area: str
    latitude: float
    longitude: float
    distance_km: float
    eta_minutes: int
    phone: str
    is_open_24_7: bool
    capabilities: List[str]

# Seed simulated passerby around Delhi / Bangalore hubs
SAMPLE_CITIZENS = [
    {"id": "CIT-01", "name": "Aarav Sharma", "d_lat": 0.00045, "d_lng": 0.00030, "skill": "CPR & First Aid Certified", "phone": "+91 98*** **412", "has_first_aid_kit": True},
    {"id": "CIT-02", "name": "Priya Nair", "d_lat": -0.00035, "d_lng": 0.00042, "skill": "Citizen Bystander (Equipped with Vehicle)", "phone": "+91 97*** **884", "has_first_aid_kit": False},
    {"id": "CIT-03", "name": "Vikram Sen", "d_lat": 0.00028, "d_lng": -0.00038, "skill": "Civil Defense Volunteer", "phone": "+91 99*** **120", "has_first_aid_kit": True},
    {"id": "CIT-04", "name": "Ananya Roy", "d_lat": -0.00050, "d_lng": -0.00020, "skill": "Nursing Student", "phone": "+91 96*** **339", "has_first_aid_kit": True},
    {"id": "CIT-05", "name": "Karan Malhotra", "d_lat": 0.00062, "d_lng": 0.00055, "skill": "Citizen Bystander", "phone": "+91 95*** **771", "has_first_aid_kit": False},
    {"id": "CIT-06", "name": "Sneha Gupta", "d_lat": 0.00080, "d_lng": -0.00075, "skill": "Paramedic Off-Duty", "phone": "+91 94*** **992", "has_first_aid_kit": True},
]

@router.get("/nearby", response_model=List[PasserbyCitizen])
def get_nearby_passerby(
    lat: float = Query(..., description="Incident Latitude"),
    lng: float = Query(..., description="Incident Longitude"),
    radius: float = Query(100.0, description="Geofence radius in meters")
):
    """Detect all registered passerby within and near the incident coordinates."""
    results = []
    for c in SAMPLE_CITIZENS:
        c_lat = lat + c["d_lat"]
        c_lng = lng + c["d_lng"]
        dist = get_distance_meters(lat, lng, c_lat, c_lng)
        results.append(PasserbyCitizen(
            id=c["id"],
            name=c["name"],
            latitude=round(c_lat, 6),
            longitude=round(c_lng, 6),
            distance_meters=round(dist, 1),
            is_within_100m=(dist <= radius),
            skill=c["skill"],
            phone_masked=c["phone"],
            status="ALERT_READY" if dist <= radius else "OUTSIDE_RADIUS",
            has_first_aid_kit=c["has_first_aid_kit"]
        ))
    results.sort(key=lambda x: x.distance_meters)
    return results

@router.post("/broadcast", response_model=PasserbyBroadcastResponse)
async def broadcast_100m_passerby_alert(req: PasserbyBroadcastRequest):
    """
    Transmit high-priority geofenced emergency broadcast to all citizens within 100m.
    """
    detected = []
    for c in SAMPLE_CITIZENS:
        c_lat = req.latitude + c["d_lat"]
        c_lng = req.longitude + c["d_lng"]
        dist = get_distance_meters(req.latitude, req.longitude, c_lat, c_lng)
        if dist <= req.radius_meters:
            detected.append(PasserbyCitizen(
                id=c["id"],
                name=c["name"],
                latitude=round(c_lat, 6),
                longitude=round(c_lng, 6),
                distance_meters=round(dist, 1),
                is_within_100m=True,
                skill=c["skill"],
                phone_masked=c["phone"],
                status="NOTIFIED_SENT",
                has_first_aid_kit=c["has_first_aid_kit"]
            ))

    first_aiders = len([p for p in detected if p.has_first_aid_kit or "CPR" in p.skill or "Nurse" in p.skill])
    title = f"🚨 URGENT: Emergency within {int(req.radius_meters)}m of your location"
    msg = (
        req.custom_message or 
        f"CrisisSync AI Alert: A {req.emergency_type} (Severity S{req.severity}) was reported nearby. "
        f"If you have first-aid skills or safety equipment, your help is requested. Otherwise, please clear roadways for emergency responders."
    )

    broadcast_data = {
        "broadcast_id": f"BC-{random.randint(1000, 9999)}",
        "timestamp": datetime.utcnow().isoformat(),
        "incident_id": req.incident_id or "INC-100M",
        "latitude": req.latitude,
        "longitude": req.longitude,
        "radius_meters": req.radius_meters,
        "total_citizens_detected": len(detected),
        "alerts_transmitted": len(detected),
        "bystander_first_aiders": first_aiders,
        "alert_title": title,
        "alert_message": msg,
        "recipients": [r.model_dump() for r in detected]
    }

    # Broadcast over WebSockets for live multi-agent UI synchronization
    await ws_manager.broadcast("passerby.alerted", broadcast_data)

    return PasserbyBroadcastResponse(
        broadcast_id=broadcast_data["broadcast_id"],
        timestamp=broadcast_data["timestamp"],
        incident_id=broadcast_data["incident_id"],
        latitude=broadcast_data["latitude"],
        longitude=broadcast_data["longitude"],
        radius_meters=broadcast_data["radius_meters"],
        total_citizens_detected=broadcast_data["total_citizens_detected"],
        alerts_transmitted=broadcast_data["alerts_transmitted"],
        bystander_first_aiders=broadcast_data["bystander_first_aiders"],
        alert_title=broadcast_data["alert_title"],
        alert_message=broadcast_data["alert_message"],
        recipients=detected
    )

@router.get("/outlets", response_model=List[EmergencyOutlet])
def get_emergency_outlets(
    lat: float = Query(12.9716, description="Center Latitude"),
    lng: float = Query(77.5946, description="Center Longitude"),
    type_filter: Optional[str] = Query(None, description="Optional type filter")
):
    """
    Returns nearby emergency outlets (Hospitals, Ambulances, AEDs, Police, Pharmacies)
    matching the interactive 'Nearby help' interface from Image 5.
    """
    outlets = [
        EmergencyOutlet(
            id="OUT-H1",
            name="Central Emergency Hospital",
            type="HOSPITAL",
            area="Connaught Place / MG Road",
            latitude=lat + 0.0055,
            longitude=lng + 0.0035,
            distance_km=0.8,
            eta_minutes=3,
            phone="+91 11 2334 0000",
            is_open_24_7=True,
            capabilities=["24/7 Trauma ICU", "Emergency OT", "Burn Ward", "Blood Bank"]
        ),
        EmergencyOutlet(
            id="OUT-A1",
            name="Barakhamba Ambulance Response Point",
            type="AMBULANCE",
            area="Barakhamba Road area",
            latitude=lat - 0.0040,
            longitude=lng + 0.0060,
            distance_km=1.2,
            eta_minutes=4,
            phone="108",
            is_open_24_7=True,
            capabilities=["Advanced Life Support (ALS)", "Oxygen Ventilator", "Defibrillator"]
        ),
        EmergencyOutlet(
            id="OUT-AED1",
            name="Metro Station AED & Cardiac Kiosk",
            type="AED",
            area="Janpath Metro Concourse",
            latitude=lat + 0.0025,
            longitude=lng - 0.0030,
            distance_km=0.4,
            eta_minutes=1,
            phone="112",
            is_open_24_7=True,
            capabilities=["Automated External Defibrillator", "Voice CPR Coaching", "Trauma Kit"]
        ),
        EmergencyOutlet(
            id="OUT-P1",
            name="Police Tactical & Traffic Post",
            type="POLICE",
            area="Mandi House Circle",
            latitude=lat - 0.0050,
            longitude=lng - 0.0045,
            distance_km=0.9,
            eta_minutes=2,
            phone="100 / 112",
            is_open_24_7=True,
            capabilities=["Emergency Traffic Control", "Rapid Patrol Unit", "Crowd Evacuation"]
        ),
        EmergencyOutlet(
            id="OUT-PH1",
            name="Apollo 24/7 Emergency Pharmacy & Surgical",
            type="PHARMACY",
            area="Bengali Market",
            latitude=lat + 0.0068,
            longitude=lng - 0.0020,
            distance_km=1.1,
            eta_minutes=3,
            phone="+91 11 2371 5500",
            is_open_24_7=True,
            capabilities=["Critical Injections", "Burns & Bandages", "Asthma Inhalers", "Oxygen Cans"]
        ),
        EmergencyOutlet(
            id="OUT-H2",
            name="City Trauma & Super Specialty Hospital",
            type="HOSPITAL",
            area="Civic Centre Perimeter",
            latitude=lat - 0.0080,
            longitude=lng + 0.0070,
            distance_km=1.6,
            eta_minutes=5,
            phone="+91 11 2323 1111",
            is_open_24_7=True,
            capabilities=["Cardiac Emergency", "Stroke Unit", "Hazmat Decontamination"]
        )
    ]

    if type_filter and type_filter.upper() != "ALL":
        outlets = [o for o in outlets if o.type == type_filter.upper()]

    return outlets
