import { useEffect, useState } from 'react';
import dataManager from '../../services/dataManager';
import { useLiveGateway } from '../../hooks/useLiveGateway';
import { getDriverHeadshot, getTeamColor, getDriverAbbrev } from '../../utils/driverImages';

export const NextGPLiveStandings = ({ round }) => {
  const live = useLiveGateway();
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchStandings = async () => {
      setLoading(true);
      try {
        if (!round) return;
        const season = round.season ?? new Date().getUTCFullYear();
        const roundNum = round.round;

        // Fetch race classification if completed/active. No fallback to overall standings.
        const results = await dataManager.getRaceClassification(Number(season), Number(roundNum)).catch(() => []);
        
        if (active) {
          setStandings(results || []);
        }
      } catch (err) {
        console.error('Failed to load live/current standings:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchStandings();
    return () => { active = false; };
  }, [round]);

  // If live gateway has live position data, overlay real-time live positions!
  const hasLivePositions = live.snapshot?.positionsByDriver && Object.keys(live.snapshot.positionsByDriver).length > 0;
  
  const displayList = hasLivePositions
    ? Object.entries(live.snapshot.positionsByDriver)
        .map(([drvNum, posData]) => {
          const driverInfo = live.snapshot.driversByNumber?.[drvNum] ?? {};
          return {
            position: String(posData.position ?? 99),
            points: '-',
            Driver: {
              givenName: driverInfo.first_name ?? 'Driver',
              familyName: driverInfo.last_name ?? `#${drvNum}`,
              code: driverInfo.name_acronym ?? `D${drvNum}`,
              driverId: drvNum,
            },
            Constructor: {
              name: driverInfo.team_name ?? 'F1 Team',
            },
            status: posData.status ?? 'TRACK',
          };
        })
        .sort((a, b) => Number(a.position) - Number(b.position))
    : standings;

  return (
    <div className="next-gp-live-standings">
      <div className="live-standings-header">
        <div className="title-box">
          <span className="live-pulse-chip">
            <span className="pulse-dot" />
            {hasLivePositions ? 'LIVE TRACKING' : 'ROUND STANDINGS'}
          </span>
          <h4>Live Classification</h4>
        </div>
        <span className="scroll-hint">Top 10 (Scroll for P11-20)</span>
      </div>

      {loading ? (
        <div className="live-standings-skeleton">
          <span className="pw-spinner" />
          <span>Loading live order...</span>
        </div>
      ) : displayList.length === 0 ? (
        <div className="live-standings-empty">
          <span style={{ fontSize: '1.2rem', marginBottom: '8px' }}>🏁</span>
          Live positions will appear here once the session begins.
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
                    <strong>{entry.points !== '-' ? `${entry.points} pts` : entry.status}</strong>
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
