import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageShell from '../layout/PageShell';
import TrackCanvas from '../components/TrackCanvas';
import { useCircuits } from '../hooks/useCircuits';
import { useLiveGateway } from '../hooks/useLiveGateway';
import { useTelemetryReplay } from '../hooks/useTelemetryReplay';
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
import ReplayTelemetryPanel from '../components/TelemetryPanel';
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
  const [replayAttempt, setReplayAttempt] = useState(0);

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
  const gatewayIsLive = live.snapshot?.source === 'openf1-live'
    && live.snapshot?.status === 'live';
  // Never overlay a live feed on guessed geometry. Wait for the gateway's
  // session/meeting metadata to identify the circuit, then require an exact
  // canonical registry match.
  const liveMatchesSelectedCircuit = Boolean(
    liveCircuit?.id && selectedCircuit?.id && liveCircuit.id === selectedCircuit.id,
  );
  const isLive = gatewayIsLive && liveMatchesSelectedCircuit;
  const gatewayResolved = Boolean(live.snapshot?.updatedAt)
    || live.connectionState === 'reconnecting'
    || Boolean(live.error);
  const replayEnabled = Boolean(track) && !isLive && gatewayResolved;
  const replay = useTelemetryReplay(track, {
    enabled: replayEnabled,
    reloadKey: replayAttempt,
  });
  const replayPlaceholder = useMemo(() => {
    const isLoadingReplay = replayEnabled && replay.status === 'loading';
    const isReplayError = replay.status === 'error';
    return {
      source: isLoadingReplay ? 'openf1-historical-replay' : 'offline-demo',
      status: isLoadingReplay ? 'connecting' : isReplayError ? 'error' : 'idle',
      meetingName: selectedCircuit?.grandPrix ?? selectedCircuit?.name ?? 'Selected circuit',
      sessionName: isLoadingReplay ? 'Loading selected-circuit replay' : 'No replay loaded',
      updatedAt: null,
      latencyMs: null,
      driversByNumber: {},
      locationsByDriver: {},
      carDataByDriver: {},
      positionsByDriver: {},
      intervalsByDriver: {},
      lapsByDriver: {},
      messages: [{
        level: isReplayError ? 'error' : 'info',
        text: isReplayError
          ? (replay.error?.message ?? 'No historical replay is available for this circuit.')
          : 'Waiting for the selected circuit\'s historical replay. Replay data is never presented as live.',
      }],
    };
  }, [replay.error, replay.status, replayEnabled, selectedCircuit]);
  const displaySnapshot = isLive ? live.snapshot : replay.snapshot ?? replayPlaceholder;
  const displayConnectionState = isLive
    ? live.connectionState
    : replay.snapshot ? 'replay' : replay.status === 'error' ? 'error' : 'connecting';
  const driverNumbers = Object.keys(displaySnapshot?.driversByNumber ?? {});
  const effectiveDriverNumber = driverNumbers.includes(String(selectedDriverNumber))
    ? selectedDriverNumber
    : driverAtPosition(displaySnapshot, 1) ?? driverNumbers[0] ?? null;
  const positions = useProjectedLivePositions({
    snapshot: displaySnapshot,
    circuit: selectedCircuit,
    geometry: geometryState.geometry?.normalizedDisplayGeometry ?? geometryState.geometry,
    calibrationSamples: isLive ? null : replay.calibrationSamples,
  });

  const handleCircuitChange = (event) => {
    const id = event.target.value;
    setSelectedCircuitId(id);
    setSearchParams({ circuit: id }, { replace: true });
  };

  const gatewayMessage = displaySnapshot?.messages?.at(-1)?.text;
  const handleReconnect = () => {
    live.reconnect();
    setReplayAttempt((attempt) => attempt + 1);
  };

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
        snapshot={displaySnapshot}
        connectionState={displayConnectionState}
        error={isLive ? live.error : replay.error ?? live.error}
        reconnectInMs={live.reconnectInMs}
        onReconnect={handleReconnect}
      />

      {!isLive && (
        <div className="live-fallback-notice">
          <div>
            <strong>{replay.snapshot ? 'Historical replay fallback is active.' : replay.status === 'loading' ? 'Loading the selected circuit replay.' : 'Live timing is currently unavailable.'}</strong>
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
              replayStatus={displaySnapshot?.status}
              sourceLabel={sourceLabel(displaySnapshot?.source)}
              selectedDriverNumber={effectiveDriverNumber}
              onVehicleSelect={setSelectedDriverNumber}
              onSectorClick={() => {}}
              selectedSector={null}
            />
          )}
        </section>

        <aside className="live-panel-stack">
          <PositionPanel
            snapshot={displaySnapshot}
            selectedDriverNumber={effectiveDriverNumber}
            onSelectDriver={setSelectedDriverNumber}
          />
          <TelemetryPanel snapshot={displaySnapshot} driverNumber={effectiveDriverNumber} />
          <IntervalsPanel snapshot={displaySnapshot} driverNumber={effectiveDriverNumber} />
          <LapSectorPanel snapshot={displaySnapshot} driverNumber={effectiveDriverNumber} />
          {!isLive && replayEnabled && (
            <ReplayTelemetryPanel
              replay={replay}
              loadRequested
              onLoad={() => setReplayAttempt((attempt) => attempt + 1)}
            />
          )}
        </aside>
      </div>
    </PageShell>
  );
};

export default LiveTrackingPage;
