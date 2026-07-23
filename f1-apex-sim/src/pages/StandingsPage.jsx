import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageShell from '../layout/PageShell';
import dataManager from '../services/dataManager';
import jolpicaApi from '../services/jolpicaApi';
import { CIRCUIT_MANIFEST } from '../data/circuits';
import { PreviousRoundCard } from '../features/schedule/RoundCards';
import { normalizeSchedule } from '../features/schedule/scheduleModel';
const STATIC_TEAM_COLORS = {
  mercedes: '#00D2BE',
  ferrari: '#DC0000',
  mclaren: '#FF8700',
  red_bull: '#0600EF',
  aston_martin: '#006F62',
  alpine: '#0090FF',
  williams: '#005AFF',
  sauber: '#52E252',
  kick_sauber: '#52E252',
  rb: '#6692FF',
  racing_bulls: '#6692FF',
  haas: '#FFFFFF',
  renault: '#FFF500',
  force_india: '#FF8700',
  racing_point: '#F596C8',
  alfa_romeo: '#900000',
  alphatauri: '#4E7C9B',
  toro_rosso: '#469BFF',
};

const NATIONALITY_TO_FLAG = {
  british: '🇬🇧',
  dutch: '🇳🇱',
  monaco: '🇲🇨',
  monegasque: '🇲🇨',
  spanish: '🇪🇸',
  german: '🇩🇪',
  french: '🇫🇷',
  australian: '🇦🇺',
  canadian: '🇨🇦',
  mexican: '🇲🇽',
  japanese: '🇯🇵',
  chinese: '🇨🇳',
  finnish: '🇫🇮',
  danish: '🇩🇰',
  american: '🇺🇸',
  thai: '🇹🇭',
  italian: '🇮🇹',
  swiss: '🇨🇭',
  austrian: '🇦🇹',
  brazilian: '🇧🇷',
  belgian: '🇧🇪',
  new_zealand: '🇳🇿',
  kiwi: '🇳🇿',
  argentine: '🇦🇷',
};

const getTeamColor = (teamName = '') => {
  const norm = teamName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  for (const [key, value] of Object.entries(STATIC_TEAM_COLORS)) {
    if (norm.includes(key)) return value;
  }
  return '#94a3b8'; // fallback grey
};

const getFlagEmoji = (nationality = '') => {
  const norm = nationality.toLowerCase().trim();
  return NATIONALITY_TO_FLAG[norm] ?? '🏁';
};

