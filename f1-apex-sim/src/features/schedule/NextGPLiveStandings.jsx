import { useEffect, useState } from 'react';
import dataManager from '../../services/dataManager';
import { useLiveGateway } from '../../hooks/useLiveGateway';
import { getDriverHeadshot, getTeamColor, getDriverAbbrev } from '../../utils/driverImages';

const RESULTS_POLL_INTERVAL_MS = 30_000;

export const NextGPLiveStandings = ({ round }) => {
  const live = useLiveGateway();
  const [standings, setStandings] = useState([]);
  const [classificationType, setClassificationType] = useState('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let pollTimer = null;

    const fetchStandings = async ({ initial = false } = {}) => {
      if (initial) setLoading(true);

      try {
        if (!round) {
          if (active) {
            setStandings([]);
            setClassificationType('none');
          }
          return;
        }

        const season = round.season ?? new Date().getUTCFullYear();
        const roundNum = round.round;
        const cacheTimeout = round.status === 'current' ? 20_000 : 10 * 60 * 1000;
        const nowMs = Date.now();
        const sessionHasStarted = (sessionName) => {
          const session = round.sessions?.find((entry) => entry.session_name === sessionName);
          const startMs = Date.parse(session?.date_start ?? '');
          return !Number.isFinite(startMs) || startMs <= nowMs;
        };

        // Jolpica publishes classifications rather than second-by-second timing.
        // Prefer race results once available; until then show qualifying results.
        const [raceResults, qualifyingResults] = await Promise.all([
          sessionHasStarted('Race')
            ? dataManager.getRaceClassification(Number(season), Number(roundNum), { cacheTimeout }).catch(() => [])
            : Promise.resolve([]),
          sessionHasStarted('Qualifying')
            ? dataManager.getQualifyingClassification(Number(season), Number(roundNum), { cacheTimeout }).catch(() => [])
            : Promise.resolve([]),
        ]);

        if (active) {
          if (raceResults.length > 0) {
            setStandings(raceResults);
            setClassificationType('race');
          } else if (qualifyingResults.length > 0) {
            setStandings(qualifyingResults);
            setClassificationType('qualifying');
          } else {
            setStandings([]);
            setClassificationType('none');
          }
        }
      } catch (err) {
        console.error('Failed to load live/current standings:', err);
      } finally {
        if (active && initial) setLoading(false);
      }
    };

    fetchStandings({ initial: true });

    if (round?.status === 'current') {
      pollTimer = window.setInterval(fetchStandings, RESULTS_POLL_INTERVAL_MS);
    }

    return () => {
      active = false;
      window.clearInterval(pollTimer);
    };
  }, [round]);

  // Historical replay positions must never be labelled as the current live order.
  const hasLivePositions = live.snapshot?.status === 'live'
    && live.snapshot?.positionsByDriver
    && Object.keys(live.snapshot.positionsByDriver).length > 0;

  const displayList = hasLivePositions
    ? Object.entries(live.snapshot.positionsByDriver)
        .map(([drvNum, posData]) => {
          const driverInfo = live.snapshot.driversByNumber?.[drvNum] ?? {};
          return {
            position: String(posData.position ?? 99),
            points: '-',
            Driver: {
              givenName: driverInfo.firstName ?? driverInfo.first_name ?? 'Driver',
              familyName: driverInfo.lastName ?? driverInfo.last_name ?? `#${drvNum}`,
              code: driverInfo.acronym ?? driverInfo.name_acronym ?? `D${drvNum}`,
              driverId: drvNum,
            },
            Constructor: {
              name: driverInfo.teamName ?? driverInfo.team_name ?? 'F1 Team',
            },
            status: posData.status ?? 'TRACK',
          };
        })
        .sort((a, b) => Number(a.position) - Number(b.position))
    : standings;

  const sourceLabel = hasLivePositions
    ? 'LIVE TRACKING'
    : classificationType === 'qualifying'
      ? 'QUALIFYING RESULTS'
      : classificationType === 'race'
        ? 'RACE RESULTS'
        : 'SESSION RESULTS';

  return (
    <div className="next-gp-live-standings">
      <div className="live-standings-header">
        <div className="title-box">
          <span className="live-pulse-chip">
            <span className="pulse-dot" />
            {sourceLabel}
          </span>
          <h4>{hasLivePositions ? 'Live Classification' : 'Current Classification'}</h4>
        </div>
        <span className="scroll-hint">Top 10 (Scroll for P11-20)</span>
      </div>

      {loading ? (
        <div className="live-standings-skeleton">
          <span className="pw-spinner" />
          <span>Loading current order...</span>
        </div>
      ) : displayList.length === 0 ? (
        <div className="live-standings-empty" aria-live="polite">
          <span style={{ fontSize: '1.2rem', marginBottom: '8px' }}>🏁</span>
          {round?.status === 'current'
            ? 'Results will appear as soon as the public timing feed publishes them.'
            : 'Session results will appear here once qualifying begins.'}
        </div>
      ) : (
        <div className="live-standings-scroll-container">
          <div className="live-standings-table">
            {displayList.map((entry, idx) => {
              const pos = entry.position ?? idx + 1;
              const familyName = entry.Driver?.familyName ?? '';
              const teamName = entry.Constructor?.name ?? '';
              const code = getDriverAbbrev(entry.Driver);
              const teamColor = getTeamColor(teamName);
              const headshot = getDriverHeadshot(familyName, teamName, round?.season);
              const resultValue = hasLivePositions
                ? entry.status ?? 'TRACK'
                : classificationType === 'qualifying'
                  ? entry.Q3 ?? entry.Q2 ?? entry.Q1 ?? '—'
                  : entry.points !== undefined
                    ? `${entry.points} pts`
                    : entry.status ?? '—';

              return (
                <div key={entry.Driver?.driverId ?? idx} className="live-standings-row">
                  <div className="col-pos">
                    <span className={`pos-badge pos-${pos}`}>{pos}</span>
                  </div>
                  <div className="col-driver">
                    <div className="driver-mini-avatar">
                      {headshot ? (
                        <img
                          src={headshot}
                          alt={familyName}
                          className="mini-headshot-img"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <span
                        className="mini-initials-fallback"
                        style={{
                          background: `linear-gradient(135deg, ${teamColor}44, ${teamColor}cc)`,
                          borderColor: teamColor,
                          display: headshot ? 'none' : 'flex',
                        }}
                      >
                        {code.slice(0, 2)}
                      </span>
                    </div>
                    <div className="driver-mini-meta">
                      <strong>{code}</strong>
                      <span>{entry.Driver?.givenName} {familyName}</span>
                    </div>
                  </div>
                  <div className="col-team">
                    <span className="team-bar" style={{ backgroundColor: teamColor }} />
                    <span className="team-name-text">{teamName}</span>
                  </div>
                  <div className="col-pts">
                    <strong>{resultValue}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
