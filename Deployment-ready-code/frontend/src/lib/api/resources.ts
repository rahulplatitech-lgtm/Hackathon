import { get, patch } from './client';
import type { EmergencyResource } from '../../types';

export const getResources = () => get<EmergencyResource[]>('/api/resources');
export const updateResourceStatus = (id: string, status: string) =>
  patch<EmergencyResource>(`/api/resources/${id}/status`, { status });
