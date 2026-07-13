import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import dataManager from '../services/dataManager';
import {
  CURRENT_2026_CIRCUIT_IDS,
  getCuratedCircuitList,
  normalizeCircuitId,
} from '../data/circuitRegistry';
import { CIRCUIT_LIST } from '../data/circuits';

const normalizeJolpicaCircuit = (circuit) => {
  const id = normalizeCircuitId(circuit.circuitId);
  const active = CURRENT_2026_CIRCUIT_IDS.includes(id);

  return {
    id,
    slug: id,
    name: circuit.circuitName,
    shortName: circuit.circuitName,
    country: circuit.Location?.country ?? 'Unknown',
    locality: circuit.Location?.locality ?? '',
    coordinates: {
      lat: Number.parseFloat(circuit.Location?.lat),
      lng: Number.parseFloat(circuit.Location?.long),
    },
    url: circuit.url,
    active,
    historic: !active,
    source: 'jolpica',
  };
};

export const useCircuits = () => {
  const query = useQuery({
    queryKey: ['circuits'],
    queryFn: () => dataManager.getAllCircuits(),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const circuits = useMemo(() => {
    const byId = new Map();

    (query.data ?? []).forEach((circuit) => {
      const normalized = normalizeJolpicaCircuit(circuit);
      byId.set(normalized.id, normalized);
    });

    getCuratedCircuitList().forEach((circuit) => {
      const base = byId.get(circuit.id) ?? {};
      byId.set(circuit.id, {
        ...base,
        ...circuit,
        active: circuit.active ?? base.active ?? false,
        historic: circuit.historic ?? !(circuit.active ?? base.active),
        source: base.source ? `${base.source}+curated` : 'curated',
      });
    });

    // The user-supplied circuit.md registry is the canonical geometry source.
    // Legacy/Jolpica data still enriches statistics, but cannot replace its
    // names, source paths, status, aliases, or real track geometry.
    CIRCUIT_LIST.forEach((canonical) => {
      const base = byId.get(canonical.id) ?? {};
      const legacyStats = base.stats ?? {};
      byId.set(canonical.id, {
        ...base,
        ...canonical,
        stats: {
          length: canonical.trackLength.formatted,
          firstGP: canonical.firstGrandPrixYear ?? 'TBA',
          corners: canonical.turns.length,
          laps: 'TBA',
          ...legacyStats,
        },
        active: canonical.active,
        historic: canonical.historic,
        source: base.source ? `${base.source}+canonical-geojson` : 'canonical-geojson',
        geometrySource: canonical.source,
      });
    });

    return Array.from(byId.values()).sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [query.data]);

  return {
    ...query,
    circuits,
    activeCircuits: circuits.filter((circuit) => circuit.active),
    historicCircuits: circuits.filter((circuit) => !circuit.active),
  };
};