const DRIVER_HEADSHOTS = {
  verstappen: 'https://www.formula1.com/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png.transform/1col/image.png',
  hamilton: 'https://www.formula1.com/content/dam/fom-website/drivers/L/LEWHAM01_Lewis_Hamilton/lewham01.png.transform/1col/image.png',
  russell: 'https://www.formula1.com/content/dam/fom-website/drivers/G/GEORUS01_George_Russell/georus01.png.transform/1col/image.png',
  leclerc: 'https://www.formula1.com/content/dam/fom-website/drivers/C/CHALEC01_Charles_Leclerc/chalec01.png.transform/1col/image.png',
  sainz: 'https://www.formula1.com/content/dam/fom-website/drivers/C/CARSAI01_Carlos_Sainz/carsai01.png.transform/1col/image.png',
  norris: 'https://www.formula1.com/content/dam/fom-website/drivers/L/LANNOR01_Lando_Norris/lannor01.png.transform/1col/image.png',
  piastri: 'https://www.formula1.com/content/dam/fom-website/drivers/O/OSCPIA01_Oscar_Piastri/oscpia01.png.transform/1col/image.png',
  perez: 'https://www.formula1.com/content/dam/fom-website/drivers/S/SERPER01_Sergio_Perez/serper01.png.transform/1col/image.png',
  alonso: 'https://www.formula1.com/content/dam/fom-website/drivers/F/FERALO01_Fernando_Alonso/feralo01.png.transform/1col/image.png',
  stroll: 'https://www.formula1.com/content/dam/fom-website/drivers/L/LANSTR01_Lance_Stroll/lanstr01.png.transform/1col/image.png',
  gasly: 'https://www.formula1.com/content/dam/fom-website/drivers/P/PIEGAS01_Pierre_Gasly/piegas01.png.transform/1col/image.png',
  ocon: 'https://www.formula1.com/content/dam/fom-website/drivers/E/ESTOCO01_Esteban_Ocon/estoco01.png.transform/1col/image.png',
  albon: 'https://www.formula1.com/content/dam/fom-website/drivers/A/ALEALB01_Alexander_Albon/alealb01.png.transform/1col/image.png',
  sargeant: 'https://www.formula1.com/content/dam/fom-website/drivers/L/LOGSAR01_Logan_Sargeant/logsar01.png.transform/1col/image.png',
  tsunoda: 'https://www.formula1.com/content/dam/fom-website/drivers/Y/YUKTSU01_Yuki_Tsunoda/yuktsu01.png.transform/1col/image.png',
  ricciardo: 'https://www.formula1.com/content/dam/fom-website/drivers/D/DANRIC01_Daniel_Ricciardo/danric01.png.transform/1col/image.png',
  bottas: 'https://www.formula1.com/content/dam/fom-website/drivers/V/VALBOT01_Valtteri_Bottas/valbot01.png.transform/1col/image.png',
  zhou: 'https://www.formula1.com/content/dam/fom-website/drivers/Z/ZHOGUA01_Guanyu_Zhou/zhogua01.png.transform/1col/image.png',
  magnussen: 'https://www.formula1.com/content/dam/fom-website/drivers/K/KEVMAG01_Kevin_Magnussen/kevmag01.png.transform/1col/image.png',
  hulkenberg: 'https://www.formula1.com/content/dam/fom-website/drivers/N/NICHUL01_Nico_Hulkenberg/nichul01.png.transform/1col/image.png',
  bearman: 'https://www.formula1.com/content/dam/fom-website/drivers/O/OLIBEA01_Oliver_Bearman/olibea01.png.transform/1col/image.png',
  colapinto: 'https://www.formula1.com/content/dam/fom-website/drivers/F/FRACOL01_Franco_Colapinto/fracol01.png.transform/1col/image.png',
  lawson: 'https://www.formula1.com/content/dam/fom-website/drivers/L/LIALAW01_Liam_Lawson/lialaw01.png.transform/1col/image.png',
  hadjar: 'https://www.formula1.com/content/dam/fom-website/drivers/I/ISAHAD01_Isack_Hadjar/isahad01.png.transform/1col/image.png',
  antonelli: 'https://www.formula1.com/content/dam/fom-website/drivers/A/ANDANT01_Andrea_Kimi_Antonelli/andant01.png.transform/1col/image.png',
  doohan: 'https://www.formula1.com/content/dam/fom-website/drivers/J/JACDOO01_Jack_Doohan/jacdoo01.png.transform/1col/image.png',
};

const DRIVER_CODES = {
  verstappen: 'maxver01',
  hamilton: 'lewham01',
  russell: 'georus01',
  leclerc: 'chalec01',
  sainz: 'carsai01',
  norris: 'lannor01',
  piastri: 'oscpia01',
  perez: 'serper01',
  alonso: 'feralo01',
  stroll: 'lanstr01',
  gasly: 'piegas01',
  ocon: 'estoco01',
  albon: 'alealb01',
  sargeant: 'logsar01',
  tsunoda: 'yuktsu01',
  ricciardo: 'danric01',
  bottas: 'valbot01',
  zhou: 'zhogua01',
  magnussen: 'kevmag01',
  hulkenberg: 'nichul01',
  bearman: 'olibea01',
  colapinto: 'fracol01',
  lawson: 'lialaw01',
  hadjar: 'isahad01',
  antonelli: 'andant01',
  lindblad: 'arvlin01',
  bortoleto: 'gabbor01',
  doohan: 'jacdoo01',
};

