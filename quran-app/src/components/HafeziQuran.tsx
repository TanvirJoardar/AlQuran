import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { Surah, Ayah } from '../types/quran';
import { toArabicNumber } from '../utils/helpers';
import { getPageMappings } from '../services/database';
import {
  Play,
  Pause,
  Loader,
  ChevronLeft,
  ChevronRight,
  Repeat,
  ChevronsLeft,
  ChevronsRight,
  BookOpen,
} from 'lucide-react';

interface PageData {
  pageNumber: number;
  ayahs: (Ayah & { surahNumber: number; surahName: string; surahArabicName: string })[];
}

interface JuzData {
  juzNumber: number;
  pages: PageData[];
}

interface HafeziQuranProps {
  surahs: Surah[];
  currentAyah: Ayah | null;
  isPlaying: boolean;
  isLoading: boolean;
  onPlayPage: (ayahs: Ayah[]) => void;
  onPlayAyah: (ayah: Ayah) => void;
  onSetRepeat: (value: boolean) => void;
  onSetAyahsList: (ayahs: Ayah[]) => void;
  onSetAutoPlayNext: (value: boolean) => void;
  onStop: () => void;
  mappingsVersion?: number;
}

// Arabic Juz names
const juzNames: Record<number, string> = {
  1: 'الم', 2: 'سَيَقُولُ', 3: 'تِلْكَ الرُّسُلُ', 4: 'لَنْ تَنَالُوا',
  5: 'وَالْمُحْصَنَاتُ', 6: 'لَا يُحِبُّ اللَّهُ', 7: 'وَإِذَا سَمِعُوا',
  8: 'وَلَوْ أَنَّنَا', 9: 'قَالَ الْمَلَأُ', 10: 'وَاعْلَمُوا',
  11: 'يَعْتَذِرُونَ', 12: 'وَمَا مِنْ دَابَّةٍ', 13: 'وَمَا أُبَرِّئُ',
  14: 'رُبَمَا', 15: 'سُبْحَانَ الَّذِي', 16: 'قَالَ أَلَمْ',
  17: 'اقْتَرَبَ', 18: 'قَدْ أَفْلَحَ', 19: 'وَقَالَ الَّذِينَ',
  20: 'أَمَّنْ خَلَقَ', 21: 'اتْلُ مَا أُوحِيَ', 22: 'وَمَنْ يَقْنُتْ',
  23: 'وَمَا لِيَ', 24: 'فَمَنْ أَظْلَمُ', 25: 'إِلَيْهِ يُرَدُّ',
  26: 'حم', 27: 'قَالَ فَمَا خَطْبُكُمْ', 28: 'قَدْ سَمِعَ اللَّهُ',
  29: 'تَبَارَكَ الَّذِي', 30: 'عَمَّ',
};

