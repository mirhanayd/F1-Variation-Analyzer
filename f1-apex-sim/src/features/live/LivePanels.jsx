const asNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const valueOrDash = (value, suffix = '') => (
  value === undefined || value === null || value === '' ? '—' : `${value}${suffix}`
);

const formatSeconds = (value) => {
  const seconds = asNumber(value);
  if (seconds === null) return valueOrDash(value);
  const minutes = Math.floor(seconds / 60);
  const remainder = (seconds % 60).toFixed(3).padStart(6, '0');
  return minutes > 0 ? `${minutes}:${remainder}` : `${remainder}s`;
};

const orderedDriverNumbers = (snapshot) => {
  const drivers = snapshot?.driversByNumber ?? {};
  const positions = snapshot?.positionsByDriver ?? {};
  return Object.keys(drivers).sort((left, right) => {
    const leftPosition = asNumber(positions[left]?.position) ?? 999;
    const rightPosition = asNumber(positions[right]?.position) ?? 999;
    return leftPosition - rightPosition || Number(left) - Number(right);
  });
};

export const PositionPanel = ({ snapshot, selectedDriverNumber, onSelectDriver }) => {
  const numbers = orderedDriverNumbers(snapshot);

  return (
    <section className="live-data-panel position-panel">
      <header><span>Classification</span><strong>Position</strong></header>
      {numbers.length === 0 ? (
        <p className="live-empty-copy">Position data will appear when a session or replay starts.</p>
      ) : (
        <ol className="position-list">
          {numbers.map((driverNumber) => {
            const driver = snapshot.driversByNumber[driverNumber] ?? {};
            const position = snapshot.positionsByDriver?.[driverNumber]?.position;
            const color = driver.teamColor ?? driver.team_colour ?? driver.color ?? '#ffffff';
            return (
              <li key={driverNumber}>
                <button
                  type="button"
                  className={String(selectedDriverNumber) === String(driverNumber) ? 'selected' : ''}
                  onClick={() => onSelectDriver?.(driverNumber)}
                  style={{ '--team-color': color.startsWith('#') ? color : `#${color}` }}
                >
                  <b>{valueOrDash(position)}</b>
                  <span>{driver.acronym ?? driver.nameAcronym ?? driver.name_acronym ?? driverNumber}</span>
                  <small>{driver.teamName ?? driver.team_name ?? 'Team unavailable'}</small>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

export const TelemetryPanel = ({ snapshot, driverNumber }) => {
  const telemetry = snapshot?.carDataByDriver?.[driverNumber] ?? {};
  const driver = snapshot?.driversByNumber?.[driverNumber] ?? {};
  const isDrsOpen = [10, 12, 14].includes(Number(telemetry.drs));
  const metrics = [
    ['Speed', valueOrDash(telemetry.speed, ' km/h')],
    ['Throttle', valueOrDash(telemetry.throttle, '%')],
    ['Brake', Number(telemetry.brake) > 0 ? 'On' : telemetry.brake === undefined ? '—' : 'Off'],
    ['Gear', valueOrDash(telemetry.gear ?? telemetry.nGear ?? telemetry.n_gear)],
    ['RPM', valueOrDash(telemetry.rpm)],
    ['DRS', telemetry.drs === undefined ? '—' : isDrsOpen ? 'Open' : 'Closed'],
  ];

  return (
    <section className="live-data-panel telemetry-detail-panel">
      <header>
        <span>Selected driver</span>
        <strong>{driver.acronym ?? driver.nameAcronym ?? driver.name_acronym ?? (driverNumber ? `#${driverNumber}` : 'Telemetry')}</strong>
      </header>
      {!driverNumber ? (
        <p className="live-empty-copy">Select a driver marker or classification row.</p>
      ) : (
        <div className="telemetry-metric-grid">
          {metrics.map(([label, value]) => (
            <div key={label}><span>{label}</span><strong>{value}</strong></div>
          ))}
        </div>
      )}
    </section>
  );
};

export const IntervalsPanel = ({ snapshot, driverNumber }) => {
  const intervals = snapshot?.intervalsByDriver?.[driverNumber] ?? {};
  const position = snapshot?.positionsByDriver?.[driverNumber] ?? {};

  return (
    <section className="live-data-panel intervals-panel">
      <header><span>Race order</span><strong>Gaps</strong></header>
      <dl className="live-definition-list">
        <div><dt>Position</dt><dd>{valueOrDash(position.position)}</dd></div>
        <div><dt>Gap to leader</dt><dd>{valueOrDash(intervals.gapToLeader ?? intervals.gap_to_leader)}</dd></div>
        <div><dt>Car ahead</dt><dd>{valueOrDash(intervals.interval ?? intervals.intervalToAhead ?? intervals.intervalToCarAhead ?? intervals.interval_to_car_ahead)}</dd></div>
      </dl>
    </section>
  );
};

export const LapSectorPanel = ({ snapshot, driverNumber }) => {
  const lap = snapshot?.lapsByDriver?.[driverNumber] ?? {};
  const sectors = [
    lap.sector1 ?? lap.durationSector1 ?? lap.duration_sector_1,
    lap.sector2 ?? lap.durationSector2 ?? lap.duration_sector_2,
    lap.sector3 ?? lap.durationSector3 ?? lap.duration_sector_3,
  ];

  return (
    <section className="live-data-panel lap-sector-panel">
      <header><span>Timing</span><strong>Lap {valueOrDash(lap.lapNumber ?? lap.lap_number)}</strong></header>
      <div className="lap-time-primary">
        <span>Lap time</span>
        <strong>{formatSeconds(lap.lapDuration ?? lap.lap_duration)}</strong>
      </div>
      <div className="sector-time-row">
        {sectors.map((sector, index) => (
          <div key={`sector-${index + 1}`}>
            <span>S{index + 1}</span>
            <strong>{formatSeconds(sector)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
};
