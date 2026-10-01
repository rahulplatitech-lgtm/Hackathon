import { post, postForm, get } from './client';
import type { IncidentReport } from '../../types';

export const createTextReport = (text: string, lat?: number, lng?: number) =>
  post<IncidentReport>('/api/reports/text', { text, reporter_lat: lat, reporter_lng: lng });

export const createVoiceReport = (audio: Blob, lat?: number, lng?: number, transcript?: string) => {
  const fd = new FormData();
  fd.append('audio', audio, 'recording.webm');
  if (transcript) fd.append('transcript', transcript);
  if (lat != null) fd.append('reporter_lat', String(lat));
  if (lng != null) fd.append('reporter_lng', String(lng));
  return postForm<IncidentReport>('/api/reports/voice', fd);
};

export const getReport = (id: string) => get<IncidentReport>(`/api/reports/${id}`);

export interface VoiceChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface VoiceChatResponse {
  reply: string;
  incident_type: string;
  severity: number;
  urgency: string;
  people_affected: number;
  required_resources: string[];
  ready_to_dispatch: boolean;
  dispatched: boolean;
  transition_to_command?: boolean;
  report_id?: string;
  incident_id?: string;
  extracted_location?: string;
  ai_confidence?: number;
  ai_thinking?: string;
  human_escalation_required?: boolean;
  escalation_reason?: string;
  escalated_to_operator?: boolean;
}

export interface EscalationItem {
  report_id: string;
  incident_id?: string;
  caller_text: string;
  transcript?: string;
  ai_confidence: number;
  ai_thinking: string;
  incident_type: string;
  severity: number;
  urgency: string;
  location_text: string;
  reporter_lat?: number;
  reporter_lng?: number;
  escalation_reason: string;
  status: string;
  created_at: string;
}

export const sendVoiceAssistantChat = (
  messages: VoiceChatMessage[],
  lat?: number,
  lng?: number,
  dispatch_now = false,
  incident_id?: string,
  report_id?: string
) =>
  post<VoiceChatResponse>('/api/reports/voice-assistant/chat', {
    messages,
    reporter_lat: lat,
    reporter_lng: lng,
    dispatch_now,
    incident_id,
    report_id,
  });

export const getEscalations = () => get<EscalationItem[]>('/api/reports/escalations');
export const resolveEscalation = (reportId: string) => post<{ status: string; report_id: string }>(`/api/reports/resolve-escalation/${reportId}`);

