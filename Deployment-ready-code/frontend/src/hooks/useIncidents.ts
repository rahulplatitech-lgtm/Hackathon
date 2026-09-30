import { useQuery } from '@tanstack/react-query';
import { getIncidents } from '../lib/api/incidents';

export function useIncidents() {
  return useQuery({ queryKey: ['incidents'], queryFn: getIncidents, refetchInterval: 5000 });
}
