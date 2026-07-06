import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../layout/PageShell';
import TrackCanvas from '../components/TrackCanvas';
import TelemetryPanel from '../components/TelemetryPanel';
import { useCircuits } from '../hooks/useCircuits';
import { useCircuitOutline } from '../hooks/useCircuitOutline';
import { useTelemetryReplay } from '../hooks/useTelemetryReplay';
import { useCircuitHistory } from '../hooks/useCircuitHistory';
import { createTrackMapData } from '../features/track-map/trackMapData';
import CircuitVisual from '../features/circuits/CircuitVisual';
import { CORNER_TYPE_LABELS, getCornersForCircuit, hasCuratedCorners } from '../data/cornerLibrary';
import { formatDateTime } from '../utils/dateTime';

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
  const replayRequested = replayAttempt > 0;

  const trackMapData = useMemo(() => (circuit ? createTrackMapData(circuit) : null), [circuit]);
  const outline = useCircuitOutline(trackMapData);
  const replay = useTelemetryReplay(trackMapData, {
    enabled: replayRequested,
    reloadKey: replayAttempt,
  });
  const historyQuery = useCircuitHistory(circuit?.id);

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

  const geometryOverride = replay.circuitGeometry ?? outline.geometry;
  const canRenderTrack = Boolean(trackMapData.svgPath || geometryOverride?.points?.length);
  const stats = circuit.stats ?? {};

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
          {canRenderTrack ? (
            <TrackCanvas
              track={trackMapData}
              onSectorClick={setSelectedSector}
              selectedSector={selectedSector}
              telemetryPositions={replay.positions}
              telemetryBounds={replay.telemetryBounds}
              telemetryGeometry={geometryOverride}
              replayStatus={replay.status}
            />
          ) : (
            <CircuitVisual circuit={circuit} label={outline.isLoading ? 'Loading track map…' : 'Stylised outline'}>
              <div className="fallback-copy">
                {outline.isLoading
                  ? 'Fetching the real track outline from OpenF1…'
                  : 'No mapped geometry is available for this circuit yet, so PITWALL shows a stylised outline instead.'}
              </div>
            </CircuitVisual>
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

      <SignatureCorners circuit={circuit} />

      <HistoryPanel historyQuery={historyQuery} />
    </PageShell>
  );
};

export default CircuitDetailPage;
