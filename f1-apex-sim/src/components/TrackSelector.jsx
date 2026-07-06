import { TRACK_LIST } from '../utils/trackData';

const TrackSelector = ({ selectedTrackKey, onSelectTrack }) => (
  <div className="track-selector" aria-label="Track selector">
    {TRACK_LIST.map((track) => (
      <button
        key={track.id}
        className={`track-btn ${selectedTrackKey === track.id ? 'active' : ''}`}
        onClick={() => onSelectTrack(track.id)}
        type="button"
      >
        {track.shortName}
      </button>
    ))}
  </div>
);

export default TrackSelector;
