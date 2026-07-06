import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageShell from '../layout/PageShell';
import { useCircuits } from '../hooks/useCircuits';
import SimulationScene from '../features/simulation/SimulationScene';
import { CORNER_TYPE_LABELS, getCornersForCircuit, hasCuratedCorners } from '../data/cornerLibrary';
import {
  calculateSimulation,
  getDefaultParamsForCorner,
  PARAMETER_LIMITS,
} from '../features/simulation/simulationMath';

const PARAMETER_CONFIG = [
  { key: 'entrySpeed', label: 'Entry speed', hint: 'Speed carried toward the braking zone' },
  { key: 'brakingPoint', label: 'Braking point', hint: 'Metres before the corner where you hit the brakes' },
  { key: 'apexBias', label: 'Apex point', hint: '0 = early apex, 100 = late apex' },
  { key: 'steeringAngle', label: 'Steering angle', hint: 'Lock carried through the corner' },
  { key: 'throttle', label: 'Throttle', hint: 'Commitment on corner exit' },
  { key: 'racingLine', label: 'Racing line', hint: '0 = tight inside, 100 = wide arc' },
  { key: 'exitSpeed', label: 'Exit speed target', hint: 'Speed you aim for at the end of the section' },
];

const ParameterControl = ({ config, value, limits, onChange, disabled }) => (
  <label className="parameter-control">
    <span>
      {config.label}
      <strong>{value} {limits.unit}</strong>
    </span>
    <input
      type="range"
      min={limits.min}
      max={limits.max}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(config.key, Number(event.target.value))}
      aria-label={config.label}
    />
    <small>{config.hint}</small>
  </label>
);

const RacingLinePreview = ({ result }) => {
  const { path, markers } = result;

  const view = useMemo(() => {
    const xs = path.points.map((point) => point.x);
    const ys = path.points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 24;
    const width = maxX - minX + pad * 2;
    const height = maxY - minY + pad * 2;

    const project = (point) => ({
      x: point.x - minX + pad,
      y: height - (point.y - minY + pad),
    });

    const line = path.points
      .map((point, index) => {
        const projected = project(point);
        return `${index === 0 ? 'M' : 'L'} ${projected.x.toFixed(1)} ${projected.y.toFixed(1)}`;
      })
      .join(' ');

    const markerAt = (distance) => {
      let best = path.points[0];
      for (const point of path.points) {
        if (Math.abs(point.s - distance) < Math.abs(best.s - distance)) best = point;
      }
      return project(best);
    };

    return {
      viewBox: `0 0 ${width.toFixed(0)} ${height.toFixed(0)}`,
      line,
      brake: markerAt(markers.brakeDistance),
      apex: markerAt(markers.apexDistance),
      exit: markerAt(markers.arcEnd),
    };
  }, [path, markers]);

  return (
    <div className="racing-line-preview">
      <svg viewBox={view.viewBox} aria-label="Top-down racing line preview" preserveAspectRatio="xMidYMid meet">
        <path className="preview-track" d={view.line} />
        <path className="preview-line" d={view.line} />
        <circle cx={view.brake.x} cy={view.brake.y} r="9" className="brake-point" />
        <circle cx={view.apex.x} cy={view.apex.y} r="9" className="apex-point" />
        <circle cx={view.exit.x} cy={view.exit.y} r="9" className="exit-point" />
      </svg>
      <div className="preview-metrics">
        <span><i className="dot brake" /> Brake</span>
        <span><i className="dot apex" /> Apex</span>
        <span><i className="dot exit" /> Exit</span>
        <span>Min {result.minSpeed} km/h</span>
      </div>
    </div>
  );
};

const StartLights = ({ litCount, allOff }) => (
  <div className={`start-lights ${allOff ? 'lights-out' : ''}`} aria-hidden="true">
    {Array.from({ length: 5 }, (_, index) => (
      <span key={index} className={index < litCount ? 'lit' : ''} />
    ))}
  </div>
);

