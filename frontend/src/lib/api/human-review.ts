import { get, post } from './client';
import type { HumanReview } from '../../types';

export const getReviewQueue = () => get<HumanReview[]>('/api/human-review');
export const confirmReview = (id: string) => post<Record<string, unknown>>(`/api/human-review/${id}/confirm`);
export const modifyReview = (id: string, data: Record<string, unknown>, notes?: string) =>
  post<Record<string, unknown>>(`/api/human-review/${id}/modify`, { corrected_data: data, notes });
export const rejectReview = (id: string) => post<Record<string, unknown>>(`/api/human-review/${id}/reject`);
export const callReporter = (id: string) => post<Record<string, unknown>>(`/api/human-review/${id}/call`);
