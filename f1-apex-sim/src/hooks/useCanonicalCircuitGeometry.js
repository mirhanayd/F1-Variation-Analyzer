import { useQuery } from '@tanstack/react-query';
import { loadCircuitGeometry } from '../data/circuits';

export const useCanonicalCircuitGeometry = (circuit) => {
  const query = useQuery({
    queryKey: ['canonical-circuit-geometry', circuit?.id],
    queryFn: () => loadCircuitGeometry(circuit.id),
    enabled: Boolean(circuit?.id),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  return {
    ...query,
    status: !circuit?.id ? 'idle' : query.isPending ? 'loading' : query.isError ? 'error' : 'ready',
    geometry: query.data ?? null,
    error: query.error ?? null,
  };
};

export default useCanonicalCircuitGeometry;
