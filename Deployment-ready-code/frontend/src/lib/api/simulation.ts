import { post } from './client';

export const seedData = (coords?: {lat: number, lng: number}) => post('/api/simulation/seed', coords || {});
export const addNewIncident = (data?: Record<string, unknown>) => post('/api/simulation/new-incident', data);
export const makeResourceUnavailable = (resourceId: string) =>
  post('/api/simulation/resource-unavailable', { resource_id: resourceId });
export const changeSeverity = (incidentId: string, severity: number) =>
  post('/api/simulation/change-severity', { incident_id: incidentId, new_severity: severity });
export const resetSimulation = () => post('/api/simulation/reset');
