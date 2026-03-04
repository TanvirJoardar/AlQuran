import React, { useState } from 'react';
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
  Volume1,
  VolumeX,
  BookMarked,
} from 'lucide-react';

interface AudioPlayerBarProps {
  isPlaying: boolean;
  currentAyah: Ayah | null;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  surahName?: string;
  volume?: number;
  onTogglePlay: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onGoToPage?: () => void;
  onVolumeChange?: (vol: number) => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  isPlaying,
  currentAyah,
  currentTime,
  duration,
  isLoading,
  surahName,
  volume = 1,
  onTogglePlay,
  onStop,
  onSeek,
  onPrevious,
  onNext,
  onGoToPage,
  onVolumeChange,
}) => {
  const [showVolume, setShowVolume] = useState(false);
  const [prevVolume, setPrevVolume] = useState(1);

  if (!currentAyah) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const handleToggleMute = () => {
    if (!onVolumeChange) return;
    if (volume > 0) {
      setPrevVolume(volume);
      onVolumeChange(0);
    } else {
      onVolumeChange(prevVolume || 1);
    }
  };

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
          <div
            className="player-volume-wrap"
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}
          >
            <button
              className="player-btn player-volume-btn"
              onClick={handleToggleMute}
              title={volume === 0 ? 'Unmute' : 'Mute'}
            >
              <VolumeIcon size={18} />
            </button>
            {showVolume && onVolumeChange && (
              <div
                className="player-volume-slider-wrap"
              >
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={volume}
                  onChange={e => onVolumeChange(Number(e.target.value))}
                  className="player-volume-slider"
                />
                <span className="player-volume-pct">{Math.round(volume * 100)}%</span>
              </div>
            )}
          </div>
          <div className="player-text">
            <span className="player-surah-name">{surahName}</span>
            <span className="player-ayah-info">
              Ayah {currentAyah.numberInSurah} • Juz {currentAyah.juz} • Page {currentAyah.page}
            </span>
          </div>
        </div>

        {onGoToPage && (
          <button className="player-btn player-btn-goto" onClick={onGoToPage} title="Go to page in Hafezi Quran">
            <BookMarked size={16} />
          </button>
        )}

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