const ResultOverlay = ({ result, onRestart, onAdjust }) => (
  <div className="sim-result-overlay">
    <div className="sim-result-card">
      <span className="section-kicker">Section time</span>
      <strong className="sim-result-time">{result.formattedTime}s</strong>
      <div className={`sim-result-delta ${result.delta < 0.45 ? 'good' : ''}`}>
        {result.formattedDelta}s vs optimal ({result.formattedOptimal}s)
      </div>
      <div className={`sim-result-rating rating-${result.rating.grade.replace(/\s/g, '').toLowerCase()}`}>
        {result.rating.grade}
      </div>
      <p>{result.rating.note}</p>

      <div className="sim-result-stats">
        <div><span>Apex speed</span><strong>{result.apexSpeed} km/h</strong></div>
        <div><span>Min speed</span><strong>{result.minSpeed} km/h</strong></div>
        <div><span>Final speed</span><strong>{result.finalSpeed} km/h</strong></div>
        <div><span>Peak lateral</span><strong>{result.peakLateralG} G</strong></div>
      </div>

      <div className="phase-bars">
        {result.phases.map((phase) => (
          <div key={phase.label}>
            <span>{phase.label}</span>
            <div>
              <i style={{ width: `${Math.min(100, (phase.value / result.totalTime) * 100)}%` }} />
            </div>
            <strong>{phase.value.toFixed(2)}s</strong>
          </div>
        ))}
      </div>

      {result.flags.ranWide && (
        <p className="sim-flag warn">The car ran wide mid-corner — try braking earlier or lowering entry speed.</p>
      )}
      {!result.flags.ranWide && result.flags.overSlowed && (
        <p className="sim-flag">You over-slowed the entry — carry more speed or brake later.</p>
      )}

      <div className="sim-result-actions">
        <button type="button" className="pw-button" onClick={onRestart}>Run again</button>
        <button type="button" className="pw-button ghost" onClick={onAdjust}>Adjust setup</button>
      </div>
    </div>
  </div>
);

