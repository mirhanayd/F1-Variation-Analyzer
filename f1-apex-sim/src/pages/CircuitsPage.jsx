import { useMemo, useState } from 'react';
import PageShell from '../layout/PageShell';
import { useCircuits } from '../hooks/useCircuits';
import { CircuitGrid } from '../features/circuits/CircuitCards';

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

const CircuitsPage = () => {
  const { circuits, activeCircuits, historicCircuits, status } = useCircuits();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('all');

  const filtered = useMemo(() => filterCircuits(circuits, query, mode), [circuits, mode, query]);

  return (
    <PageShell
      eyebrow="Circuit atlas"
      title="Circuits"
      description="Current calendar venues, historic circuits and curated APiEX-ready track data in one searchable garage."
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
        <div className="segmented-control">
          {['all', 'current', 'historic'].map((item) => (
            <button
              key={item}
              type="button"
              className={mode === item ? 'active' : ''}
              onClick={() => setMode(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {status === 'loading' && <div className="page-state">Loading circuit registry...</div>}
      {status === 'error' && <div className="page-state error">Circuit registry could not be loaded.</div>}
      {status !== 'loading' && filtered.length === 0 && (
        <div className="page-state">No circuits match this filter.</div>
      )}

      <CircuitGrid circuits={filtered} />
    </PageShell>
  );
};

export default CircuitsPage;
