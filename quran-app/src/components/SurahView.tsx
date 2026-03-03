import React, { useEffect, useRef } from 'react';
import type { Surah, Ayah } from '../types/quran';
import { toArabicNumber } from '../utils/helpers';
import { Play, Pause, Loader } from 'lucide-react';

interface SurahViewProps {
  surah: Surah;
  currentAyah: Ayah | null;
  isPlaying: boolean;
  isLoading: boolean;
  onPlayAyah: (ayah: Ayah) => void;
  onPlaySurah: (ayahs: Ayah[]) => void;
}

export const SurahView: React.FC<SurahViewProps> = ({
  surah,
  currentAyah,
  isPlaying,
  isLoading,
  onPlayAyah,
  onPlaySurah,
}) => {
  const activeRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const element = activeRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      if (
        elementRect.top < containerRect.top ||
        elementRect.bottom > containerRect.bottom
      ) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentAyah]);

  return (
    <div className="surah-view" ref={containerRef}>
      <div className="surah-view-header">
        <div className="surah-title-section">
          <h1 className="surah-title-arabic">{surah.name}</h1>
          <h2 className="surah-title-english">
            {surah.englishName} - {surah.englishNameTranslation}
          </h2>
          <div className="surah-badge-row">
            <span className="badge revelation-badge">{surah.revelationType}</span>
            <span className="badge ayah-badge">{surah.ayahs.length} Ayahs</span>
            <span className="badge juz-badge">Juz {surah.ayahs[0]?.juz}</span>
          </div>
        </div>
        <button
          className="play-surah-btn"
          onClick={() => onPlaySurah(surah.ayahs)}
          title="Play entire surah"
        >
          <Play size={20} />
          Play Surah
        </button>
      </div>

      {/* Bismillah - for all surahs except At-Tawba (9) */}
      {surah.number !== 9 && surah.number !== 1 && (
        <div className="bismillah">
          بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </div>
      )}

      <div className="ayahs-container">
        {surah.ayahs.map(ayah => {
          const isActive = currentAyah?.number === ayah.number;
          const isCurrentPlaying = isActive && isPlaying;
          const isCurrentLoading = isActive && isLoading;

          return (
            <div
              key={ayah.number}
              ref={isActive ? activeRef : null}
              className={`ayah-card ${isActive ? 'active' : ''}`}
            >
              <div className="ayah-header">
                <div className="ayah-number-badge">
                  {toArabicNumber(ayah.numberInSurah)}
                </div>
                <button
                  className={`ayah-play-btn ${isCurrentPlaying ? 'playing' : ''}`}
                  onClick={() => onPlayAyah(ayah)}
                  title={isCurrentPlaying ? 'Pause' : 'Play ayah'}
                >
                  {isCurrentLoading ? (
                    <Loader size={16} className="spin" />
                  ) : isCurrentPlaying ? (
                    <Pause size={16} />
                  ) : (
                    <Play size={16} />
                  )}
                </button>
                <div className="ayah-meta-tags">
                  <span className="meta-tag">Juz {ayah.juz}</span>
                  <span className="meta-tag">Page {ayah.page}</span>
                  {ayah.sajda && <span className="meta-tag sajda-tag">Sajda</span>}
                </div>
              </div>
              <div className="ayah-text" dir="rtl" lang="ar">
                {ayah.text}
                <span className="ayah-end-marker">
                  ﴿{toArabicNumber(ayah.numberInSurah)}﴾
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