export const HafeziQuran: React.FC<HafeziQuranProps> = ({
  surahs,
  currentAyah,
  isPlaying,
  isLoading,
  onPlayPage,
  onPlayAyah,
  onSetRepeat,
  onSetAyahsList,
  onSetAutoPlayNext,
  onStop,
  mappingsVersion,
}) => {
  const [selectedJuz, setSelectedJuz] = useState(1);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [repeatOn, setRepeatOn] = useState(false);
  const [isPagePlaying, setIsPagePlaying] = useState(false);
  const pageContentRef = useRef<HTMLDivElement>(null);

  // Build all enriched ayahs once
  const allAyahs = useMemo(() => {
    const result: (Ayah & { surahNumber: number; surahName: string; surahArabicName: string })[] = [];
    surahs.forEach(s => {
      s.ayahs.forEach(a => {
        result.push({
          ...a,
          surahNumber: s.number,
          surahName: s.englishName,
          surahArabicName: s.name,
        });
      });
    });
    return result;
  }, [surahs]);

  // Build juz -> pages -> ayahs data structure, using custom mappings when available
  const juzData = useMemo<JuzData[]>(() => {
    // Group by page (original)
    const pageMap = new Map<number, typeof allAyahs>();
    allAyahs.forEach(a => {
      if (!pageMap.has(a.page)) pageMap.set(a.page, []);
      pageMap.get(a.page)!.push(a);
    });

    // Group pages by juz (original way)
    const juzMap = new Map<number, PageData[]>();
    for (let j = 1; j <= 30; j++) {
      juzMap.set(j, []);
    }

    allAyahs.forEach(a => {
      const juz = a.juz;
      const pages = juzMap.get(juz)!;
      if (!pages.find(p => p.pageNumber === a.page)) {
        pages.push({
          pageNumber: a.page,
          ayahs: pageMap.get(a.page)!,
        });
      }
    });

    // Sort pages within each juz
    for (let j = 1; j <= 30; j++) {
      juzMap.get(j)!.sort((a, b) => a.pageNumber - b.pageNumber);
    }

    // Now apply custom mappings per juz
    const result: JuzData[] = [];
    for (let j = 1; j <= 30; j++) {
      const origPages = juzMap.get(j)!;
      const customMappings = getPageMappings(j);

      if (customMappings.length > 0) {
        // Use custom mappings to override ayah content of each page
        const customPages: PageData[] = origPages.map((page, idx) => {
          const mapping = customMappings.find(m => m.pageIndex === idx);
          if (mapping && mapping.isCustom) {
            // Get ayahs from the custom range
            const customAyahs = allAyahs.filter(
              a => a.number >= mapping.customStartAyah && a.number <= mapping.customEndAyah
            );
            return {
              pageNumber: page.pageNumber,
              ayahs: customAyahs,
            };
          }
          return page;
        });
        result.push({ juzNumber: j, pages: customPages });
      } else {
        result.push({ juzNumber: j, pages: origPages });
      }
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surahs, allAyahs, mappingsVersion]);

  const currentJuz = juzData.find(j => j.juzNumber === selectedJuz)!;
  const currentPage = currentJuz?.pages[selectedPageIndex] || currentJuz?.pages[0];

  // Reset page index when juz changes
  useEffect(() => {
    setSelectedPageIndex(0);
  }, [selectedJuz]);

  // Scroll to top when page changes
  useEffect(() => {
    pageContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedPageIndex, selectedJuz]);

  // Detect surah starts on current page
  const surahStartsOnPage = useMemo(() => {
    if (!currentPage) return [];
    const starts: { surahNumber: number; surahName: string; surahArabicName: string; index: number }[] = [];
    currentPage.ayahs.forEach((ayah, idx) => {
      if (ayah.numberInSurah === 1) {
        starts.push({
          surahNumber: ayah.surahNumber,
          surahName: ayah.surahName,
          surahArabicName: ayah.surahArabicName,
          index: idx,
        });
      }
    });
    return starts;
  }, [currentPage]);

  // Split ayah text into lines for 15-line display
  const pageLines = useMemo(() => {
    if (!currentPage) return [];

    interface LinePart {
      text: string;
      ayah: typeof currentPage.ayahs[0];
      isPlaying: boolean;
    }

    interface Line {
      parts: LinePart[];
      surahStart?: { surahNumber: number; surahName: string; surahArabicName: string };
    }

    const lines: Line[] = [];

    // Build continuous text blocks, inserting surah headers
    currentPage.ayahs.forEach((ayah, idx) => {
      // Check if this ayah starts a new surah
      const surahStart = surahStartsOnPage.find(s => s.index === idx);
      if (surahStart) {
        lines.push({
          parts: [],
          surahStart: {
            surahNumber: surahStart.surahNumber,
            surahName: surahStart.surahName,
            surahArabicName: surahStart.surahArabicName,
          },
        });
      }

      const ayahText = `${ayah.text} ﴿${toArabicNumber(ayah.numberInSurah)}﴾`;
      const isActive = currentAyah?.number === ayah.number;

      // Add as a line part - if last line has room, append; otherwise new line
      if (lines.length === 0 || lines[lines.length - 1].surahStart || lines[lines.length - 1].parts.length === 0) {
        if (lines.length === 0 || lines[lines.length - 1].surahStart) {
          lines.push({ parts: [] });
        }
      }

      lines[lines.length - 1].parts.push({
        text: ayahText,
        ayah,
        isPlaying: isActive && isPlaying,
      });
    });

    return lines;
  }, [currentPage, currentAyah, isPlaying]);

  const handlePlayPage = () => {
    if (!currentPage) return;

    if (isPagePlaying && isPlaying) {
      // Stop current page playback
      onStop();
      setIsPagePlaying(false);
      return;
    }

    const ayahs = currentPage.ayahs;
    onSetRepeat(repeatOn);
    onSetAyahsList(ayahs);
    onSetAutoPlayNext(true);
    onPlayPage(ayahs);
    setIsPagePlaying(true);
  };

  const handleToggleRepeat = () => {
    const newVal = !repeatOn;
    setRepeatOn(newVal);
    onSetRepeat(newVal);
  };

  const handlePrevPage = () => {
    if (selectedPageIndex > 0) {
      setSelectedPageIndex(selectedPageIndex - 1);
    } else if (selectedJuz > 1) {
      const prevJuz = juzData.find(j => j.juzNumber === selectedJuz - 1)!;
      setSelectedJuz(selectedJuz - 1);
      setSelectedPageIndex(prevJuz.pages.length - 1);
    }
  };

  const handleNextPage = () => {
    if (selectedPageIndex < currentJuz.pages.length - 1) {
      setSelectedPageIndex(selectedPageIndex + 1);
    } else if (selectedJuz < 30) {
      setSelectedJuz(selectedJuz + 1);
      setSelectedPageIndex(0);
    }
  };

  // Track when page playback finishes
  useEffect(() => {
    if (isPagePlaying && !isPlaying && !isLoading) {
      setIsPagePlaying(false);
    }
  }, [isPlaying, isLoading, isPagePlaying]);

  if (!currentPage) return null;

  return (
    <div className="hafezi-quran">
      {/* Top Controls Bar */}
      <div className="hafezi-controls">
        <div className="hafezi-controls-left">
          <BookOpen size={18} className="hafezi-controls-icon" />
          <span className="hafezi-title">Hafezi Quran</span>
        </div>

        {/* Para Selector */}
        <div className="hafezi-selectors">
          <div className="hafezi-select-group">
            <label>Para (Juz)</label>
            <select
              value={selectedJuz}
              onChange={e => setSelectedJuz(Number(e.target.value))}
              className="hafezi-select"
            >
              {Array.from({ length: 30 }, (_, i) => i + 1).map(j => (
                <option key={j} value={j}>
                  {j} - {juzNames[j]}
                </option>
              ))}
            </select>
          </div>

          {/* Page Selector */}
          <div className="hafezi-select-group">
            <label>Page</label>
            <select
              value={selectedPageIndex}
              onChange={e => setSelectedPageIndex(Number(e.target.value))}
              className="hafezi-select"
            >
              {currentJuz.pages.map((p, idx) => (
                <option key={p.pageNumber} value={idx}>
                  {p.pageNumber}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Play & Repeat */}
        <div className="hafezi-controls-right">
          <button
            className={`hafezi-repeat-btn ${repeatOn ? 'active' : ''}`}
            onClick={handleToggleRepeat}
            title={repeatOn ? 'Repeat ON' : 'Repeat OFF'}
          >
            <Repeat size={16} />
          </button>
          <button
            className={`hafezi-play-page-btn ${isPagePlaying ? 'playing' : ''}`}
            onClick={handlePlayPage}
            title={isPagePlaying ? 'Stop page' : 'Play page'}
          >
            {isLoading && isPagePlaying ? (
              <Loader size={16} className="spin" />
            ) : isPagePlaying && isPlaying ? (
              <Pause size={16} />
            ) : (
              <Play size={16} />
            )}
            <span>{isPagePlaying && isPlaying ? 'Stop' : 'Play Page'}</span>
          </button>
        </div>
      </div>

      {/* Page Navigation */}
      <div className="hafezi-page-nav">
        <button
          className="hafezi-nav-btn"
          onClick={() => { setSelectedJuz(Math.max(1, selectedJuz - 1)); }}
          disabled={selectedJuz <= 1}
          title="Previous Para"
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          className="hafezi-nav-btn"
          onClick={handlePrevPage}
          disabled={selectedPageIndex === 0 && selectedJuz === 1}
          title="Previous Page"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="hafezi-page-indicator">
          <span className="hafezi-page-num">
            Page {currentPage.pageNumber}
          </span>
          <span className="hafezi-page-meta">
            Para {selectedJuz} • Page {selectedPageIndex + 1} of {currentJuz.pages.length}
          </span>
        </div>

        <button
          className="hafezi-nav-btn"
          onClick={handleNextPage}
          disabled={selectedPageIndex === currentJuz.pages.length - 1 && selectedJuz === 30}
          title="Next Page"
        >
          <ChevronRight size={16} />
        </button>
        <button
          className="hafezi-nav-btn"
          onClick={() => { setSelectedJuz(Math.min(30, selectedJuz + 1)); }}
          disabled={selectedJuz >= 30}
          title="Next Para"
        >
          <ChevronsRight size={16} />
        </button>
      </div>

      {/* Quran Page */}
      <div className="hafezi-page-wrapper" ref={pageContentRef}>
        <div className="hafezi-page">
          {/* Page header ornament */}
          <div className="hafezi-page-header-ornament">
            <div className="hafezi-ornament-line"></div>
            <div className="hafezi-page-juz-badge">
              الجزء {toArabicNumber(selectedJuz)}
            </div>
            <div className="hafezi-ornament-line"></div>
          </div>

          {/* 15-line content */}
          <div className="hafezi-page-content">
            {pageLines.map((line, lineIdx) => {
              if (line.surahStart) {
                return (
                  <div key={`surah-${lineIdx}`} className="hafezi-surah-header">
                    <div className="hafezi-surah-ornament">
                      <div className="hafezi-surah-ornament-wing left"></div>
                      <div className="hafezi-surah-name-box">
                        <span className="hafezi-surah-name-ar">{line.surahStart.surahArabicName}</span>
                      </div>
                      <div className="hafezi-surah-ornament-wing right"></div>
                    </div>
                    {/* Bismillah for non-Tawba surahs */}
                    {line.surahStart.surahNumber !== 9 && line.surahStart.surahNumber !== 1 && (
                      <div className="hafezi-bismillah">
                        بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={`line-${lineIdx}`} className="hafezi-line" dir="rtl" lang="ar">
                  {line.parts.map((part, partIdx) => (
                    <span
                      key={`${part.ayah.number}-${partIdx}`}
                      className={`hafezi-ayah-text ${
                        currentAyah?.number === part.ayah.number ? 'active' : ''
                      } ${part.isPlaying ? 'playing' : ''}`}
                      onClick={() => onPlayAyah(part.ayah)}
                      title={`Ayah ${part.ayah.numberInSurah}`}
                    >
                      {part.text}
                    </span>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Page footer */}
          <div className="hafezi-page-footer">
            <span>{currentPage.pageNumber}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
