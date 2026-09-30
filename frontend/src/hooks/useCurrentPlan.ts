import { useQuery } from '@tanstack/react-query';
import { getCurrentPlan } from '../lib/api/planning';

export function useCurrentPlan() {
  return useQuery({ queryKey: ['currentPlan'], queryFn: getCurrentPlan, refetchInterval: 5000 });
}
