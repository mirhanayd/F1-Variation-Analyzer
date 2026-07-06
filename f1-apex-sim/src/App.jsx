import { useMemo, useState } from 'react';
import './App.css';
import { TRACKS } from './utils/trackData';
import { useSeasonSchedule } from './hooks/useSeasonSchedule';
import { useTelemetryReplay } from './hooks/useTelemetryReplay';
import TrackCanvas from './components/TrackCanvas';
import TrackSelector from './components/TrackSelector';
import CircuitStatsPanel from './components/CircuitStatsPanel';
import CountdownCard from './components/CountdownCard';
import SchedulePanel from './components/SchedulePanel';
import TelemetryPanel from './components/TelemetryPanel';

function App() {
  const [selectedTrackKey, setSelectedTrackKey] = useState('monza');
  const [selectedSector, setSelectedSector] = useState(null);
  const currentTrack = TRACKS[selectedTrackKey];
  const seasonYear = new Date().getUTCFullYear();
  const schedule = useSeasonSchedule(seasonYear);
  const replay = useTelemetryReplay(currentTrack);

  const telemetryGeometry = useMemo(() => {
    if (replay.status === 'ready' && replay.circuitGeometry?.points?.length) {
      return replay.circuitGeometry;
    }

    return null;
  }, [replay.circuitGeometry, replay.status]);

  const handleTrackSelect = (trackKey) => {
    setSelectedTrackKey(trackKey);
    setSelectedSector(null);
  };

  return (
    <div className="dashboard-container">
      <TrackSelector
        selectedTrackKey={selectedTrackKey}
        onSelectTrack={handleTrackSelect}
      />

      <main className="map-section">
        <TrackCanvas
          track={currentTrack}
          onSectorClick={setSelectedSector}
          selectedSector={selectedSector}
          telemetryPositions={replay.positions}
          telemetryBounds={replay.telemetryBounds}
          telemetryGeometry={telemetryGeometry}
          replayStatus={replay.status}
        />
      </main>

      <aside className="stats-panel">
        <CircuitStatsPanel
          track={currentTrack}
          selectedSector={selectedSector}
        />
        <CountdownCard session={schedule.nextSession} />
        <SchedulePanel schedule={schedule} />
        <TelemetryPanel replay={replay} />
      </aside>
    </div>
  );
}

export default App;
