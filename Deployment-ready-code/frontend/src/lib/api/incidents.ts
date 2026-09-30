import { get, post, patch } from './client';
import type { Incident } from '../../types';

export const getIncidents = () => get<Incident[]>('/api/incidents');
export const getIncident = (id: string) => get<Incident>(`/api/incidents/${id}`);
export const createIncident = (data: Record<string, unknown>) => post<Incident>('/api/incidents', data);
export const updateIncident = (id: string, data: Record<string, unknown>) => patch<Incident>(`/api/incidents/${id}`, data);
