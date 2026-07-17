import { useMemo, useState } from 'react';
import LiveTrack3D from './LiveTrack3D';
import ReplayTelemetryPanel from '../../components/TelemetryPanel';
import { useLiveGateway } from '../../hooks/useLiveGateway';
import { useTelemetryReplay } from '../../hooks/useTelemetryReplay';
import { getCircuitByOpenF1Name } from '../../data/circuits';
import { createTrackMapData } from '../track-map/trackMapData';
import LiveStatusBar from './LiveStatusBar';
import { sourceLabel } from './liveLabels';
import { IntervalsPanel, LapSectorPanel, PositionPanel, TelemetryPanel } from './LivePanels';
import { useProjectedLivePositions } from './useProjectedLivePositions';
import './live.css';

const CircuitLiveTracking = ({ circuit, geometry }) => {
  const live = useLiveGateway({ circuitId: circuit?.id });
  const [selectedDriverNumber, setSelectedDriverNumber] = useState(null);
  const [replayAttempt, setReplayAttempt] = useState(0);
  const displayGeometry = geometry?.normalizedDisplayGeometry ?? geometry;
  const track = useMemo(() => createTrackMapData({
    ...circuit,
    geometry: displayGeometry,
    normalizedDisplayGeometry: displayGeometry,
    turns: geometry?.turns ?? circuit?.turns,
  }), [circuit, displayGeometry, geometry?.turns]);
  const liveCircuit = getCircuitByOpenF1Name(live.snapshot?.circuitShortName);
  const gatewayIsLive = live.snapshot?.source === 'openf1-live'
    && live.snapshot?.status === 'live';
  const isLive = gatewayIsLive && Boolean(
    liveCircuit?.id && circuit?.id && liveCircuit.id === circuit.id,
  );
  const gatewayResolved = Boolean(live.snapshot?.updatedAt)
    || live.connectionState === 'reconnecting'
    || Boolean(live.error);
  const replayEnabled = Boolean(track?.openF1) && !isLive && gatewayResolved;
  const replay = useTelemetryReplay(track, {
    enabled: replayEnabled,
    reloadKey: replayAttempt,
  });
  const replayPlaceholder = useMemo(() => ({
    source: replayEnabled && replay.status === 'loading'
      ? 'openf1-historical-replay'
      : 'offline-demo',
    status: replayEnabled && replay.status === 'loading'
      ? 'connecting'
      : replay.status === 'error' ? 'error' : 'idle',
    meetingName: circuit?.grandPrix ?? circuit?.name ?? 'Selected circuit',
    sessionName: replayEnabled && replay.status === 'loading'
      ? 'Loading selected-circuit replay'
      : 'No replay loaded',
    updatedAt: null,
    latencyMs: null,
    driversByNumber: {},
    locationsByDriver: {},
    carDataByDriver: {},
    positionsByDriver: {},
    intervalsByDriver: {},
    lapsByDriver: {},
    messages: [{
      level: replay.status === 'error' ? 'error' : 'info',
      text: replay.status === 'error'
        ? (replay.error?.message ?? 'No historical replay is available for this circuit.')
        : 'Waiting for the selected circuit\'s historical replay. Replay data is never presented as live.',
    }],
  }), [circuit, replay.error, replay.status, replayEnabled]);
  const displaySnapshot = isLive ? live.snapshot : replay.snapshot ?? replayPlaceholder;
  const displayConnectionState = isLive
    ? live.connectionState
    : replay.snapshot ? 'replay' : replay.status === 'error' ? 'error' : 'connecting';
  const positions = useProjectedLivePositions({
    snapshot: displaySnapshot,
    circuit,
    geometry: displayGeometry,
    calibrationSamples: isLive ? null : replay.calibrationSamples,
  });

  const driverNumbers = Object.keys(displaySnapshot?.driversByNumber ?? {});
  const effectiveDriverNumber = driverNumbers.includes(String(selectedDriverNumber))
    ? selectedDriverNumber
    : driverNumbers[0] ?? null;

  return (
    <div className="embedded-live-tracking">
      <LiveStatusBar
        snapshot={displaySnapshot}
        connectionState={displayConnectionState}
        error={isLive ? live.error : replay.error ?? live.error}
        reconnectInMs={live.reconnectInMs}
        onReconnect={() => {
          live.reconnect();
          setReplayAttempt((attempt) => attempt + 1);
        }}
      />
      <div className="live-workspace">
        <section className="live-map-panel">
          <LiveTrack3D
            track={track}
            telemetryPositions={positions}
            selectedDriverNumber={effectiveDriverNumber}
            onSelectDriver={setSelectedDriverNumber}
            onVehicleSelect={setSelectedDriverNumber}
          />
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
    </div>
  );
};

export default CircuitLiveTracking;
