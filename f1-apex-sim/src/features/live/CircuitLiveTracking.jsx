import { useMemo, useState } from 'react';
import TrackCanvas from '../../components/TrackCanvas';
import { useLiveGateway } from '../../hooks/useLiveGateway';
import { createTrackMapData } from '../track-map/trackMapData';
import LiveStatusBar from './LiveStatusBar';
import { sourceLabel } from './liveLabels';
import { IntervalsPanel, LapSectorPanel, PositionPanel, TelemetryPanel } from './LivePanels';
import { useProjectedLivePositions } from './useProjectedLivePositions';
import './live.css';

const CircuitLiveTracking = ({ circuit, geometry }) => {
  const live = useLiveGateway({ circuitId: circuit?.id });
  const [selectedDriverNumber, setSelectedDriverNumber] = useState(null);
  const displayGeometry = geometry?.normalizedDisplayGeometry ?? geometry;
  const track = useMemo(() => createTrackMapData({
    ...circuit,
    geometry: displayGeometry,
    normalizedDisplayGeometry: displayGeometry,
    turns: geometry?.turns ?? circuit?.turns,
  }), [circuit, displayGeometry, geometry?.turns]);
  const positions = useProjectedLivePositions({
    snapshot: live.snapshot,
    circuit,
    geometry: displayGeometry,
  });

  const driverNumbers = Object.keys(live.snapshot?.driversByNumber ?? {});
  const effectiveDriverNumber = driverNumbers.includes(String(selectedDriverNumber))
    ? selectedDriverNumber
    : driverNumbers[0] ?? null;

  return (
    <div className="embedded-live-tracking">
      <LiveStatusBar
        snapshot={live.snapshot}
        connectionState={live.connectionState}
        error={live.error}
        reconnectInMs={live.reconnectInMs}
        onReconnect={live.reconnect}
      />
      <div className="live-workspace">
        <section className="live-map-panel">
          <TrackCanvas
            track={track}
            telemetryPositions={positions}
            telemetryGeometry={displayGeometry}
            replayStatus={live.snapshot?.status}
            sourceLabel={sourceLabel(live.snapshot?.source)}
            selectedDriverNumber={effectiveDriverNumber}
            onVehicleSelect={setSelectedDriverNumber}
            onSectorClick={() => {}}
            selectedSector={null}
          />
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
    </div>
  );
};

export default CircuitLiveTracking;