const getDriverHeadshot = (familyName, year = '2024') => {
  return DRIVER_HEADSHOTS[familyName.toLowerCase()] ?? null;
};

const get2026DriverHeadshot = (familyName, teamName) => {
  const code = DRIVER_CODES[familyName.toLowerCase()];
  if (!code) return null;
  
  const normTeam = teamName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  let teamSlug = 'mercedes';
  if (normTeam.includes('red_bull')) teamSlug = 'redbullracing';
  else if (normTeam.includes('ferrari')) teamSlug = 'ferrari';
  else if (normTeam.includes('mclaren')) teamSlug = 'mclaren';
  else if (normTeam.includes('aston_martin')) teamSlug = 'astonmartin';
  else if (normTeam.includes('alpine')) teamSlug = 'alpine';
  else if (normTeam.includes('williams')) teamSlug = 'williams';
  else if (normTeam.includes('haas')) teamSlug = 'haas';
  else if (normTeam.includes('sauber') || normTeam.includes('audi') || normTeam.includes('stake')) teamSlug = 'audi';
  else if (normTeam.includes('cadillac')) teamSlug = 'cadillac';
  else if (normTeam.includes('rb') || normTeam.includes('racing_bulls') || normTeam.includes('alphatauri') || normTeam.includes('toro_rosso') || normTeam.includes('racingbulls')) teamSlug = 'racingbulls';
  
  return `https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/${teamSlug}/${code}/2026${teamSlug}${code}right.webp`;
};

const getTeamLogoUrl = (teamName = '') => {
  const norm = teamName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  let teamSlug = 'mercedes';
  if (norm.includes('red_bull')) teamSlug = 'redbullracing';
  else if (norm.includes('ferrari')) teamSlug = 'ferrari';
  else if (norm.includes('mclaren')) teamSlug = 'mclaren';
  else if (norm.includes('aston_martin')) teamSlug = 'astonmartin';
  else if (norm.includes('alpine')) teamSlug = 'alpine';
  else if (norm.includes('williams')) teamSlug = 'williams';
  else if (norm.includes('haas')) teamSlug = 'haas';
  else if (norm.includes('sauber') || norm.includes('stake') || norm.includes('kick')) teamSlug = 'kicksauber';
  else if (norm.includes('audi')) teamSlug = 'audi';
  else if (norm.includes('cadillac')) teamSlug = 'cadillac';
  else if (norm.includes('rb') || norm.includes('racing_bulls') || norm.includes('alphatauri') || norm.includes('toro_rosso') || norm.includes('racingbulls')) teamSlug = 'racingbulls';
  
  return `https://media.formula1.com/image/upload/c_lfill,h_224/q_auto/d_common:f1:2026:fallback:car:2026fallbackcarright.webp/v1740000001/common/f1/2026/${teamSlug}/2026${teamSlug}carright.webp`;
};

const getCircuitAbbreviation = (race) => {
  const circuitId = race.Circuit?.circuitId;
  const manifestMatch = CIRCUIT_MANIFEST.find(c => 
    c.id === circuitId || 
    c.slug === circuitId || 
    c.aliases?.includes(circuitId) ||
    c.name?.toLowerCase().includes(String(circuitId).toLowerCase())
  );
  
  if (manifestMatch) {
    return manifestMatch.commonName ?? manifestMatch.location;
  }
  
  const locality = race.Circuit?.Location?.locality;
  if (locality) return locality;
  
  if (race.raceName) {
    return race.raceName.replace(' Grand Prix', '').replace(' GP', '');
  }
  
  return `R${race.round}`;
};

