import { get, post } from './client';

export const generatePlan = () => post<Record<string, unknown>>('/api/planning/generate');
export const replan = (trigger?: string) => post<Record<string, unknown>>(`/api/planning/replan?trigger=${trigger || 'manual'}`);
export const getCurrentPlan = () => get<Record<string, unknown>>('/api/planning/current');
export const approvePlan = (changeId: string, approved: boolean, constraints?: string) =>
  post<Record<string, unknown>>(`/api/planning/approve/${changeId}`, { approved, constraints });
