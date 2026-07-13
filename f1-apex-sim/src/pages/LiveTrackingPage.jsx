import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageShell from '../layout/PageShell';
import TrackCanvas from '../components/TrackCanvas';
import { useCircuits } from '../hooks/useCircuits';
import { useLiveGateway } from '../hooks/useLiveGateway';
import { useCanonicalCircuitGeometry } from '../hooks/useCanonicalCircuitGeometry';
import { createTrackMapData } from '../features/track-map/trackMapData';
import { getCircuitByOpenF1Name } from '../data/circuits';
import LiveStatusBar from '../features/live/LiveStatusBar';
import {
  IntervalsPanel,
  LapSectorPanel,
  PositionPanel,
  TelemetryPanel,
} from '../features/live/LivePanels';
import { sourceLabel } from '../features/live/liveLabels';
import { useProjectedLivePositions } from '../features/live/useProjectedLivePositions';
import '../features/live/live.css';

const driverAtPosition = (snapshot, wantedPosition) => Object.entries(snapshot?.positionsByDriver ?? {})
  .find(([, position]) => Number(position?.position) === wantedPosition)?.[0] ?? null;

const LiveTrackingPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCircuit = searchParams.get('circuit');
  const { circuits, isLoading: circuitsLoading } = useCircuits();
  const live = useLiveGateway();
  const [selectedCircuitId, setSelectedCircuitId] = useState(requestedCircuit);
  const [selectedDriverNumber, setSelectedDriverNumber] = useState(null);

  const canonicalCircuits = useMemo(
    () => circuits.filter((circuit) => circuit.geojsonSourcePath || circuit.geojsonPath || circuit.geometrySource),
    [circuits],
  );
  const liveCircuit = useMemo(
    () => getCircuitByOpenF1Name(live.snapshot?.circuitShortName),
    [live.snapshot?.circuitShortName],
  );

  const selectedCircuit = useMemo(() => {
    const chosenId = selectedCircuitId ?? liveCircuit?.id;
    return canonicalCircuits.find((circuit) => (
      circuit.id === chosenId || circuit.slug === chosenId
    )) ?? canonicalCircuits.find((circuit) => circuit.active) ?? canonicalCircuits[0] ?? null;
  }, [canonicalCircuits, liveCircuit?.id, selectedCircuitId]);

  const driverNumbers = Object.keys(live.snapshot?.driversByNumber ?? {});
  const effectiveDriverNumber = driverNumbers.includes(String(selectedDriverNumber))
    ? selectedDriverNumber
    : driverAtPosition(live.snapshot, 1) ?? driverNumbers[0] ?? null;

  const geometryState = useCanonicalCircuitGeometry(selectedCircuit);
  const circuitWithGeometry = useMemo(() => (
    selectedCircuit && geometryState.geometry
      ? {
        ...selectedCircuit,
        geometry: geometryState.geometry.normalizedDisplayGeometry ?? geometryState.geometry,
        normalizedDisplayGeometry: geometryState.geometry.normalizedDisplayGeometry,
        stylisedGeometry: geometryState.geometry.stylisedGeometry,
        turns: geometryState.geometry.turns,
        sectors: geometryState.geometry.sectors,
      }
      : selectedCircuit
  ), [geometryState.geometry, selectedCircuit]);
  const track = useMemo(
    () => (circuitWithGeometry ? createTrackMapData(circuitWithGeometry) : null),
    [circuitWithGeometry],
  );
  const positions = useProjectedLivePositions({
    snapshot: live.snapshot,
    circuit: selectedCircuit,
    geometry: geometryState.geometry?.normalizedDisplayGeometry ?? geometryState.geometry,
  });

  const handleCircuitChange = (event) => {
    const id = event.target.value;
    setSelectedCircuitId(id);
    setSearchParams({ circuit: id }, { replace: true });
  };

  const isLive = live.snapshot?.source === 'openf1-live' && live.snapshot?.status === 'live';
  const gatewayMessage = live.snapshot?.messages?.at(-1)?.text;

  return (
    <PageShell
      eyebrow="Backend-secured timing"
      title="Live / Replay Tracking"
      description="Real OpenF1 positions and telemetry arrive through the PITWALL gateway. When no session is active, the same map switches to an explicitly labelled historical replay."
      actions={(
        <div className="live-page-actions">
          <label className="live-circuit-select">
            <span>Circuit geometry</span>
            <select
              value={selectedCircuit?.id ?? ''}
              onChange={handleCircuitChange}
              disabled={circuitsLoading || canonicalCircuits.length === 0}
            >
              {canonicalCircuits.map((circuit) => (
                <option key={circuit.id} value={circuit.id}>
                  {circuit.location ?? circuit.locality} · {circuit.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    >
      <LiveStatusBar
        snapshot={live.snapshot}
        connectionState={live.connectionState}
        error={live.error}
        reconnectInMs={live.reconnectInMs}
        onReconnect={live.reconnect}
      />

      {!isLive && (
        <div className="live-fallback-notice">
          <div>
            <strong>{live.snapshot?.status === 'replay' ? 'Historical replay fallback is active.' : 'Live timing is currently unavailable.'}</strong>
            <span>{gatewayMessage ?? 'The gateway will reconnect automatically and will never present replay data as live.'}</span>
          </div>
          {selectedCircuit && (
            <Link className="pw-button ghost" to={`/circuits/${selectedCircuit.slug ?? selectedCircuit.id}`}>
              Circuit details
            </Link>
          )}
        </div>
      )}

      <div className="live-workspace">
        <section className="live-map-panel" aria-label="Circuit live tracking map">
          {geometryState.status === 'loading' && (
            <div className="full-sim-loading" role="status">
              <span className="pw-spinner" aria-hidden="true" />
              <p className="muted-text">Loading canonical circuit geometry…</p>
            </div>
          )}
          {geometryState.status === 'error' && (
            <div className="full-sim-empty">
              <p>Real geometry for this circuit could not be loaded.</p>
            </div>
          )}
          {geometryState.status === 'ready' && track && (
            <TrackCanvas
              track={track}
              telemetryPositions={positions}
              telemetryGeometry={track.geometry}
              replayStatus={live.snapshot?.status}
              sourceLabel={sourceLabel(live.snapshot?.source)}
              selectedDriverNumber={effectiveDriverNumber}
              onVehicleSelect={setSelectedDriverNumber}
              onSectorClick={() => {}}
              selectedSector={null}
            />
          )}
        </section>

        <aside className="live-panel-stack">
          <PositionPanel
            snapshot={live.snapshot}
            selectedDriverNumber={effectiveDriverNumber}
            onSelectDriver={setSelectedDriverNumber}
          />
          <TelemetryPanel snapshot={live.snapshot} driverNumber={effectiveDriverNumber} />
          <IntervalsPanel snapshot={live.snapshot} driverNumber={effectiveDriverNumber} />
          <LapSectorPanel snapshot={live.snapshot} driverNumber={effectiveDriverNumber} />
        </aside>
      </div>
    </PageShell>
  );
};

export default LiveTrackingPage;