const SimulationPage = () => {
  const { circuits } = useCircuits();
  const [searchParams, setSearchParams] = useSearchParams();

  // The URL is the source of truth for circuit + corner selection so links
  // from circuit detail pages (and refreshes) always land on the right setup.
  const requestedCircuit = searchParams.get('circuit');
  const selectedCircuit = circuits.find(
    (circuit) => circuit.slug === requestedCircuit || circuit.id === requestedCircuit,
  )
    ?? circuits.find((circuit) => circuit.id === 'monza')
    ?? circuits[0]
    ?? { id: 'monza', name: 'Autodromo Nazionale Monza', shortName: 'Monza' };

  const corners = useMemo(() => getCornersForCircuit(selectedCircuit.id), [selectedCircuit.id]);
  const requestedCorner = searchParams.get('corner');
  const corner = corners.find((item) => item.id === requestedCorner) ?? corners[0];

  const [params, setParams] = useState(() => getDefaultParamsForCorner(corner));
  const [runState, setRunState] = useState('setup');
  const [litCount, setLitCount] = useState(0);
  const [telemetry, setTelemetry] = useState({ speed: 0, elapsed: 0, progress: 0 });
  const countdownTimers = useRef([]);

  // Derived-state reset: when the selected corner changes, re-seed the setup.
  const [prevCornerId, setPrevCornerId] = useState(corner.id);
  if (prevCornerId !== corner.id) {
    setPrevCornerId(corner.id);
    setParams(getDefaultParamsForCorner(corner));
    setRunState('setup');
    setLitCount(0);
  }

  const result = useMemo(() => calculateSimulation(corner, params), [corner, params]);

  const brakingLimits = {
    ...PARAMETER_LIMITS.brakingPoint,
    max: Math.min(PARAMETER_LIMITS.brakingPoint.max, Math.max(40, corner.entryLength - 10)),
  };

  const clearCountdown = useCallback(() => {
    countdownTimers.current.forEach((timer) => window.clearTimeout(timer));
    countdownTimers.current = [];
  }, []);

  useEffect(() => () => clearCountdown(), [clearCountdown]);

  const resetToSetup = useCallback(() => {
    clearCountdown();
    setRunState('setup');
    setLitCount(0);
  }, [clearCountdown]);

  const selectCircuit = (circuitId) => {
    const nextCorners = getCornersForCircuit(circuitId);
    const circuit = circuits.find((item) => item.id === circuitId);
    resetToSetup();
    setParams(getDefaultParamsForCorner(nextCorners[0]));
    setSearchParams(
      { circuit: circuit?.slug ?? circuitId, corner: nextCorners[0].id },
      { replace: true },
    );
  };

  const selectCorner = (cornerId) => {
    const nextCorner = corners.find((item) => item.id === cornerId);
    if (!nextCorner) return;
    resetToSetup();
    setParams(getDefaultParamsForCorner(nextCorner));
    setSearchParams(
      { circuit: selectedCircuit.slug ?? selectedCircuit.id, corner: cornerId },
      { replace: true },
    );
  };

  const updateParam = (key, value) => {
    setParams((current) => ({ ...current, [key]: value }));
    if (runState === 'finished') resetToSetup();
  };

  const startRun = () => {
    if (runState === 'countdown' || runState === 'running') return;
    clearCountdown();
    setRunState('countdown');
    setLitCount(0);
    setTelemetry({ speed: 0, elapsed: 0, progress: 0 });

    for (let i = 1; i <= 5; i += 1) {
      countdownTimers.current.push(
        window.setTimeout(() => setLitCount(i), i * 520),
      );
    }
    countdownTimers.current.push(
      window.setTimeout(() => {
        setLitCount(0);
        setRunState('running');
      }, 5 * 520 + 700),
    );
  };

  const handleRunComplete = useCallback(() => setRunState('finished'), []);
  const handleTelemetry = useCallback((data) => setTelemetry(data), []);

  const isBusy = runState === 'countdown' || runState === 'running';

  return (
    <PageShell
      eyebrow="Simulation lab"
      title="Corner Simulator"
      description="Pick a circuit and a corner, tune how the car attacks it, then watch the 3D run and the section time it produces."
    >
      <section className="simulation-layout">
        <div className="simulation-panel controls-panel">
          <div className="section-heading">
            <span>Setup</span>
            <h2>Configure the run</h2>
          </div>

          <label className="select-control">
            Circuit
            <select
              value={selectedCircuit.id}
              disabled={isBusy}
              onChange={(event) => selectCircuit(event.target.value)}
            >
              {circuits.map((circuit) => (
                <option key={circuit.id} value={circuit.id}>
                  {circuit.name}{circuit.active ? '' : ' (historic)'}
                </option>
              ))}
            </select>
          </label>

          <div className="corner-select" role="radiogroup" aria-label="Corner selection">
            <span className="corner-select-label">
              Section
              {!hasCuratedCorners(selectedCircuit.id) && <em> · generic archetypes</em>}
            </span>
            <div className="corner-chip-row">
              {corners.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={corner.id === item.id}
                  className={`corner-chip ${corner.id === item.id ? 'active' : ''}`}
                  disabled={isBusy}
                  onClick={() => selectCorner(item.id)}
                >
                  <strong>{item.number}</strong>
                  <span>{item.name}</span>
                  <small>{CORNER_TYPE_LABELS[item.type]}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="parameter-list">
            {PARAMETER_CONFIG.map((config) => (
              <ParameterControl
                key={config.key}
                config={config}
                value={params[config.key]}
                limits={config.key === 'brakingPoint' ? brakingLimits : PARAMETER_LIMITS[config.key]}
                onChange={updateParam}
                disabled={isBusy}
              />
            ))}
          </div>

          <RacingLinePreview result={result} />

          <div className="sim-launch-row">
            <button
              type="button"
              className="pw-button launch"
              onClick={startRun}
              disabled={isBusy}
            >
              {isBusy ? 'Running…' : runState === 'finished' ? 'Run again' : 'Start simulation'}
            </button>
            <div className="sim-predicted">
              <span>Predicted</span>
              <strong>{result.formattedTime}s</strong>
            </div>
          </div>
        </div>

        <div className={`simulation-stage ${runState}`}>
          <SimulationScene
            result={result}
            runState={runState}
            onRunComplete={handleRunComplete}
            onTelemetry={handleTelemetry}
          />

          {runState === 'countdown' && <StartLights litCount={litCount} allOff={false} />}

          {runState === 'running' && (
            <div className="sim-hud">
              <div className="sim-hud-speed">
                <strong>{telemetry.speed}</strong>
                <span>km/h</span>
              </div>
              <div className="sim-hud-time">
                <strong>{telemetry.elapsed.toFixed(2)}s</strong>
                <div className="sim-progress">
                  <i style={{ width: `${Math.min(100, telemetry.progress * 100)}%` }} />
                </div>
              </div>
            </div>
          )}

          {runState === 'finished' && (
            <ResultOverlay
              result={result}
              onRestart={startRun}
              onAdjust={resetToSetup}
            />
          )}

          {runState === 'setup' && (
            <div className="sim-stage-hint">
              <span>{selectedCircuit.shortName ?? selectedCircuit.name} · {corner.name}</span>
              <p>Drag to orbit · pinch or scroll to zoom</p>
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
};

export default SimulationPage;
