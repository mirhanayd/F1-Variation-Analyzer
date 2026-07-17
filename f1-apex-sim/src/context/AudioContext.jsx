import { createContext, useContext, useEffect, useState, useRef } from 'react';

const AudioContext = createContext(null);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

export const AudioProvider = ({ children }) => {
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('bg_music_muted');
    return saved ? JSON.parse(saved) : false;
  });
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('bg_music_volume');
    return saved ? JSON.parse(saved) : 0.04;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = new Audio('/videoplayback.m4a');
    audio.loop = true;
    audio.volume = volume;
    audioRef.current = audio;

    const playOnUserGesture = async () => {
      if (isMuted) return;
      try {
        await audio.play();
        setIsPlaying(true);
        cleanupGestureListeners();
      } catch (e) {
        console.warn('Failed to play audio on interaction:', e);
      }
    };

    const cleanupGestureListeners = () => {
      window.removeEventListener('click', playOnUserGesture);
      window.removeEventListener('touchstart', playOnUserGesture);
    };

    const startPlay = async () => {
      if (isMuted) return;
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.log('Autoplay blocked. Background music will start after user interaction.', err);
        window.addEventListener('click', playOnUserGesture);
        window.addEventListener('touchstart', playOnUserGesture);
      }
    };

    startPlay();

    return () => {
      cleanupGestureListeners();
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  // Sync mute state with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.pause();
      // Defer state update to avoid synchronous setState warning in effect
      const timer = setTimeout(() => setIsPlaying(false), 0);
      return () => clearTimeout(timer);
    } else {
      audio.play()
        .then(() => {
          const timer = setTimeout(() => setIsPlaying(true), 0);
          return () => clearTimeout(timer);
        })
        .catch((err) => {
          console.log('Play on mute toggle failed/blocked:', err);
        });
    }
    localStorage.setItem('bg_music_muted', JSON.stringify(isMuted));
  }, [isMuted]);

  // Sync volume state with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
    }
    localStorage.setItem('bg_music_volume', JSON.stringify(volume));
  }, [volume]);

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  return (
    <AudioContext.Provider value={{ isMuted, setIsMuted, toggleMute, volume, setVolume, isPlaying }}>
      {children}
    </AudioContext.Provider>
  );
};
