import { useQuery } from '@tanstack/react-query';
import { getReviewQueue } from '../lib/api/human-review';

export function useReviewQueue() {
  return useQuery({ queryKey: ['reviewQueue'], queryFn: getReviewQueue, refetchInterval: 5000 });
}
