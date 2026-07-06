import { useMemo, useState } from 'react';
import PageShell from '../layout/PageShell';
import { useCircuits } from '../hooks/useCircuits';
import { CircuitGrid } from '../features/circuits/CircuitCards';

const MODES = [
  { id: 'all', label: 'All' },
  { id: 'current', label: 'Current' },
  { id: 'historic', label: 'Historic' },
];

const filterCircuits = (circuits, query, mode) => {
  const safeQuery = query.trim().toLowerCase();

  return circuits.filter((circuit) => {
    if (mode === 'current' && !circuit.active) return false;
    if (mode === 'historic' && circuit.active) return false;
    if (!safeQuery) return true;

    return [
      circuit.name,
      circuit.shortName,
      circuit.country,
      circuit.locality,
    ].some((value) => value?.toLowerCase().includes(safeQuery));
  });
};

const CircuitsSkeleton = () => (
  <div className="skeleton-grid circuits" role="status" aria-label="Loading circuits">
    {Array.from({ length: 8 }, (_, index) => (
      <div key={index} className="skeleton skeleton-card" />
    ))}
  </div>
);

const CircuitsPage = () => {
  const { circuits, activeCircuits, historicCircuits, status, refetch } = useCircuits();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('all');

  const filtered = useMemo(() => filterCircuits(circuits, query, mode), [circuits, mode, query]);
  const showSkeleton = status === 'pending' && circuits.length === 0;
  const showError = status === 'error' && circuits.length === 0;

  return (
    <PageShell
      eyebrow="Circuit library"
      title="Circuits"
      description="Every Formula 1 venue in one place — the current calendar plus historic circuits like Istanbul Park, Imola and Sepang."
      actions={(
        <div className="catalog-summary">
          <span>{activeCircuits.length} current</span>
          <span>{historicCircuits.length} historic</span>
        </div>
      )}
    >
      <section className="catalog-toolbar">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search circuit, country or city"
          aria-label="Search circuits"
        />
        <div className="segmented-control" role="tablist" aria-label="Circuit filter">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={mode === item.id ? 'active' : ''}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {showSkeleton && <CircuitsSkeleton />}

      {showError && (
        <div className="page-state error">
          <strong>The circuit registry could not be loaded.</strong>
          <p>Curated circuits are still available — try refreshing for the full list.</p>
          <button type="button" className="pw-button ghost" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      )}

      {!showSkeleton && filtered.length === 0 && (
        <div className="page-state">
          <strong>No circuits match this filter.</strong>
          <p>Try a different search term or switch back to “All”.</p>
        </div>
      )}

      {filtered.length > 0 && <CircuitGrid circuits={filtered} />}
    </PageShell>
  );
};

export default CircuitsPage;
