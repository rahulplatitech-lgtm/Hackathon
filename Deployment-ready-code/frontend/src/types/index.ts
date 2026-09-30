export type UrgencyLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ResourceStatus = 'AVAILABLE' | 'ASSIGNED' | 'EN_ROUTE' | 'ON_SCENE' | 'UNAVAILABLE';
export type ResourceType = 'AMBULANCE' | 'MEDICAL_UNIT' | 'RESCUE_TEAM' | 'POLICE_UNIT' | 'SHELTER';
export type IncidentStatus = 'REPORTED' | 'ANALYZING' | 'PENDING_REVIEW' | 'CONFIRMED' | 'ACTIVE' | 'RESOLVED' | 'REJECTED';

export interface IncidentReport {
  id: string; input_type: 'text' | 'voice'; raw_text: string;
  transcript: string | null; audio_path: string | null;
  reporter_lat: number | null; reporter_lng: number | null;
  ai_confidence: number; voice_distress_signal: string | null;
  human_review_required: boolean; preliminary_type: string | null;
  extracted_location: string | null; missing_info: string[] | null;
  status: string; created_at: string;
}

export interface AlternativeCandidate {
  resource_id: string;
  resource_name: string;
  resource_type: string;
  distance_km: number;
  eta_minutes: number;
  status_tag: 'CAPABILITY_MISMATCH' | 'ASSIGNED_ELSEWHERE' | 'RESERVE_GUARDRAIL' | 'DISTANCE_PENALTY';
  reason: string;
}

export interface DecisionRationale {
  why_chosen: string;
  why_others_not_chosen: AlternativeCandidate[];
}

export interface Allocation {
  id: string; incident_id: string; resource_id: string;
  resource_name?: string; resource_type?: string;
  eta_minutes: number; distance_km: number;
  status: string; plan_id?: string;
  route_geometry?: Array<[number, number]>;
  decision_rationale?: DecisionRationale;
}

export interface Incident {
  id: string; report_id?: string; type: string;
  severity: number; urgency: UrgencyLevel;
  people_affected: number; latitude: number; longitude: number;
  location_text: string; required_resources: string[];
  priority_score: number; status: string;
  assigned_resources: Allocation[];
  created_at: string; updated_at: string;
}

export interface EmergencyResource {
  id: string; name: string; type: ResourceType;
  latitude: number; longitude: number;
  capacity: number; capabilities: string[];
  status: ResourceStatus; current_incident_id: string | null;
  updated_at: string;
}

export interface PlanDiffItem {
  resource_id: string; resource_name: string;
  old_incident_id: string | null; new_incident_id: string | null;
  change_type: 'UNCHANGED' | 'REASSIGNED' | 'NEW_ASSIGNMENT' | 'UNAVAILABLE' | 'UNASSIGNED';
}

export interface UnmetRequirement {
  incident_id: string; incident_type?: string;
  resource_type: string; count_needed: number;
}

export interface ResponsePlan {
  id: string; version: number; status: string;
  allocations: Allocation[];
  unmet_requirements: UnmetRequirement[];
  warnings: string[];
  approval_required: boolean; explanation: string;
  objective_score: number; created_at: string;
}

export interface PlanChange {
  id: string; old_plan_id: string | null; new_plan_id: string;
  trigger_event: string; changes: PlanDiffItem[];
  explanation: string; approval_required: boolean;
  approved: boolean | null; created_at: string;
}

export interface HumanReview {
  id: string; report_id: string;
  report: IncidentReport | null;
  operator_action: string | null;
  corrected_data: Record<string, unknown> | null;
  notes: string | null; created_at: string;
}

export interface WSEvent {
  event: string;
  data: Record<string, unknown>;
}