const fetchWikiHeadshots = async (entries) => {
  const wikiTitles = entries
    .map(entry => {
      const url = entry.Driver?.url ?? '';
      return url.includes('/wiki/') ? url.split('/wiki/')[1] : null;
    })
    .filter(Boolean);

  if (wikiTitles.length === 0) return {};

  const titleChunks = [];
  for (let i = 0; i < wikiTitles.length; i += 50) {
    titleChunks.push(wikiTitles.slice(i, i + 50));
  }

  const headshotsMap = {};

  await Promise.all(titleChunks.map(async (chunk) => {
    try {
      const titlesStr = chunk.join('|');
      const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(titlesStr)}&prop=pageimages&format=json&pithumbsize=200&origin=*`;
      const res = await fetch(url);
      const data = await res.json();
      const pages = data?.query?.pages;
      if (pages) {
        Object.values(pages).forEach(page => {
          if (page.thumbnail?.source) {
            const titleKey = page.title.replace(/ /g, '_').toLowerCase();
            headshotsMap[titleKey] = page.thumbnail.source;
          }
        });
      }
    } catch (err) {
      console.warn('Failed to fetch wiki headshots chunk:', err);
    }
  }));

  return headshotsMap;
};

const StandingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Year Selector (2026 down to 2015)
  const currentYear = new Date().getUTCFullYear();
  const years = Array.from({ length: currentYear - 2015 + 1 }, (_, i) => String(currentYear - i));
  const selectedYear = searchParams.get('year') ?? String(currentYear);
  
  // Tabs: 'races', 'drivers', 'teams'
  const activeTab = searchParams.get('tab') ?? 'drivers';
  const selectedRound = searchParams.get('round'); // Can be null
  
  // State for standings data
  const [driversStandings, setDriversStandings] = useState([]);
  const [teamsStandings, setTeamsStandings] = useState([]);
  const [racesList, setRacesList] = useState([]);
  const [raceClassification, setRaceClassification] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [wikiHeadshots, setWikiHeadshots] = useState({});

  const setSelectedRound = (roundNum) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('round', roundNum);
      return params;
    });
  };

  const handleYearChange = (year) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('year', year);
      return params;
    });
  };

  const handleTabChange = (tab) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('tab', tab);
      return params;
    });
  };

  // Load standings and schedule metadata
  useEffect(() => {
    let active = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const yearNum = Number(selectedYear);
        
        // 1. Get schedule list from Jolpica
        const schedule = await dataManager.getSeasonSchedule(yearNum).catch(() => ({ races: [] }));
        if (!active) return;
        
        const normalized = normalizeSchedule(schedule, Date.now());
        const races = normalized.rounds ?? [];
        setRacesList(races);
        
        // Set default selected round if not present in URL
        const currentRoundParam = searchParams.get('round');
        if (!currentRoundParam) {
          const pastRaces = races.filter(r => r.status === 'past');
          if (pastRaces.length > 0) {
            setSelectedRound(String(pastRaces.at(-1).round));
          } else if (races.length > 0) {
            setSelectedRound(String(races[0].round));
          }
        }

        // 2. Fetch driver & team standings
        const [driversData, teamsData] = await Promise.all([
          dataManager.getDriverStandings(yearNum).catch(() => []),
          dataManager.getConstructorStandings(yearNum).catch(() => [])
        ]);

        if (!active) return;
        setDriversStandings(driversData);
        setTeamsStandings(teamsData);

        // 3. Fetch Wiki headshots dynamically
        if (driversData.length > 0) {
          const headshots = await fetchWikiHeadshots(driversData);
          if (active) {
            setWikiHeadshots(prev => ({ ...prev, ...headshots }));
          }
        }

      } catch (err) {
        console.error('Error loading standings data:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => { active = false; };
  }, [selectedYear]);

  // Load race classification when round changes
  useEffect(() => {
    if (activeTab !== 'races' || !selectedRound) return;
    let active = true;
    const loadRaceClassification = async () => {
      try {
        const data = await dataManager.getRaceClassification(Number(selectedYear), Number(selectedRound)).catch(() => []);
        if (active) {
          setRaceClassification(data);
          // Fetch wiki headshots dynamically for classification list
          if (data.length > 0) {
            const headshots = await fetchWikiHeadshots(data);
            if (active) {
              setWikiHeadshots(prev => ({ ...prev, ...headshots }));
            }
          }
        }
      } catch (err) {
        console.error('Error loading race classification:', err);
      }
    };
    loadRaceClassification();
    return () => { active = false; };
  }, [selectedYear, selectedRound, activeTab]);

  return (
    <PageShell
      eyebrow={`${selectedYear} season`}
      title="Standings & Classifications"
      description="Track the Driver and Team championships standings, or view detailed race-by-race results."
      actions={(
        <div className="standings-header-actions">
          <div className="pw-year-dropdown">
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              aria-label="Select Season Year"
            >
              {years.map(y => (
                <option key={y} value={y}>{y} Season</option>
              ))}
            </select>
          </div>
        </div>
      )}
    >
      <div className="standings-tab-bar">
        <button 
          type="button" 
          className={`standings-tab-btn ${activeTab === 'races' ? 'active' : ''}`}
          onClick={() => handleTabChange('races')}
        >
          Races
        </button>
        <button 
          type="button" 
          className={`standings-tab-btn ${activeTab === 'drivers' ? 'active' : ''}`}
          onClick={() => handleTabChange('drivers')}
        >
          Drivers
        </button>
        <button 
          type="button" 
          className={`standings-tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
          onClick={() => handleTabChange('teams')}
        >
          Teams
        </button>
      </div>

      {loading ? (
        <div className="standings-skeleton-loader" role="status">
          <span className="pw-spinner" aria-hidden="true" />
          <span>Loading data from API...</span>
        </div>
      ) : (
        <div className="standings-content-area">
          {/* DRIVERS STANDINGS TAB */}
          {activeTab === 'drivers' && (
            <div className="standings-card-layout">
              {driversStandings.length === 0 ? (
                <div className="no-standings-notice">No driver standings available for this season yet.</div>
              ) : (
                <div className="pw-table-container">
                  <table className="pw-standings-table">
                    <thead>
                      <tr>
                        <th className="col-pos">POS.</th>
                        <th>DRIVER</th>
                        <th>NATIONALITY</th>
                        <th>TEAM</th>
                        <th className="col-pts text-right">PTS.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driversStandings.map((entry) => {
                        const driverLastName = entry.Driver.familyName;
                        const driverCode = entry.Driver.code ?? driverLastName.slice(0, 3).toUpperCase();
                        const teamName = entry.Constructors?.[0]?.name ?? 'Independent';
                        const teamColor = getTeamColor(teamName);
                        
                        // Try to find headshot (prefer official 2026 Cloudinary format for 2026 season)
                        const wikiUrl = entry.Driver?.url ?? '';
                        const wikiTitle = wikiUrl.includes('/wiki/') ? wikiUrl.split('/wiki/')[1].toLowerCase() : '';
                        const headshot = Number(selectedYear) === 2026
                          ? (get2026DriverHeadshot(driverLastName, teamName) ?? getDriverHeadshot(driverLastName, selectedYear))
                          : (wikiHeadshots[wikiTitle] ?? getDriverHeadshot(driverLastName, selectedYear));

                        return (
                          <tr key={entry.Driver.driverId} className="standings-row">
                            <td className="col-pos">
                              <span className={`pos-badge pos-${entry.position}`}>
                                {entry.position}
                              </span>
                            </td>
                            <td className="col-driver">
                              <div className="driver-avatar-box">
                                {headshot ? (
                                  <img 
                                    className="driver-headshot-img" 
                                    src={headshot} 
                                    alt={`${entry.Driver.givenName} ${driverLastName}`}
                                    onError={(e) => {
                                      // Fallback on image load error
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <span 
                                  className="driver-initials-fallback"
                                  style={{ 
                                    background: `linear-gradient(135deg, ${teamColor}33, ${teamColor}aa)`, 
                                    borderColor: teamColor,
                                    display: headshot ? 'none' : 'flex'
                                  }}
                                >
                                  {driverCode.slice(0, 2)}
                                </span>
                                <div className="driver-meta-name">
                                  <strong>{driverCode} <span className="inline-flag">{getFlagEmoji(entry.Driver.nationality)}</span></strong>
                                  <span>{entry.Driver.givenName} {driverLastName}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="nationality-badge">
                                {getFlagEmoji(entry.Driver.nationality)} {entry.Driver.nationality}
                              </span>
                            </td>
                            <td>
                              <div className="team-indicator-cell">
                                <img 
                                  src={getTeamLogoUrl(teamName)} 
                                  alt={`${teamName} logo`}
                                  className="team-logo-img-small"
                                  style={{ width: 'auto', height: '14px', objectFit: 'contain', marginRight: '6px' }}
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                                <span className="team-accent-line" style={{ backgroundColor: teamColor }} />
                                <span>{teamName}</span>
                              </div>
                            </td>
                            <td className="col-pts text-right">
                              <strong>{entry.points}</strong>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TEAMS STANDINGS TAB */}
          {activeTab === 'teams' && (
            <div className="standings-card-layout">
              {teamsStandings.length === 0 ? (
                <div className="no-standings-notice">No team standings available for this season yet.</div>
              ) : (
                <div className="pw-table-container">
                  <table className="pw-standings-table">
                    <thead>
                      <tr>
                        <th className="col-pos">POS.</th>
                        <th>TEAM</th>
                        <th>NATIONALITY</th>
                        <th>WINS</th>
                        <th className="col-pts text-right">PTS.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamsStandings.map((entry) => {
                        const teamName = entry.Constructor.name;
                        const teamColor = getTeamColor(teamName);
                        
                        return (
                          <tr key={entry.Constructor.constructorId} className="standings-row">
                            <td className="col-pos">
                              <span className={`pos-badge pos-${entry.position}`}>
                                {entry.position}
                              </span>
                            </td>
                            <td className="col-team">
                              <div className="team-indicator-cell" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div className="team-logo-container" style={{ position: 'relative', width: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <img 
                                    src={getTeamLogoUrl(teamName)} 
                                    alt={`${teamName} logo`}
                                    className="team-logo-img"
                                    style={{ maxHeight: '28px', maxWidth: '100%', objectFit: 'contain', transition: 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)', display: 'block' }}
                                    onMouseEnter={(e) => { e.target.style.transform = 'translateX(6px) scale(1.08)'; }}
                                    onMouseLeave={(e) => { e.target.style.transform = 'none'; }}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                  <span 
                                    className="team-logo-badge" 
                                    style={{ 
                                      backgroundColor: teamColor,
                                      boxShadow: `0 0 8px ${teamColor}40`,
                                      display: 'none',
                                      width: '32px',
                                      height: '32px',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderRadius: '8px',
                                      color: '#fff',
                                      fontWeight: '900',
                                      fontSize: '1rem',
                                      textTransform: 'uppercase'
                                    }}
                                  >
                                    {teamName.charAt(0)}
                                  </span>
                                </div>
                                <div className="team-meta-name" style={{ display: 'flex', flexDirection: 'column' }}>
                                  <strong>{teamName} <span className="inline-flag">{getFlagEmoji(entry.Constructor.nationality)}</span></strong>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="nationality-badge">
                                {getFlagEmoji(entry.Constructor.nationality)} {entry.Constructor.nationality}
                              </span>
                            </td>
                            <td>{entry.wins}</td>
                            <td className="col-pts text-right">
                              <strong>{entry.points}</strong>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* RACES CLASSIFICATION TAB */}
          {activeTab === 'races' && (
            <div className="races-standings-split-cards" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="previous-rounds-scroll" role="list">
                {racesList.length === 0 ? (
                  <div className="no-races-notice" style={{ padding: '20px' }}>No races loaded.</div>
                ) : (
                  racesList.map((race) => {
                    const isSelected = selectedRound === String(race.round);
                    return (
                      <PreviousRoundCard
                        key={race.round}
                        round={race}
                        isActive={isSelected}
                        onClick={() => setSelectedRound(String(race.round))}
                      />
                    );
                  })
                )}
              </div>

              <div className="races-results-classification">
                <div className="panel-title-label">Race Results Classification</div>
                {raceClassification.length === 0 ? (
                  <div className="no-standings-notice">No classification results loaded for this round.</div>
                ) : (
                  <div className="pw-table-container">
                    <table className="pw-standings-table">
                      <thead>
                        <tr>
                          <th className="col-pos">POS.</th>
                          <th>DRIVER</th>
                          <th>TEAM</th>
                          <th>TIME/STATUS</th>
                          <th className="col-pts text-right">PTS.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {raceClassification.map((entry) => {
                          const teamColor = getTeamColor(entry.Constructor.name);
                          const driverLastName = entry.Driver.familyName;
                          const driverCode = entry.Driver.code ?? driverLastName.slice(0, 3).toUpperCase();
                          const resultTime = entry.Time?.time ?? entry.status;
                          const wikiUrl = entry.Driver?.url ?? '';
                          const wikiTitle = wikiUrl.includes('/wiki/') ? wikiUrl.split('/wiki/')[1].toLowerCase() : '';
                          const headshot = Number(selectedYear) === 2026
                            ? (get2026DriverHeadshot(driverLastName, entry.Constructor.name) ?? getDriverHeadshot(driverLastName, selectedYear))
                            : (wikiHeadshots[wikiTitle] ?? getDriverHeadshot(driverLastName, selectedYear));
                          
                          return (
                            <tr key={entry.Driver.driverId} className="standings-row">
                              <td className="col-pos">
                                <span className={`pos-badge pos-${entry.position}`}>
                                  {entry.position}
                                </span>
                              </td>
                              <td className="col-driver">
                                <div className="driver-avatar-box">
                                  {headshot ? (
                                    <img 
                                      className="driver-headshot-img" 
                                      src={headshot} 
                                      alt={`${entry.Driver.givenName} ${driverLastName}`}
                                      onError={(e) => {
                                        // Fallback on image load error
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <span 
                                    className="driver-initials-fallback"
                                    style={{ 
                                      background: `linear-gradient(135deg, ${teamColor}33, ${teamColor}aa)`, 
                                      borderColor: teamColor,
                                      display: headshot ? 'none' : 'flex'
                                    }}
                                  >
                                    {driverCode.slice(0, 2)}
                                  </span>
                                  <div className="driver-meta-name">
                                    <strong>{driverCode} <span className="inline-flag">{getFlagEmoji(entry.Driver.nationality)}</span></strong>
                                    <span>{entry.Driver.givenName} {driverLastName}</span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div className="team-indicator-cell">
                                  <img 
                                    src={getTeamLogoUrl(entry.Constructor.name)} 
                                    alt={`${entry.Constructor.name} logo`}
                                    className="team-logo-img-small"
                                    style={{ width: 'auto', height: '14px', objectFit: 'contain', marginRight: '6px' }}
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                  <span className="team-accent-line" style={{ backgroundColor: teamColor }} />
                                  <span>{entry.Constructor.name}</span>
                                </div>
                              </td>
                              <td className="time-status-cell">
                                <span className={entry.status === 'Finished' ? 'time' : 'status-failed'}>
                                  {resultTime}
                                </span>
                              </td>
                              <td className="col-pts text-right">
                                <strong>{entry.points}</strong>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
};

export default StandingsPage;
