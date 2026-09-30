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
  report_id?: string;
  incident_id?: string;
  extracted_location?: string;
}

export const sendVoiceAssistantChat = (
  messages: VoiceChatMessage[],
  lat?: number,
  lng?: number,
  dispatch_now = false
) =>
  post<VoiceChatResponse>('/api/reports/voice-assistant/chat', {
    messages,
    reporter_lat: lat,
    reporter_lng: lng,
    dispatch_now,
  });
