import { Suspense, lazy, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../layout/PageShell';
import TrackCanvas from '../components/TrackCanvas';
import TelemetryPanel from '../components/TelemetryPanel';
import { useCircuits } from '../hooks/useCircuits';
import { useTelemetryReplay } from '../hooks/useTelemetryReplay';
import { useCircuitHistory } from '../hooks/useCircuitHistory';
import { useCanonicalCircuitGeometry } from '../hooks/useCanonicalCircuitGeometry';
import { createTrackMapData } from '../features/track-map/trackMapData';
import CircuitVisual from '../features/circuits/CircuitVisual';
import { CORNER_TYPE_LABELS, getCornersForCircuit, hasCuratedCorners } from '../data/cornerLibrary';
import { getCircuitSections } from '../data/circuitSections';
import { formatDateTime } from '../utils/dateTime';
import CircuitLiveTracking from '../features/live/CircuitLiveTracking';

const FullTrackSimulation = lazy(() => import('../features/simulation/FullTrackSimulation'));

const StatBlock = ({ label, value }) => (
  <div className="detail-stat">
    <span>{label}</span>
    <strong>{value ?? 'TBA'}</strong>
  </div>
);

const computeRaceDistance = (stats) => {
  if (stats?.raceDistance) return stats.raceDistance;

  const lengthKm = Number.parseFloat(stats?.length ?? '');
  const laps = Number.parseInt(stats?.laps ?? '', 10);
  if (!Number.isFinite(lengthKm) || !Number.isFinite(laps)) return null;

  return `${(lengthKm * laps).toFixed(3)} km`;
};

const HistoryPanel = ({ historyQuery }) => {
  const races = (historyQuery.data ?? []).slice(-8).reverse();

  return (
    <section className="detail-panel">
      <div className="section-heading">
        <span>Grand Prix archive</span>
        <h2>Race History</h2>
      </div>

      {historyQuery.isLoading && (
        <div className="panel-loading">
          <span className="pw-spinner" aria-hidden="true" />
          <p className="muted-text">Loading race history…</p>
        </div>
      )}
      {historyQuery.isError && (
        <p className="muted-text">Race history is not available for this circuit yet.</p>
      )}
      {!historyQuery.isLoading && !historyQuery.isError && races.length === 0 && (
        <p className="muted-text">No historical results found for this circuit.</p>
      )}

      <div className="history-list">
        {races.map((race) => (
          <article key={`${race.season}-${race.round}`}>
            <span>{race.season} · Round {race.round}</span>
            <strong>{race.raceName}</strong>
            <small>{formatDateTime(`${race.date}T${race.time ?? '12:00:00Z'}`, { timeStyle: undefined })}</small>
            <em>
              {race.Results?.[0]
                ? `Winner: ${race.Results[0].Driver.givenName} ${race.Results[0].Driver.familyName}`
                : 'Winner: TBA'}
            </em>
          </article>
        ))}
      </div>
    </section>
  );
};

// Sector breakdown, named corners, straights and DRS zones for the circuit.
const TrackSectionsPanel = ({ circuit, sections }) => (
  <section className="detail-panel track-sections-panel">
    <div className="section-heading">
      <span>{sections.curated ? 'Verified section data' : 'Provisional layout data'}</span>
      <h2>Sectors &amp; Named Sections</h2>
    </div>

    {!sections.curated && (
      <p className="muted-text">
        Official sector mapping for {circuit.shortName ?? circuit.name} has not been curated yet —
        this placeholder structure keeps the layout simulatable and will be replaced as data lands.
      </p>
    )}

    <div className="sector-cards">
      {sections.sectors.map((sector) => (
        <article key={sector.id} className="sector-card" style={{ '--sector-color': sector.color }}>
          <header>
            <span className="sector-chip" />
            <strong>{sector.name}</strong>
            <small>
              {Math.round(sector.range[0] * 100)}–{Math.round(sector.range[1] * 100)}% of lap
            </small>
          </header>
          <p>{sector.summary}</p>
        </article>
      ))}
    </div>

    <div className="section-columns">
      {sections.corners.length > 0 && (
        <div className="section-list">
          <h3>Key corners &amp; named turns</h3>
          <ul>
            {sections.corners.map((corner) => (
              <li key={`${corner.number}-${corner.name}`}>
                <span className="corner-number-chip">{corner.number}</span>
                <div>
                  <strong>{corner.name}</strong>
                  <small>{corner.character}</small>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="section-list">
        <h3>Straights</h3>
        <ul>
          {sections.straights.map((straight) => (
            <li key={straight.name}>
              <span className="corner-number-chip straight">▬</span>
              <div>
                <strong>{straight.name}</strong>
                <small>{straight.length}{straight.note ? ` · ${straight.note}` : ''}</small>
              </div>
            </li>
          ))}
        </ul>

        <h3>DRS zones</h3>
        {sections.drsZones.length > 0 ? (
          <ul>
            {sections.drsZones.map((zone) => (
              <li key={zone.name}>
                <span className="corner-number-chip drs">DRS</span>
                <div>
                  <strong>{zone.name}</strong>
                  <small>{zone.zone} · Detection: {zone.detection}</small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted-text">No DRS zone data recorded for this circuit.</p>
        )}
      </div>
    </div>
  </section>
);

const SignatureCorners = ({ circuit }) => {
  const corners = getCornersForCircuit(circuit.id);
  const curated = hasCuratedCorners(circuit.id);

  return (
    <section className="detail-panel">
      <div className="section-heading">
        <span>{curated ? 'Signature corners' : 'Corner archetypes'}</span>
        <h2>Simulate a Section</h2>
      </div>
      {!curated && (
        <p className="muted-text">
          This circuit has no curated corner data yet — these generic sections are still fully simulatable.
        </p>
      )}
      <div className="corner-grid">
        {corners.map((corner) => (
          <Link
            key={corner.id}
            className="corner-card"
            to={`/simulation?circuit=${circuit.slug ?? circuit.id}&corner=${corner.id}`}
          >
            <span className="corner-card-number">{corner.number}</span>
            <strong>{corner.name}</strong>
            <small>{CORNER_TYPE_LABELS[corner.type]} · {corner.direction === 'left' ? 'Left' : 'Right'} · ~{corner.radius} m radius</small>
            <em>Simulate →</em>
          </Link>
        ))}
      </div>
    </section>
  );
};

const CircuitDetailPage = () => {
  const { circuitSlug } = useParams();
  const { circuits, isLoading } = useCircuits();
  const circuit = circuits.find((item) => item.slug === circuitSlug || item.id === circuitSlug);
  const [selectedSector, setSelectedSector] = useState(null);
  const [replayAttempt, setReplayAttempt] = useState(0);
  const [viewMode, setViewMode] = useState(null);
  const replayRequested = replayAttempt > 0;

  const canonicalGeometry = useCanonicalCircuitGeometry(circuit);
  const circuitForRendering = useMemo(() => {
    if (!circuit || !canonicalGeometry.geometry) return circuit;
    return {
      ...circuit,
      geometry: canonicalGeometry.geometry.normalizedDisplayGeometry ?? canonicalGeometry.geometry,
      normalizedDisplayGeometry: canonicalGeometry.geometry.normalizedDisplayGeometry,
      stylisedGeometry: canonicalGeometry.geometry.stylisedGeometry,
      sectors: canonicalGeometry.geometry.sectors,
      turns: canonicalGeometry.geometry.turns,
    };
  }, [canonicalGeometry.geometry, circuit]);
  const trackMapData = useMemo(
    () => (circuitForRendering ? createTrackMapData(circuitForRendering) : null),
    [circuitForRendering],
  );
  const sections = useMemo(() => (circuit ? getCircuitSections(circuit) : null), [circuit]);
  const replay = useTelemetryReplay(trackMapData, {
    enabled: replayRequested,
    reloadKey: replayAttempt,
  });
  const historyQuery = useCircuitHistory(circuit?.id);

  const simulationPoints = canonicalGeometry.geometry?.normalizedDisplayGeometry?.points
    ?? canonicalGeometry.geometry?.points
    ?? null;
  const canSimulateFullTrack = Boolean(simulationPoints);

  if (!circuit && isLoading) {
    return (
      <PageShell eyebrow="Circuit library" title="Loading circuit…">
        <div className="skeleton skeleton-hero" role="status" aria-label="Loading circuit" />
      </PageShell>
    );
  }

  if (!circuit || !trackMapData) {
    return (
      <PageShell
        eyebrow="Off track"
        title="Circuit not found"
        description="This circuit is not in the PITWALL library yet."
      >
        <Link className="pw-button" to="/circuits">Back to circuits</Link>
      </PageShell>
    );
  }

  const geometryOverride = canonicalGeometry.geometry?.normalizedDisplayGeometry
    ?? canonicalGeometry.geometry
    ?? trackMapData.geometry;
  const canRenderTrack = Boolean(geometryOverride?.points?.length);
  const stats = circuit.stats ?? {};

  const viewModes = [
    ...(canRenderTrack ? [{ id: 'map', label: 'Track Map' }] : []),
    { id: 'stylised', label: 'Stylised Outline' },
    ...(simulationPoints ? [{ id: 'simulation', label: 'Full Track Simulation' }] : []),
    ...(canRenderTrack ? [{ id: 'tracking', label: 'Live / Replay Tracking' }] : []),
  ];
  const defaultMode = canRenderTrack ? 'map' : 'stylised';
  const activeMode = viewModes.some((mode) => mode.id === viewMode) ? viewMode : defaultMode;

  return (
    <PageShell
      eyebrow={circuit.active ? 'Current calendar circuit' : 'Historic circuit'}
      title={circuit.name}
      description={`${circuit.locality ? `${circuit.locality}, ` : ''}${circuit.country ?? 'Location TBA'}`}
      actions={(
        <Link
          className="pw-button"
          to={`/simulation?circuit=${circuit.slug ?? circuit.id}`}
        >
          Simulate this circuit
        </Link>
      )}
    >
      <section className="circuit-detail-grid">
        <div className="detail-panel circuit-map-panel">
          <div className="outline-mode-switch" role="tablist" aria-label="Track view mode">
            {viewModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={activeMode === mode.id}
                className={activeMode === mode.id ? 'active' : ''}
                onClick={() => setViewMode(mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {activeMode === 'map' && canRenderTrack && (
            <TrackCanvas
              track={trackMapData}
              onSectorClick={setSelectedSector}
              selectedSector={selectedSector}
              telemetryPositions={replay.positions}
              telemetryBounds={replay.telemetryBounds}
              telemetryGeometry={geometryOverride}
              replayStatus={replay.status}
            />
          )}

          {activeMode === 'stylised' && (
            <CircuitVisual
              circuit={circuitForRendering}
              label={canSimulateFullTrack ? 'Stylised outline' : 'No verified outline yet'}
            >
              {!canSimulateFullTrack && (
                <div className="fallback-copy">
                  No verified layout exists for this circuit yet, so PITWALL shows an
                  abstract placeholder instead of a made-up track shape.
                </div>
              )}
            </CircuitVisual>
          )}

          {activeMode === 'simulation' && simulationPoints && (
            <Suspense
              fallback={(
                <div className="full-sim-loading">
                  <span className="pw-spinner" aria-hidden="true" />
                  <p className="muted-text">Preparing the full-track simulation…</p>
                </div>
              )}
            >
              <FullTrackSimulation
                circuit={circuit}
                outlinePoints={simulationPoints}
                sections={sections}
              />
            </Suspense>
          )}

          {activeMode === 'tracking' && canRenderTrack && (
            <CircuitLiveTracking circuit={circuitForRendering} geometry={canonicalGeometry.geometry} />
          )}
        </div>

        <aside className="detail-sidebar">
          <section className="detail-panel">
            <div className="section-heading">
              <span>Circuit profile</span>
              <h2>Overview</h2>
            </div>
            <div className="detail-stats-grid">
              <StatBlock label="Length" value={stats.length} />
              <StatBlock label="Laps" value={stats.laps} />
              <StatBlock label="Race distance" value={computeRaceDistance(stats)} />
              <StatBlock label="First GP" value={stats.firstGP} />
              <StatBlock label="Corners" value={stats.corners} />
              <StatBlock label="DRS zones" value={stats.drsZones} />
            </div>
            <div className="lap-record-box">
              <div className="lap-record-title">Lap Record</div>
              <div className="lap-record-time">{stats.lapRecord?.time ?? 'TBA'}</div>
              <div className="lap-record-driver">{stats.lapRecord?.driver ?? 'No record set yet'}</div>
            </div>
          </section>

          <TelemetryPanel
            replay={replay}
            loadRequested={replayRequested && replay.status !== 'error'}
            onLoad={() => setReplayAttempt((attempt) => attempt + 1)}
          />
        </aside>
      </section>

      {sections && <TrackSectionsPanel circuit={circuit} sections={sections} />}

      <SignatureCorners circuit={circuit} />

      <HistoryPanel historyQuery={historyQuery} />
    </PageShell>
  );
};

export default CircuitDetailPage;
