import { get } from './client';

export interface RouteGeometryResponse {
  distance_km: number;
  eta_minutes: number;
  route_status: string;
  route_geometry: Array<[number, number]>; // Array of [lat, lng] points following actual roads
}

export const getRoadRoute = (fromLat: number, fromLng: number, toLat: number, toLng: number) =>
  get<RouteGeometryResponse>(`/api/routing/route?from_lat=${fromLat}&from_lng=${fromLng}&to_lat=${toLat}&to_lng=${toLng}`);
