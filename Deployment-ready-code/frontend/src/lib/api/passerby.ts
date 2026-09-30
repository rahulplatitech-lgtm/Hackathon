import { get, post } from './client';
import type { PasserbyCitizen, PasserbyBroadcast, EmergencyOutlet } from '../../types';

export async function getNearbyPasserby(lat: number, lng: number, radiusMeters: number = 100): Promise<PasserbyCitizen[]> {
  return get<PasserbyCitizen[]>(`/api/passerby/nearby?lat=${lat}&lng=${lng}&radius=${radiusMeters}`);
}

export async function broadcastPasserbyAlert(payload: {
  incident_id?: string;
  latitude: number;
  longitude: number;
  radius_meters?: number;
  emergency_type?: string;
  severity?: number;
  custom_message?: string;
}): Promise<PasserbyBroadcast> {
  return post<PasserbyBroadcast>('/api/passerby/broadcast', payload);
}

export async function getEmergencyOutlets(lat: number = 12.9716, lng: number = 77.5946, typeFilter?: string): Promise<EmergencyOutlet[]> {
  const query = typeFilter ? `&type_filter=${encodeURIComponent(typeFilter)}` : '';
  return get<EmergencyOutlet[]>(`/api/passerby/outlets?lat=${lat}&lng=${lng}${query}`);
}
