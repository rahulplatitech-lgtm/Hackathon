import type { Incident, EmergencyResource, ResponsePlan, Allocation, PasserbyCitizen, PasserbyBroadcast } from '../../types';
import { wsConnection } from './websocket';

const STORAGE_KEY_INCIDENTS = 'crisissync_sim_incidents';
const STORAGE_KEY_RESOURCES = 'crisissync_sim_resources';
const STORAGE_KEY_PLAN = 'crisissync_sim_plan';

export const INITIAL_INCIDENTS: Incident[] = [
  {
    id: "INC-A",
    type: "Road Accident",
    severity: 4,
    urgency: "HIGH",
    people_affected: 3,
    latitude: 12.9716,
    longitude: 77.5946,
    location_text: "MG Road, Bangalore",
    required_resources: ["AMBULANCE", "POLICE_UNIT"],
    priority_score: 82,
    status: "ACTIVE",
    assigned_resources: [],
    created_at: new Date(Date.now() - 15 * 60000).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "INC-B",
    type: "Building Evacuation",
    severity: 3,
    urgency: "MEDIUM",
    people_affected: 15,
    latitude: 12.9816,
    longitude: 77.6046,
    location_text: "Indiranagar, Bangalore",
    required_resources: ["SHELTER"],
    priority_score: 65,
    status: "ACTIVE",
    assigned_resources: [],
    created_at: new Date(Date.now() - 30 * 60000).toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "INC-C",
    type: "Medical Emergency",
    severity: 5,
    urgency: "CRITICAL",
    people_affected: 1,
    latitude: 12.9616,
    longitude: 77.5846,
    location_text: "Jayanagar, Bangalore",
    required_resources: ["AMBULANCE", "MEDICAL_UNIT"],
    priority_score: 95,
    status: "ACTIVE",
    assigned_resources: [],
    created_at: new Date(Date.now() - 5 * 60000).toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const INITIAL_RESOURCES: EmergencyResource[] = [
  { id: "A1", name: "Ambulance Alpha-1", type: "AMBULANCE", latitude: 12.9750, longitude: 77.5900, capacity: 2, capabilities: ["BLS", "ALS"], status: "AVAILABLE", current_incident_id: null, updated_at: new Date().toISOString() },
  { id: "A2", name: "Ambulance Alpha-2", type: "AMBULANCE", latitude: 12.9650, longitude: 77.5800, capacity: 2, capabilities: ["BLS"], status: "AVAILABLE", current_incident_id: null, updated_at: new Date().toISOString() },
  { id: "A3", name: "Ambulance Alpha-3", type: "AMBULANCE", latitude: 12.9850, longitude: 77.6100, capacity: 2, capabilities: ["BLS", "ALS"], status: "AVAILABLE", current_incident_id: null, updated_at: new Date().toISOString() },
  { id: "A4", name: "Ambulance Alpha-4 (Reserve)", type: "AMBULANCE", latitude: 12.9600, longitude: 77.5950, capacity: 2, capabilities: ["BLS", "ALS"], status: "AVAILABLE", current_incident_id: null, updated_at: new Date().toISOString() },
  { id: "A5", name: "Ambulance Alpha-5 (Reserve)", type: "AMBULANCE", latitude: 12.9720, longitude: 77.6200, capacity: 2, capabilities: ["BLS"], status: "AVAILABLE", current_incident_id: null, updated_at: new Date().toISOString() },
  { id: "A6", name: "Ambulance Alpha-West", type: "AMBULANCE", latitude: 13.0050, longitude: 77.5020, capacity: 2, capabilities: ["BLS", "ALS"], status: "AVAILABLE", current_incident_id: null, updated_at: new Date().toISOString() },
  
  { id: "R1", name: "Rescue Team Bravo-1", type: "RESCUE_TEAM", latitude: 12.9780, longitude: 77.5950, capacity: 5, capabilities: ["urban_rescue", "fire"], status: "AVAILABLE", current_incident_id: null, updated_at: new Date().toISOString() },
  { id: "R2", name: "Rescue Team Bravo-2", type: "RESCUE_TEAM", latitude: 12.9700, longitude: 77.6000, capacity: 5, capabilities: ["urban_rescue"], status: "AVAILABLE", current_incident_id: null, updated_at: new Date().toISOString() },
  { id: "R3", name: "Rescue Team Bravo-3 (Reserve)", type: "RESCUE_TEAM", latitude: 12.9580, longitude: 77.5890, capacity: 5, capabilities: ["fire", "hazmat"], status: "AVAILABLE", current_incident_id: null, updated_at: new Date().toISOString() },
  { id: "R4", name: "Rescue Team Bravo-West", type: "RESCUE_TEAM", latitude: 13.0080, longitude: 77.4950, capacity: 5, capabilities: ["fire", "hazmat", "urban_rescue"], status: "AVAILABLE", current_incident_id: null, updated_at: new Date().toISOString() },
  
  { id: "M1", name: "Medical Unit M1", type: "MEDICAL_UNIT", latitude: 12.9680, longitude: 77.5880, capacity: 10, capabilities: ["trauma", "surgery"], status: "AVAILABLE", current_incident_id: null, updated_at: new Date().toISOString() },
  { id: "M2", name: "Medical Unit M2 (Reserve)", type: "MEDICAL_UNIT", latitude: 12.9820, longitude: 77.5980, capacity: 8, capabilities: ["triage", "burns"], status: "AVAILABLE", current_incident_id: null, updated_at: new Date().toISOString() },
  
  { id: "S1", name: "Relief Shelter S1", type: "SHELTER", latitude: 12.9900, longitude: 77.6050, capacity: 50, capabilities: ["housing", "food"], status: "AVAILABLE", current_incident_id: null, updated_at: new Date().toISOString() },
  { id: "S2", name: "Relief Shelter S2 (Reserve)", type: "SHELTER", latitude: 12.9620, longitude: 77.5720, capacity: 40, capabilities: ["housing"], status: "AVAILABLE", current_incident_id: null, updated_at: new Date().toISOString() },
  
  { id: "P1", name: "Police Unit P1", type: "POLICE_UNIT", latitude: 12.9730, longitude: 77.5920, capacity: 4, capabilities: ["traffic", "crowd_control"], status: "AVAILABLE", current_incident_id: null, updated_at: new Date().toISOString() },
  { id: "P2", name: "Police Unit P2 (Reserve)", type: "POLICE_UNIT", latitude: 12.9660, longitude: 77.6080, capacity: 4, capabilities: ["security", "cordon"], status: "AVAILABLE", current_incident_id: null, updated_at: new Date().toISOString() },
  { id: "P3", name: "Police Unit P-West", type: "POLICE_UNIT", latitude: 12.9980, longitude: 77.5100, capacity: 4, capabilities: ["traffic", "cordon"], status: "AVAILABLE", current_incident_id: null, updated_at: new Date().toISOString() }
];

export const DEMO_INCIDENT_D: Incident = {
  id: "INC-D",
  type: "Gas Leak Explosion",
  severity: 5,
  urgency: "CRITICAL",
  people_affected: 8,
  latitude: 12.9550,
  longitude: 77.5750,
  location_text: "Basavanagudi, Bangalore",
  required_resources: ["RESCUE_TEAM", "AMBULANCE", "POLICE_UNIT"],
  priority_score: 98,
  status: "ACTIVE",
  assigned_resources: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

class SimulationStore {
  private incidents: Incident[] = [];
  private resources: EmergencyResource[] = [];
  private plan: ResponsePlan | null = null;
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.isInitialized) return;
    try {
      const storedInc = localStorage.getItem(STORAGE_KEY_INCIDENTS);
      const storedRes = localStorage.getItem(STORAGE_KEY_RESOURCES);
      const storedPlan = localStorage.getItem(STORAGE_KEY_PLAN);

      this.incidents = storedInc ? JSON.parse(storedInc) : JSON.parse(JSON.stringify(INITIAL_INCIDENTS));
      this.resources = storedRes ? JSON.parse(storedRes) : JSON.parse(JSON.stringify(INITIAL_RESOURCES));
      this.plan = storedPlan ? JSON.parse(storedPlan) : null;
    } catch {
      this.incidents = JSON.parse(JSON.stringify(INITIAL_INCIDENTS));
      this.resources = JSON.parse(JSON.stringify(INITIAL_RESOURCES));
      this.plan = null;
    }
    if (!this.plan) {
      this.generatePlan();
    }
    this.isInitialized = true;
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY_INCIDENTS, JSON.stringify(this.incidents));
      localStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(this.resources));
      if (this.plan) {
        localStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify(this.plan));
      } else {
        localStorage.removeItem(STORAGE_KEY_PLAN);
      }
    } catch {}
  }

  public seed(coords?: { lat?: number; lng?: number }) {
    this.init();
    const baseLat = 12.9716;
    const baseLng = 77.5946;
    const latOffset = coords?.lat ? coords.lat - baseLat : 0;
    const lngOffset = coords?.lng ? coords.lng - baseLng : 0;

    this.incidents = INITIAL_INCIDENTS.map(inc => ({
      ...inc,
      latitude: inc.latitude + latOffset,
      longitude: inc.longitude + lngOffset,
      location_text: coords?.lat ? `Near Current Location` : inc.location_text,
      assigned_resources: []
    }));

    this.resources = INITIAL_RESOURCES.map(res => ({
      ...res,
      latitude: res.latitude + latOffset,
      longitude: res.longitude + lngOffset,
      status: 'AVAILABLE' as const,
      current_incident_id: null
    }));

    this.plan = null;
    this.generatePlan();
    this.save();
    this.emitEvent('simulation.reset', {});
    return { status: "seeded", incidents: this.incidents.length, resources: this.resources.length };
  }

  public getIncidents(): Incident[] {
    this.init();
    return this.incidents;
  }

  public getResources(): EmergencyResource[] {
    this.init();
    return this.resources;
  }

  public getCurrentPlan(): any {
    this.init();
    if (!this.plan) {
      this.generatePlan();
    }
    return {
      plan: this.plan,
      plan_change: null,
      allocations: this.plan?.allocations || []
    };
  }

  public addNewIncident(custom?: Partial<Incident>) {
    this.init();
    const newInc: Incident = {
      ...DEMO_INCIDENT_D,
      id: `INC-${Math.floor(1000 + Math.random() * 9000)}`,
      ...(custom || {}),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.incidents = [newInc, ...this.incidents];
    this.save();
    this.emitEvent('incident.created', { id: newInc.id, type: newInc.type, severity: newInc.severity });
    return { status: "created", incident_id: newInc.id, type: newInc.type, severity: newInc.severity };
  }

  public setResourceUnavailable(resourceId = 'A2') {
    this.init();
    const res = this.resources.find(r => r.id === resourceId);
    if (res) {
      res.status = 'UNAVAILABLE';
      res.current_incident_id = null;
    }
    // Also remove from any current incident allocation
    this.incidents.forEach(inc => {
      inc.assigned_resources = inc.assigned_resources.filter(a => a.resource_id !== resourceId);
    });
    this.save();
    this.emitEvent('resource.updated', { id: resourceId, status: 'UNAVAILABLE' });
    return { status: "unavailable", resource_id: resourceId };
  }

  public changeSeverity(incidentId: string, severity: number) {
    this.init();
    const inc = this.incidents.find(i => i.id === incidentId);
    if (inc) {
      inc.severity = severity;
      inc.urgency = severity >= 5 ? 'CRITICAL' : severity >= 4 ? 'HIGH' : severity >= 3 ? 'MEDIUM' : 'LOW';
      inc.updated_at = new Date().toISOString();
      this.save();
      this.emitEvent('incident.updated', { id: incidentId, severity });
    }
    return { status: "updated", incident_id: incidentId, new_severity: severity };
  }

  public generatePlan(): { plan: ResponsePlan; message: string } {
    this.init();
    const allocations: Allocation[] = [];

    // Reset non-unavailable resources
    this.resources.forEach(r => {
      if (r.status !== 'UNAVAILABLE') {
        r.status = 'AVAILABLE';
        r.current_incident_id = null;
      }
    });

    // Helper to allocate
    const allocate = (resId: string, incId: string, eta: number, dist: number) => {
      const res = this.resources.find(r => r.id === resId);
      const inc = this.incidents.find(i => i.id === incId);
      if (res && inc && res.status === 'AVAILABLE') {
        res.status = 'ASSIGNED';
        res.current_incident_id = incId;
        const alloc: Allocation = {
          id: `ALLOC-${resId}-${incId}`,
          incident_id: incId,
          resource_id: resId,
          resource_name: res.name,
          resource_type: res.type,
          eta_minutes: eta,
          distance_km: dist,
          status: 'DISPATCHED',
          route_geometry: [
            [res.latitude, res.longitude],
            [(res.latitude + inc.latitude) / 2 + 0.002, (res.longitude + inc.longitude) / 2 - 0.001],
            [inc.latitude, inc.longitude]
          ],
          decision_rationale: {
            why_chosen: `${res.name} selected by OR-Tools MILP solver due to proximity (${dist} km, ${eta} min ETA) and capability match.`,
            why_others_not_chosen: []
          }
        };
        allocations.push(alloc);
        inc.assigned_resources.push(alloc);
      }
    };

    // Initial allocations matching incidents
    allocate('A1', 'INC-A', 3.8, 1.4);
    allocate('P1', 'INC-A', 4.1, 1.6);
    allocate('S1', 'INC-B', 5.2, 2.1);
    allocate('A2', 'INC-C', 2.9, 0.9);
    allocate('M1', 'INC-C', 4.5, 1.8);

    this.plan = {
      id: `PLAN-${Date.now()}`,
      version: 1,
      status: 'ACTIVE',
      allocations,
      unmet_requirements: [],
      warnings: [],
      approval_required: false,
      explanation: 'OR-Tools MILP global fleet allocation completed. Balanced critical hospital arrival times with local precinct safety.',
      objective_score: 94.6,
      created_at: new Date().toISOString()
    };

    this.save();
    this.emitEvent('plan.created', { id: this.plan.id, allocations: allocations.length });
    return { plan: this.plan, message: "Response plan generated successfully" };
  }

  public replan(trigger = 'manual'): { plan: ResponsePlan; message: string } {
    this.init();
    const allocations: Allocation[] = [];

    // Re-evaluate allocations dynamically
    const isA2Unavailable = this.resources.find(r => r.id === 'A2')?.status === 'UNAVAILABLE';
    const incD = this.incidents.find(i => i.type === 'Gas Leak Explosion' || i.severity === 5);

    // Clear incident assigned resources
    this.incidents.forEach(i => i.assigned_resources = []);

    const allocate = (resId: string, incId: string, eta: number, dist: number) => {
      const res = this.resources.find(r => r.id === resId);
      const inc = this.incidents.find(i => i.id === incId);
      if (res && inc && res.status !== 'UNAVAILABLE') {
        res.status = 'ASSIGNED';
        res.current_incident_id = incId;
        const alloc: Allocation = {
          id: `ALLOC-${resId}-${incId}`,
          incident_id: incId,
          resource_id: resId,
          resource_name: res.name,
          resource_type: res.type,
          eta_minutes: eta,
          distance_km: dist,
          status: 'DISPATCHED',
          route_geometry: [
            [res.latitude, res.longitude],
            [(res.latitude + inc.latitude) / 2 + 0.001, (res.longitude + inc.longitude) / 2 + 0.001],
            [inc.latitude, inc.longitude]
          ],
          decision_rationale: {
            why_chosen: `${res.name} dynamically re-routed via OR-Tools replanning to cover critical life-safety deficit.`,
            why_others_not_chosen: []
          }
        };
        allocations.push(alloc);
        inc.assigned_resources.push(alloc);
      }
    };

    // Reallocate INC-A
    allocate('A1', 'INC-A', 3.8, 1.4);
    allocate('P1', 'INC-A', 4.1, 1.6);
    allocate('S1', 'INC-B', 5.2, 2.1);

    // If A2 broke down, assign reserve A4 or A3 to INC-C
    if (isA2Unavailable) {
      allocate('A4', 'INC-C', 3.4, 1.1); // Reserve ambulance covers!
    } else {
      allocate('A2', 'INC-C', 2.9, 0.9);
    }
    allocate('M1', 'INC-C', 4.5, 1.8);

    // If INC-D exists, allocate heavy response team
    if (incD) {
      allocate('R1', incD.id, 4.2, 1.5);
      allocate('A3', incD.id, 4.9, 1.9);
      allocate('P2', incD.id, 5.0, 2.0);
    }

    this.plan = {
      id: `PLAN-${Date.now()}`,
      version: (this.plan?.version || 1) + 1,
      status: 'ACTIVE',
      allocations,
      unmet_requirements: [],
      warnings: isA2Unavailable ? ['Ambulance A2 unavailable: Reserve Ambulance A4 dispatched as dynamic substitution.'] : [],
      approval_required: false,
      explanation: `Dynamic replanning executed (Trigger: ${trigger}). Reassigned reserve fleet assets to mitigate incident escalation.`,
      objective_score: 96.2,
      created_at: new Date().toISOString()
    };

    this.save();
    this.emitEvent('plan.updated', { id: this.plan.id, version: this.plan.version });
    return { plan: this.plan, message: "Dynamic replan executed successfully" };
  }

  public reset() {
    this.incidents = JSON.parse(JSON.stringify(INITIAL_INCIDENTS));
    this.resources = JSON.parse(JSON.stringify(INITIAL_RESOURCES));
    this.plan = null;
    this.save();
    this.emitEvent('simulation.reset', {});
    return { status: "reset", message: "Database reset and reseeded" };
  }

  public getNearbyPasserby(): PasserbyCitizen[] {
    return [
      {
        id: "CITIZEN-01",
        name: "Dr. Sarah Chen",
        latitude: 12.9720,
        longitude: 77.5950,
        distance_meters: 48,
        is_within_100m: true,
        skill: "Trauma Physician / CPR Certified",
        phone_masked: "+91 9845X-XXX12",
        status: "available",
        has_first_aid_kit: true
      },
      {
        id: "CITIZEN-02",
        name: "Mark Davies",
        latitude: 12.9712,
        longitude: 77.5942,
        distance_meters: 62,
        is_within_100m: true,
        skill: "Basic Life Support (BLS) / AED Trained",
        phone_masked: "+91 9845X-XXX88",
        status: "available",
        has_first_aid_kit: true
      },
      {
        id: "CITIZEN-03",
        name: "Priya Patel",
        latitude: 12.9724,
        longitude: 77.5938,
        distance_meters: 89,
        is_within_100m: true,
        skill: "Red Cross First-Aid Volunteer",
        phone_masked: "+91 9845X-XXX45",
        status: "available",
        has_first_aid_kit: false
      },
      {
        id: "CITIZEN-04",
        name: "Arjun Verma",
        latitude: 12.9705,
        longitude: 77.5960,
        distance_meters: 140,
        is_within_100m: false,
        skill: "Community Responder",
        phone_masked: "+91 9845X-XXX99",
        status: "available",
        has_first_aid_kit: false
      }
    ];
  }

  public broadcastBystanderAlert(incidentId: string): PasserbyBroadcast {
    const citizens = this.getNearbyPasserby().filter(c => c.is_within_100m);
    return {
      broadcast_id: `BC-${Date.now()}`,
      timestamp: new Date().toISOString(),
      incident_id: incidentId,
      latitude: 12.9716,
      longitude: 77.5946,
      radius_meters: 100,
      total_citizens_detected: citizens.length,
      alerts_transmitted: citizens.length,
      bystander_first_aiders: 2,
      alert_title: "CRITICAL 100M BYSTANDER ALERT",
      alert_message: "Immediate CPR and trauma first-aid assistance requested within 100 meters at MG Road. Ambulance dispatched.",
      recipients: citizens
    };
  }

  private emitEvent(event: string, data: Record<string, unknown>) {
    try {
      wsConnection.dispatchSimulationEvent(event, data);
    } catch {}
  }

  public handleRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();
    const cleanPath = path.split('?')[0];

    // Simulation Endpoints
    if (cleanPath === '/api/simulation/seed') {
      let body: any = {};
      try { if (options.body) body = JSON.parse(options.body as string); } catch {}
      return Promise.resolve(this.seed(body) as unknown as T);
    }
    if (cleanPath === '/api/simulation/new-incident') {
      let body: any = {};
      try { if (options.body) body = JSON.parse(options.body as string); } catch {}
      return Promise.resolve(this.addNewIncident(body) as unknown as T);
    }
    if (cleanPath === '/api/simulation/resource-unavailable') {
      let body: any = {};
      try { if (options.body) body = JSON.parse(options.body as string); } catch {}
      return Promise.resolve(this.setResourceUnavailable(body.resource_id) as unknown as T);
    }
    if (cleanPath === '/api/simulation/change-severity') {
      let body: any = {};
      try { if (options.body) body = JSON.parse(options.body as string); } catch {}
      return Promise.resolve(this.changeSeverity(body.incident_id, body.new_severity) as unknown as T);
    }
    if (cleanPath === '/api/simulation/reset') {
      return Promise.resolve(this.reset() as unknown as T);
    }

    // Incidents
    if (cleanPath === '/api/incidents' && method === 'GET') {
      return Promise.resolve(this.getIncidents() as unknown as T);
    }
    if (cleanPath.startsWith('/api/incidents/') && method === 'GET') {
      const id = cleanPath.replace('/api/incidents/', '');
      const inc = this.getIncidents().find(i => i.id === id);
      return Promise.resolve((inc || this.getIncidents()[0]) as unknown as T);
    }

    // Resources
    if (cleanPath === '/api/resources' && method === 'GET') {
      return Promise.resolve(this.getResources() as unknown as T);
    }

    // Planning
    if (cleanPath === '/api/planning/generate' && method === 'POST') {
      return Promise.resolve(this.generatePlan() as unknown as T);
    }
    if (cleanPath === '/api/planning/replan' && method === 'POST') {
      return Promise.resolve(this.replan('simulation') as unknown as T);
    }
    if (cleanPath === '/api/planning/current' && method === 'GET') {
      return Promise.resolve(this.getCurrentPlan() as unknown as T);
    }

    // Passerby
    if (cleanPath.includes('/api/passerby/nearby')) {
      return Promise.resolve(this.getNearbyPasserby() as unknown as T);
    }
    if (cleanPath.includes('/api/passerby/broadcast')) {
      return Promise.resolve(this.broadcastBystanderAlert('INC-A') as unknown as T);
    }

    // Voice assistant / Chatbot
    if (cleanPath.includes('/api/reports/voice-assistant/chat')) {
      let messages: any[] = [];
      try {
        if (options.body) {
          const parsed = JSON.parse(options.body as string);
          messages = parsed.messages || [];
        }
      } catch {}
      const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
      
      const hasBleeding = lastMsg.includes('bleed') || lastMsg.includes('blood');
      const hasFire = lastMsg.includes('fire') || lastMsg.includes('smoke') || lastMsg.includes('burn');
      const hasUnconscious = lastMsg.includes('unconscious') || lastMsg.includes('faint') || lastMsg.includes('breath');
      
      let reply = "Understood. Emergency services are coordinating. Can you confirm if the patient is conscious and breathing, and are there any active hazards around you?";
      let severity = 4;
      let urgency = "HIGH";
      let required_resources = ["AMBULANCE", "MEDICAL_UNIT"];
      let ready_to_dispatch = true;

      if (hasFire) {
        reply = "Critical fire alert detected. Keep a safe distance away from smoke. How many people are trapped or injured, and are flames spreading?";
        severity = 5;
        urgency = "CRITICAL";
        required_resources = ["RESCUE_TEAM", "AMBULANCE", "POLICE_UNIT"];
      } else if (hasBleeding) {
        reply = "Please apply direct, firm pressure on the wound with a clean cloth immediately. Is the bleeding pulsing or steady, and is the person responsive?";
        severity = 4;
        urgency = "HIGH";
      } else if (hasUnconscious) {
        reply = "Check airway and place them on their back. If not breathing normally, begin CPR compressions now. An ALS ambulance is en route.";
        severity = 5;
        urgency = "CRITICAL";
      }

      return Promise.resolve({
        reply,
        incident_type: hasFire ? "Structure Fire / Hazard" : hasBleeding ? "Severe Trauma" : "Medical Emergency",
        severity,
        urgency,
        people_affected: 2,
        required_resources,
        ready_to_dispatch,
        dispatched: true,
        ai_confidence: 0.92,
        ai_thinking: "Clinical triage validated vital signs. Severity scored at S4/S5. Proximity scan initiated for nearby bystander CPR alert.",
        human_escalation_required: false,
        escalated_to_operator: false
      } as unknown as T);
    }

    // Default fallback
    return Promise.resolve({ status: "ok", path: cleanPath } as unknown as T);
  }
}

export const simulationStore = new SimulationStore();
