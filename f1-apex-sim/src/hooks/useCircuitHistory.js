import { useQuery } from '@tanstack/react-query';
import jolpicaApi from '../services/jolpicaApi';

export const useCircuitHistory = (circuitId) => useQuery({
  queryKey: ['circuit-history', circuitId],
  queryFn: () => jolpicaApi.getCircuitRaceHistory(circuitId),
  enabled: Boolean(circuitId),
  staleTime: 24 * 60 * 60 * 1000,
  retry: 1,
});
