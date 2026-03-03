import React from 'react';
import type { Surah } from '../types/quran';
import { toArabicNumber } from '../utils/helpers';
import { BookOpen, MapPin } from 'lucide-react';

interface SurahListProps {
  surahs: Surah[];
  selectedSurah: Surah | null;
  onSelectSurah: (surah: Surah) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const SurahList: React.FC<SurahListProps> = ({
  surahs,
  selectedSurah,
  onSelectSurah,
  searchQuery,
  onSearchChange,
}) => {
  const filteredSurahs = surahs.filter(
    surah =>
      surah.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      surah.englishNameTranslation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      surah.name.includes(searchQuery) ||
      String(surah.number).includes(searchQuery)
  );

  return (
    <div className="surah-list">
      <div className="surah-list-header">
        <h2>
          <BookOpen size={20} />
          Surahs
        </h2>
        <div className="search-box">
          <input
            type="text"
            placeholder="Search surah..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
      </div>
      <div className="surah-items">
        {filteredSurahs.map(surah => (
          <div
            key={surah.number}
            className={`surah-item ${selectedSurah?.number === surah.number ? 'active' : ''}`}
            onClick={() => onSelectSurah(surah)}
          >
            <div className="surah-number">
              <span className="surah-number-diamond">
                {toArabicNumber(surah.number)}
              </span>
            </div>
            <div className="surah-info">
              <div className="surah-names">
                <span className="surah-english-name">{surah.englishName}</span>
                <span className="surah-arabic-name">{surah.name}</span>
              </div>
              <div className="surah-meta">
                <span className="surah-translation">{surah.englishNameTranslation}</span>
                <span className="surah-details">
                  <MapPin size={12} />
                  {surah.revelationType} • {surah.ayahs.length} Ayahs
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
