import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wsConnection } from '../lib/api/websocket';

export function useWebSocket() {
  const [status, setStatus] = useState(wsConnection.status);
  const qc = useQueryClient();

  useEffect(() => {
    wsConnection.connect();
    wsConnection.onStatusChange((s: string) => setStatus(s as any));
    wsConnection.onEvent((event) => {
      if (event.startsWith('incident')) qc.invalidateQueries({ queryKey: ['incidents'] });
      if (event.startsWith('resource')) qc.invalidateQueries({ queryKey: ['resources'] });
      if (event.startsWith('plan')) qc.invalidateQueries({ queryKey: ['currentPlan'] });
      if (event === 'human_review.required') qc.invalidateQueries({ queryKey: ['reviewQueue'] });
      if (event === 'simulation.reset') {
        qc.invalidateQueries({ queryKey: ['incidents'] });
        qc.invalidateQueries({ queryKey: ['resources'] });
        qc.invalidateQueries({ queryKey: ['currentPlan'] });
      }
    });
    return () => wsConnection.disconnect();
  }, [qc]);

  return { status };
}
