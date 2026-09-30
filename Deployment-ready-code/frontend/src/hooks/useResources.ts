import { useQuery } from '@tanstack/react-query';
import { getResources } from '../lib/api/resources';

export function useResources() {
  return useQuery({ queryKey: ['resources'], queryFn: getResources, refetchInterval: 5000 });
}
