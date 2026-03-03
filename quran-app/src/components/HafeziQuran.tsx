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
  Type,
  Image,
} from 'lucide-react';

type EnrichedAyah = Ayah & { surahNumber: number; surahName: string; surahArabicName: string };

interface PageData {
  pageNumber: number;       // original quran page number
  displayPage: number;      // user-editable display page (1-based)
  pageIndex: number;        // immutable 0-based index within juz
  ayahs: EnrichedAyah[];
  pageImage: string | null; // base64-encoded page image
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
  const [selectedDisplayPage, setSelectedDisplayPage] = useState(0);
  const [repeatOn, setRepeatOn] = useState(false);
  const [isPagePlaying, setIsPagePlaying] = useState(false);
  const [viewMode, setViewMode] = useState<'text' | 'image'>('text');
  const pageContentRef = useRef<HTMLDivElement>(null);

  // Build all enriched ayahs once
  const allAyahs = useMemo<EnrichedAyah[]>(() => {
    const result: EnrichedAyah[] = [];
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

  // Build juz -> pages data, using custom mappings when available
  const juzData = useMemo<JuzData[]>(() => {
    // Group by page (original)
    const pageMap = new Map<number, EnrichedAyah[]>();
    allAyahs.forEach(a => {
      if (!pageMap.has(a.page)) pageMap.set(a.page, []);
      pageMap.get(a.page)!.push(a);
    });

    // Group pages by juz
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
          displayPage: 0,  // will be set below
          pageIndex: 0,    // will be set below
          ayahs: pageMap.get(a.page)!,
          pageImage: null,
        });
      }
    });

    // Sort and assign indices
    for (let j = 1; j <= 30; j++) {
      const pages = juzMap.get(j)!;
      pages.sort((a, b) => a.pageNumber - b.pageNumber);
      pages.forEach((p, idx) => {
        p.pageIndex = idx;
        p.displayPage = idx + 1; // default: 1-based
      });
    }

    // Apply custom mappings per juz
    const result: JuzData[] = [];
    for (let j = 1; j <= 30; j++) {
      const origPages = juzMap.get(j)!;
      const customMappings = getPageMappings(j);

      if (customMappings.length > 0) {
        const customPages: PageData[] = origPages.map((page, idx) => {
          const mapping = customMappings.find(m => m.pageIndex === idx);
          if (mapping) {
            const dp = mapping.displayPage;
            const img = mapping.pageImage || null;
            if (mapping.isCustom) {
              const customAyahs = allAyahs.filter(
                a => a.number >= mapping.customStartAyah && a.number <= mapping.customEndAyah
              );
              return {
                pageNumber: page.pageNumber,
                displayPage: dp,
                pageIndex: idx,
                ayahs: customAyahs,
                pageImage: img,
              };
            }
            return { ...page, displayPage: dp, pageIndex: idx, pageImage: img };
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

  // Get unique display page numbers sorted
  const uniqueDisplayPages = useMemo(() => {
    if (!currentJuz) return [];
    const set = new Set(currentJuz.pages.map(p => p.displayPage));
    return Array.from(set).sort((a, b) => a - b);
  }, [currentJuz]);

  // Find all pages matching the selected display page (1 or more for side-by-side)
  const currentPages = useMemo(() => {
    if (!currentJuz) return [];
    return currentJuz.pages.filter(p => p.displayPage === selectedDisplayPage);
  }, [currentJuz, selectedDisplayPage]);

  // Combined ayahs for playback (all pages in view)
  const allPageAyahs = useMemo(() => {
    return currentPages.flatMap(p => p.ayahs);
  }, [currentPages]);

  // Reset display page when juz changes
  useEffect(() => {
    if (uniqueDisplayPages.length > 0) {
      setSelectedDisplayPage(uniqueDisplayPages[0]);
    }
  }, [selectedJuz, uniqueDisplayPages.length]);

  // Scroll to top when page changes
  useEffect(() => {
    pageContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selectedDisplayPage, selectedJuz]);

  const handlePlayPage = () => {
    if (allPageAyahs.length === 0) return;

    if (isPagePlaying && isPlaying) {
      onStop();
      setIsPagePlaying(false);
      return;
    }

    onSetRepeat(repeatOn);
    onSetAyahsList(allPageAyahs);
    onSetAutoPlayNext(true);
    onPlayPage(allPageAyahs);
    setIsPagePlaying(true);
  };

  const handleToggleRepeat = () => {
    const newVal = !repeatOn;
    setRepeatOn(newVal);
    onSetRepeat(newVal);
  };

  const handlePrevPage = () => {
    const idx = uniqueDisplayPages.indexOf(selectedDisplayPage);
    if (idx > 0) {
      setSelectedDisplayPage(uniqueDisplayPages[idx - 1]);
    } else if (selectedJuz > 1) {
      setSelectedJuz(selectedJuz - 1);
      // will reset to first page via useEffect
    }
  };

  const handleNextPage = () => {
    const idx = uniqueDisplayPages.indexOf(selectedDisplayPage);
    if (idx < uniqueDisplayPages.length - 1) {
      setSelectedDisplayPage(uniqueDisplayPages[idx + 1]);
    } else if (selectedJuz < 30) {
      setSelectedJuz(selectedJuz + 1);
    }
  };

  // Navigate to last page of previous juz when going back
  useEffect(() => {
    // This effect is for when juz changes, set to last page if navigating backwards
    // Handled by the reset effect above which sets to first page
  }, []);

  // Track when page playback finishes
  useEffect(() => {
    if (isPagePlaying && !isPlaying && !isLoading) {
      setIsPagePlaying(false);
    }
  }, [isPlaying, isLoading, isPagePlaying]);

  if (currentPages.length === 0) return null;

  const isDualPage = currentPages.length > 1;
  const displayPageIdx = uniqueDisplayPages.indexOf(selectedDisplayPage);

  return (
    <div className="hafezi-quran">
      {/* Top Controls Bar */}
      <div className="hafezi-controls">
        <div className="hafezi-controls-left">
          <BookOpen size={18} className="hafezi-controls-icon" />
          <span className="hafezi-title">Hafezi Quran</span>
        </div>

        {/* Selectors */}
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

          {/* Page Selector — 0-based display pages */}
          <div className="hafezi-select-group">
            <label>Page</label>
            <select
              value={selectedDisplayPage}
              onChange={e => setSelectedDisplayPage(Number(e.target.value))}
              className="hafezi-select"
            >
              {uniqueDisplayPages.map(dp => {
                const pagesWithDp = currentJuz.pages.filter(p => p.displayPage === dp);
                const suffix = pagesWithDp.length > 1 ? ` (${pagesWithDp.length} pages)` : '';
                return (
                  <option key={dp} value={dp}>
                    {dp}{suffix}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* View Mode Toggle, Play & Repeat */}
        <div className="hafezi-controls-right">
          <button
            className={`hafezi-view-toggle-btn ${viewMode === 'image' ? 'active' : ''}`}
            onClick={() => setViewMode(viewMode === 'text' ? 'image' : 'text')}
            title={viewMode === 'text' ? 'Switch to Image view' : 'Switch to Text view'}
          >
            {viewMode === 'text' ? <Image size={16} /> : <Type size={16} />}
            <span>{viewMode === 'text' ? 'Image' : 'Text'}</span>
          </button>
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
          disabled={displayPageIdx === 0 && selectedJuz === 1}
          title="Previous Page"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="hafezi-page-indicator">
          <span className="hafezi-page-num">
            Page {selectedDisplayPage}
            {isDualPage && <span className="hafezi-dual-badge">Side by Side</span>}
          </span>
          <span className="hafezi-page-meta">
            Para {selectedJuz} • Page {displayPageIdx + 1} of {uniqueDisplayPages.length}
          </span>
        </div>

        <button
          className="hafezi-nav-btn"
          onClick={handleNextPage}
          disabled={displayPageIdx === uniqueDisplayPages.length - 1 && selectedJuz === 30}
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

      {/* Quran Page(s) */}
      <div className={`hafezi-page-wrapper ${isDualPage ? 'dual' : ''}`} ref={pageContentRef}>
        {currentPages.map(page => (
          <SinglePage
            key={page.pageIndex}
            page={page}
            selectedJuz={selectedJuz}
            currentAyah={currentAyah}
            isPlaying={isPlaying}
            onPlayAyah={onPlayAyah}
            isDualPage={isDualPage}
            viewMode={viewMode}
          />
        ))}
      </div>
    </div>
  );
};

/* ---- Single Page Component ---- */

interface SinglePageProps {
  page: PageData;
  selectedJuz: number;
  currentAyah: Ayah | null;
  isPlaying: boolean;
  onPlayAyah: (ayah: Ayah) => void;
  isDualPage: boolean;
  viewMode: 'text' | 'image';
}

const SinglePage: React.FC<SinglePageProps> = ({
  page,
  selectedJuz,
  currentAyah,
  isPlaying,
  onPlayAyah,
  isDualPage,
  viewMode,
}) => {
  // Detect surah starts on current page
  const surahStartsOnPage = useMemo(() => {
    const starts: { surahNumber: number; surahName: string; surahArabicName: string; index: number }[] = [];
    page.ayahs.forEach((ayah, idx) => {
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
  }, [page]);

  // Build lines
  const pageLines = useMemo(() => {
    interface LinePart {
      text: string;
      ayah: EnrichedAyah;
      isPlaying: boolean;
    }

    interface Line {
      parts: LinePart[];
      surahStart?: { surahNumber: number; surahName: string; surahArabicName: string };
    }

    const lines: Line[] = [];

    page.ayahs.forEach((ayah, idx) => {
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
  }, [page, currentAyah, isPlaying, surahStartsOnPage]);

  return (
    <div className={`hafezi-page ${isDualPage ? 'hafezi-page-half' : ''}`}>
      {/* Page header ornament */}
      <div className="hafezi-page-header-ornament">
        <div className="hafezi-ornament-line"></div>
        <div className="hafezi-page-juz-badge">
          الجزء {toArabicNumber(selectedJuz)}
        </div>
        <div className="hafezi-ornament-line"></div>
      </div>

      {/* Content */}
      {viewMode === 'image' ? (
        <div className="hafezi-page-content hafezi-image-view">
          {page.pageImage ? (
            <img
              src={page.pageImage}
              alt={`Page ${page.displayPage} - Para ${selectedJuz}`}
              className="hafezi-page-image"
            />
          ) : (
            <div className="hafezi-no-image">
              <Image size={48} />
              <p>No image uploaded for this page</p>
              <span>Upload an image from the Admin Panel</span>
            </div>
          )}
        </div>
      ) : (
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
      )}

      {/* Page footer */}
      <div className="hafezi-page-footer">
        <span>{page.displayPage}</span>
      </div>
    </div>
  );
};
