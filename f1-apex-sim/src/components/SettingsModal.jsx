import { useEffect } from 'react';
import { useAudio } from '../context/AudioContext';

const SettingsModal = ({ isOpen, onClose }) => {
  const { isMuted, toggleMute, volume, setVolume } = useAudio();

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="pw-settings-backdrop" onClick={onClose} role="presentation">
      <div
        className="pw-settings-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="pw-settings-header">
          <h2 id="settings-title">Settings</h2>
          <button
            type="button"
            className="pw-settings-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="pw-settings-content">
          <div className="pw-settings-section">
            <h3>Audio Settings</h3>
            
            <div className="pw-settings-item">
              <div className="pw-settings-info">
                <span className="pw-settings-label">Background Music</span>
                <span className="pw-settings-desc">Play loop music on startup.</span>
              </div>
              
              <label className="pw-toggle-switch">
                <input
                  type="checkbox"
                  checked={!isMuted}
                  onChange={toggleMute}
                  aria-label="Toggle background music"
                />
                <span className="pw-toggle-slider" />
              </label>
            </div>

            <div className="pw-settings-item volume-control-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
              <div className="volume-label-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', fontWeight: '700' }}>
                <span>Music Volume</span>
                <span style={{ color: 'var(--cyan)' }}>{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(volume * 100)}
                disabled={isMuted}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                style={{ width: '100%', accentColor: 'var(--red)', cursor: isMuted ? 'default' : 'pointer', opacity: isMuted ? 0.4 : 1 }}
                aria-label="Adjust background music volume"
              />
            </div>
          </div>
        </div>

        <div className="pw-settings-footer">
          <button type="button" className="pw-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
