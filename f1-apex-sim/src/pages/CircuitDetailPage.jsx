import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageShell from '../layout/PageShell';
import TrackCanvas from '../components/TrackCanvas';
import TelemetryPanel from '../components/TelemetryPanel';
import { useCircuits } from '../hooks/useCircuits';
import { useTelemetryReplay } from '../hooks/useTelemetryReplay';
import { useCircuitHistory } from '../hooks/useCircuitHistory';
import { createTrackMapData } from '../features/track-map/trackMapData';
import CircuitVisual from '../features/circuits/CircuitVisual';
import { formatDateTime } from '../utils/dateTime';

const StatBlock = ({ label, value }) => (
  <div className="detail-stat">
    <span>{label}</span>
    <strong>{value ?? 'TBA'}</strong>
  </div>
);

const HistoryPanel = ({ historyQuery }) => {
  const races = (historyQuery.data ?? []).slice(-8).reverse();

  return (
    <section className="detail-panel">
      <div className="section-heading">
        <span>Jolpica archive</span>
        <h2>Race History</h2>
      </div>

      {historyQuery.isLoading && <p className="muted-text">Loading race history...</p>}
      {historyQuery.isError && <p className="muted-text">Race history is not available for this circuit yet.</p>}
      {!historyQuery.isLoading && races.length === 0 && (
        <p className="muted-text">No historical results found.</p>
      )}

      <div className="history-list">
        {races.map((race) => (
          <article key={`${race.season}-${race.round}`}>
            <strong>{race.season} {race.raceName}</strong>
            <span>{formatDateTime(`${race.date}T${race.time ?? '00:00:00Z'}`)}</span>
            <small>
              Winner:
              {' '}
              {race.Results?.[0]
                ? `${race.Results[0].Driver.givenName} ${race.Results[0].Driver.familyName}`
                : 'TBA'}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
};

const CircuitDetailPage = () => {
  const { circuitSlug } = useParams();
  const { circuits } = useCircuits();
  const circuit = circuits.find((item) => item.slug === circuitSlug || item.id === circuitSlug);
  const [selectedSector, setSelectedSector] = useState(null);
  const trackMapData = useMemo(() => (circuit ? createTrackMapData(circuit) : null), [circuit]);
  const replay = useTelemetryReplay(trackMapData);
  const historyQuery = useCircuitHistory(circuit?.id);
  const canRenderTrack = Boolean(trackMapData?.svgPath || replay.circuitGeometry?.points?.length);

  if (!circuit || !trackMapData) {
    return (
      <PageShell title="Circuit not found" description="This circuit is not in the APiEX registry yet.">
        <Link className="apiex-button" to="/circuits">Back to circuits</Link>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow={circuit.active ? 'Current calendar circuit' : 'Historic circuit'}
      title={circuit.name}
      description={`${circuit.locality || 'Location TBA'} / ${circuit.country}`}
      actions={<Link className="apiex-button ghost" to="/simulation">Open simulation lab</Link>}
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
              telemetryGeometry={replay.circuitGeometry}
              replayStatus={replay.status}
            />
          ) : (
            <CircuitVisual circuit={circuit} label="Geometry pending">
              <div className="fallback-copy">
                Track geometry is not mapped yet. APiEX will use telemetry geometry when OpenF1 replay data is available.
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
              <StatBlock label="Length" value={trackMapData.stats.length} />
              <StatBlock label="Laps" value={trackMapData.stats.laps} />
              <StatBlock label="First GP" value={trackMapData.stats.firstGP} />
              <StatBlock label="Corners" value={trackMapData.corners.length || 'TBA'} />
            </div>
            <div className="lap-record-box">
              <div className="lap-record-title">Lap Record</div>
              <div className="lap-record-time">{trackMapData.stats.lapRecord.time}</div>
              <div className="lap-record-driver">{trackMapData.stats.lapRecord.driver}</div>
            </div>
          </section>

          <TelemetryPanel replay={replay} />
        </aside>
      </section>

      <section className="detail-panel">
        <div className="section-heading">
          <span>Track anatomy</span>
          <h2>Sectors, Corners & DRS</h2>
        </div>
        <div className="anatomy-grid">
          {trackMapData.sectors.map((sector) => (
            <article key={sector.id} style={{ '--sector-color': sector.color }}>
              <span>{sector.label}</span>
              <strong>{sector.name}</strong>
              <small>{sector.corners.length || 'Mapped on geometry'} corners</small>
            </article>
          ))}
          {(trackMapData.drsZones ?? []).map((zone) => (
            <article key={zone.id} style={{ '--sector-color': zone.color }}>
              <span>DRS</span>
              <strong>{zone.name}</strong>
              <small>Detection and activation mapped</small>
            </article>
          ))}
        </div>
      </section>

      <HistoryPanel historyQuery={historyQuery} />
    </PageShell>
  );
};

export default CircuitDetailPage;
