import React from 'react';
import type { Ayah } from '../types/quran';
import { formatTime } from '../utils/helpers';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Square,
  Loader,
  Volume2,
} from 'lucide-react';

interface AudioPlayerBarProps {
  isPlaying: boolean;
  currentAyah: Ayah | null;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  surahName?: string;
  onTogglePlay: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  isPlaying,
  currentAyah,
  currentTime,
  duration,
  isLoading,
  surahName,
  onTogglePlay,
  onStop,
  onSeek,
  onPrevious,
  onNext,
}) => {
  if (!currentAyah) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="audio-player-bar">
      <div className="player-progress-bar">
        <div
          className="player-progress-fill"
          style={{ width: `${progress}%` }}
        />
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={currentTime}
          onChange={e => onSeek(Number(e.target.value))}
          className="player-progress-input"
        />
      </div>

      <div className="player-content">
        <div className="player-info">
          <Volume2 size={18} className="player-icon" />
          <div className="player-text">
            <span className="player-surah-name">{surahName}</span>
            <span className="player-ayah-info">
              Ayah {currentAyah.numberInSurah} • Juz {currentAyah.juz} • Page {currentAyah.page}
            </span>
          </div>
        </div>

        <div className="player-controls">
          <button className="player-btn" onClick={onPrevious} title="Previous Ayah">
            <SkipBack size={18} />
          </button>
          <button
            className="player-btn player-btn-main"
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <Loader size={22} className="spin" />
            ) : isPlaying ? (
              <Pause size={22} />
            ) : (
              <Play size={22} />
            )}
          </button>
          <button className="player-btn" onClick={onNext} title="Next Ayah">
            <SkipForward size={18} />
          </button>
          <button className="player-btn" onClick={onStop} title="Stop">
            <Square size={16} />
          </button>
        </div>

        <div className="player-time">
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};
