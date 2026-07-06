import { useQuery } from '@tanstack/react-query';
import dataManager from '../services/dataManager';

// Fetches the real circuit outline (MultiViewer geometry via OpenF1) for circuits
// that have raced since 2023. Returns null geometry for unmapped circuits.
export const useCircuitOutline = (track) => {
  const query = useQuery({
    queryKey: ['circuit-outline', track?.id],
    queryFn: () => dataManager.getCircuitOutline(track),
    enabled: Boolean(track?.openF1),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  return {
    ...query,
    outline: query.data ?? null,
    geometry: query.data?.geometry ?? null,
  };
};
