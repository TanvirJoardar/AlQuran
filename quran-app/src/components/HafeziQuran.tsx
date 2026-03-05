import React, { useMemo, useState, useEffect, useRef } from "react";
import type { Surah, Ayah } from "../types/quran";
import { toArabicNumber, formatTime } from "../utils/helpers";
import { getPageMappings } from "../services/database";
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
  Maximize2,
  Minimize2,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  Volume1,
  VolumeX,
  BookMarked,
  Link2,
} from "lucide-react";

type EnrichedAyah = Ayah & {
  surahNumber: number;
  surahName: string;
  surahArabicName: string;
};

interface PageData {
  pageNumber: number; // original quran page number
  displayPage: number; // user-editable display page (1-based)
  pageIndex: number; // immutable 0-based index within juz
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
  jumpToAyah?: Ayah | null;
  // Player props for embedded sidebar player
  currentTime: number;
  duration: number;
  volume: number;
  surahName?: string;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onVolumeChange: (vol: number) => void;
  sidebarOpen?: boolean;
}

// Arabic Juz names
const juzNames: Record<number, string> = {
  1: "الم",
  2: "سَيَقُولُ",
  3: "تِلْكَ الرُّسُلُ",
  4: "لَنْ تَنَالُوا",
  5: "وَالْمُحْصَنَاتُ",
  6: "لَا يُحِبُّ اللَّهُ",
  7: "وَإِذَا سَمِعُوا",
  8: "وَلَوْ أَنَّنَا",
  9: "قَالَ الْمَلَأُ",
  10: "وَاعْلَمُوا",
  11: "يَعْتَذِرُونَ",
  12: "وَمَا مِنْ دَابَّةٍ",
  13: "وَمَا أُبَرِّئُ",
  14: "رُبَمَا",
  15: "سُبْحَانَ الَّذِي",
  16: "قَالَ أَلَمْ",
  17: "اقْتَرَبَ",
  18: "قَدْ أَفْلَحَ",
  19: "وَقَالَ الَّذِينَ",
  20: "أَمَّنْ خَلَقَ",
  21: "اتْلُ مَا أُوحِيَ",
  22: "وَمَنْ يَقْنُتْ",
  23: "وَمَا لِيَ",
  24: "فَمَنْ أَظْلَمُ",
  25: "إِلَيْهِ يُرَدُّ",
  26: "حم",
  27: "قَالَ فَمَا خَطْبُكُمْ",
  28: "قَدْ سَمِعَ اللَّهُ",
  29: "تَبَارَكَ الَّذِي",
  30: "عَمَّ",
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
  jumpToAyah,
  currentTime,
  duration,
  volume,
  surahName,
  onTogglePlay,
  onSeek,
  onPrevious,
  onNext,
  onVolumeChange,
  sidebarOpen = true,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [selectedJuz, setSelectedJuz] = useState(1);
  const [selectedDisplayPage, setSelectedDisplayPage] = useState(0);
  const [repeatOn, setRepeatOn] = useState(false);
  const [isPagePlaying, setIsPagePlaying] = useState(false);
  const [viewMode, setViewMode] = useState<"text" | "image">("text");
  const [prevVolume, setPrevVolume] = useState(1);
  const [fitToHeight, setFitToHeight] = useState(false);
  const [dualPageView, setDualPageView] = useState(false);
  const [paraContinuous, setParaContinuous] = useState(true);
  const pageContentRef = useRef<HTMLDivElement>(null);

  const playerProgress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const handleToggleMute = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      onVolumeChange(0);
    } else {
      onVolumeChange(prevVolume || 1);
    }
  };

  // Build all enriched ayahs once
  const allAyahs = useMemo<EnrichedAyah[]>(() => {
    const result: EnrichedAyah[] = [];
    surahs.forEach((s) => {
      s.ayahs.forEach((a) => {
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
    allAyahs.forEach((a) => {
      if (!pageMap.has(a.page)) pageMap.set(a.page, []);
      pageMap.get(a.page)!.push(a);
    });

    // Group pages by juz
    const juzMap = new Map<number, PageData[]>();
    for (let j = 1; j <= 30; j++) {
      juzMap.set(j, []);
    }

    allAyahs.forEach((a) => {
      const juz = a.juz;
      const pages = juzMap.get(juz)!;
      if (!pages.find((p) => p.pageNumber === a.page)) {
        pages.push({
          pageNumber: a.page,
          displayPage: 0, // will be set below
          pageIndex: 0, // will be set below
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
    // We use customMappings as the authoritative ordered list so that
    // admin-added and admin-deleted pages are fully reflected.
    const result: JuzData[] = [];
    for (let j = 1; j <= 30; j++) {
      const origPages = juzMap.get(j)!;
      const customMappings = getPageMappings(j);

      if (customMappings.length > 0) {
        // Build pages directly from DB rows (handles adds, deletes, reorders)
        const customPages: PageData[] = customMappings.map((mapping) => {
          const ayahs = allAyahs.filter(
            (a) =>
              a.number >= mapping.customStartAyah &&
              a.number <= mapping.customEndAyah,
          );
          return {
            pageNumber: mapping.originalPage,
            displayPage: mapping.displayPage,
            pageIndex: mapping.pageIndex,
            ayahs,
            pageImage: mapping.pageImage || null,
          };
        });
        result.push({ juzNumber: j, pages: customPages });
      } else {
        result.push({ juzNumber: j, pages: origPages });
      }
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surahs, allAyahs, mappingsVersion]);

  // Navigate to juz+page when jumpToAyah prop is set (e.g. when switching tabs)
  useEffect(() => {
    if (!jumpToAyah || juzData.length === 0) return;
    for (const juz of juzData) {
      for (const page of juz.pages) {
        if (page.ayahs.some((a) => a.number === jumpToAyah.number)) {
          setSelectedJuz(juz.juzNumber);
          setSelectedDisplayPage(page.displayPage);
          return;
        }
      }
    }
  }, [jumpToAyah, juzData]);

  const currentJuz = juzData.find((j) => j.juzNumber === selectedJuz)!;

  // Get unique display page numbers sorted
  const uniqueDisplayPages = useMemo(() => {
    if (!currentJuz) return [];
    const set = new Set(currentJuz.pages.map((p) => p.displayPage));
    return Array.from(set).sort((a, b) => a - b);
  }, [currentJuz]);

  // Find all pages matching the selected display page (1 or more for side-by-side)
  const currentPages = useMemo(() => {
    if (!currentJuz) return [];
    return currentJuz.pages.filter(
      (p) => p.displayPage === selectedDisplayPage,
    );
  }, [currentJuz, selectedDisplayPage]);

  // In dual-page view, always show an even–odd spread:
  // even page on the RIGHT, odd page on the LEFT (like a physical book).
  // If user selects page 3 (odd): show page 2 (right) + page 3 (left)
  // If user selects page 10 (even): show page 10 (right) + page 11 (left)
  //
  // Special case – 1st page of a para (displayPage=1, always odd):
  // evenPage would be 0 (non-existent), so show the last page of the
  // previous para on the RIGHT, and the 1st page of the current para on LEFT.
  //
  // Para Continuous: when ON and the selected page is the last page of a para
  // (which is even), the left side shows the 1st page of the next para.
  const visiblePages = useMemo(() => {
    if (!dualPageView || !currentJuz) return currentPages;

    let evenPage: number; // will be on the right
    let oddPage: number;  // will be on the left

    if (selectedDisplayPage % 2 === 0) {
      evenPage = selectedDisplayPage;
      oddPage = selectedDisplayPage + 1;
    } else {
      evenPage = selectedDisplayPage - 1;
      oddPage = selectedDisplayPage;
    }

    let rightPages = evenPage > 0
      ? currentJuz.pages.filter(p => p.displayPage === evenPage)
      : [];
    let leftPages = currentJuz.pages.filter(p => p.displayPage === oddPage);

    // Rule: when on the 1st page of a para (displayPage=1, which is odd),
    // evenPage === 0 so rightPages is empty. Show the last page of the
    // previous para on the right side instead of a blank.
    if (rightPages.length === 0 && evenPage <= 0 && selectedJuz > 1) {
      const prevJuz = juzData.find(j => j.juzNumber === selectedJuz - 1);
      if (prevJuz && prevJuz.pages.length > 0) {
        const lastPrevPage = prevJuz.pages[prevJuz.pages.length - 1];
        rightPages = [lastPrevPage];
      }
    }

    // Para Continuous: if oddPage doesn't exist in current juz (we're at the
    // last even page) and paraContinuous is ON, pull the 1st page of next juz
    if (leftPages.length === 0 && paraContinuous && selectedJuz < 30) {
      const nextJuz = juzData.find(j => j.juzNumber === selectedJuz + 1);
      if (nextJuz && nextJuz.pages.length > 0) {
        // 1st page of next para
        const firstNextPage = nextJuz.pages[0];
        leftPages = [firstNextPage];
      }
    }

    // Combine: right page first (rendered first in RTL row-reverse), then left
    const pages = [...rightPages, ...leftPages];
    return pages.length > 0 ? pages : currentPages;
  }, [dualPageView, currentPages, currentJuz, selectedDisplayPage, paraContinuous, selectedJuz, juzData]);

  // Determine juz numbers for visible pages (for navigation display)
  const visiblePagesJuzInfo = useMemo(() => {
    return visiblePages.map(page => {
      // Find which juz this page belongs to
      for (const juz of juzData) {
        if (juz.pages.some(p => p.pageIndex === page.pageIndex && p.pageNumber === page.pageNumber)) {
          return { page, juzNumber: juz.juzNumber };
        }
      }
      return { page, juzNumber: selectedJuz };
    });
  }, [visiblePages, juzData, selectedJuz]);

  // Combined ayahs for playback — always use only the selected page,
  // Ayahs for playback in dual view:
  //   • Selected page is EVEN (sits on the right): play the even page first,
  //     then the companion odd page (left) — visiblePages is already [even, odd].
  //   • Selected page is ODD (sits on the left): only play the selected page;
  //     the even page on the right belongs to the previous reading position.
  //   • Single-page view: play only the current page as usual.
  const allPageAyahs = useMemo(() => {
    if (dualPageView && selectedDisplayPage % 2 === 0) {
      // Even selected → play right (even) then left (odd)
      return visiblePages.flatMap((p) => p.ayahs);
    }
    return currentPages.flatMap((p) => p.ayahs);
  }, [dualPageView, selectedDisplayPage, visiblePages, currentPages]);

  // Reset display page when juz changes
  useEffect(() => {
    if (uniqueDisplayPages.length > 0) {
      setSelectedDisplayPage(uniqueDisplayPages[0]);
    }
  }, [selectedJuz, uniqueDisplayPages.length]);

  // Scroll to top when page changes
  useEffect(() => {
    pageContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedDisplayPage, selectedJuz]);

  // Fit-to-height: if text content overflows vertically, auto-reduce font size
  // (instead of enabling a vertical scrollbar).
  useEffect(() => {
    const rootEl = rootRef.current;
    if (!rootEl) return;

    const setScale = (value: number) => {
      rootEl.style.setProperty("--hafezi-font-scale", value.toFixed(3));
    };

    const shouldAutoFit = (fitToHeight || dualPageView) && viewMode === "text";

    // Reset when not in auto-fit mode
    if (!shouldAutoFit) {
      setScale(1);
      return;
    }

    let rafId = 0;
    const recompute = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const pages = Array.from(
          rootEl.querySelectorAll<HTMLElement>(".hafezi-page"),
        );
        if (pages.length === 0) {
          setScale(1);
          return;
        }

        const fitsAtScale = (scale: number) => {
          setScale(scale);
          // After applying, measure overflow in the next frame.
          // But for responsiveness, we do a best-effort synchronous check;
          // subsequent iterations will refine.
          return pages.every((page) => {
            const clientHeight = page.clientHeight;
            const scrollHeight = page.scrollHeight;
            return scrollHeight <= clientHeight + 1;
          });
        };

        // Fast path: no overflow at scale 1.
        setScale(1);
        const overflowsAt1 = pages.some(
          (page) => page.scrollHeight > page.clientHeight + 1,
        );
        if (!overflowsAt1) return;

        const minScale = 0.55;
        let low = minScale;
        let high = 1;
        let best = minScale;

        for (let i = 0; i < 12; i++) {
          const mid = (low + high) / 2;
          if (fitsAtScale(mid)) {
            best = mid;
            low = mid;
          } else {
            high = mid;
          }
        }

        setScale(best);
      });
    };

    recompute();

    const resizeObserver = new ResizeObserver(() => {
      recompute();
    });

    // Observe layout-affecting elements.
    const pageArea = rootEl.querySelector<HTMLElement>(".hafezi-page-area");
    if (pageArea) resizeObserver.observe(pageArea);
    const sidebar = rootEl.querySelector<HTMLElement>(".hafezi-sidebar");
    if (sidebar) resizeObserver.observe(sidebar);
    rootEl
      .querySelectorAll<HTMLElement>(".hafezi-page")
      .forEach((el) => resizeObserver.observe(el));

    window.addEventListener("resize", recompute);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", recompute);
      resizeObserver.disconnect();
    };
  }, [fitToHeight, dualPageView, viewMode, selectedDisplayPage, selectedJuz, paraContinuous, sidebarOpen]);

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
    const step = dualPageView ? 2 : 1;
    const idx = uniqueDisplayPages.indexOf(selectedDisplayPage);
    if (idx - step >= 0) {
      setSelectedDisplayPage(uniqueDisplayPages[idx - step]);
    } else if (idx > 0) {
      setSelectedDisplayPage(uniqueDisplayPages[0]);
    } else if (selectedJuz > 1) {
      setSelectedJuz(selectedJuz - 1);
    }
  };

  const handleNextPage = () => {
    const step = dualPageView ? 2 : 1;
    const idx = uniqueDisplayPages.indexOf(selectedDisplayPage);
    if (idx + step < uniqueDisplayPages.length) {
      setSelectedDisplayPage(uniqueDisplayPages[idx + step]);
    } else if (idx < uniqueDisplayPages.length - 1) {
      setSelectedDisplayPage(uniqueDisplayPages[uniqueDisplayPages.length - 1]);
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

  // Navigate sidebar to the page containing `currentAyah`
  const handleGoToCurrentAyah = () => {
    if (!currentAyah) return;
    for (const juz of juzData) {
      for (const page of juz.pages) {
        if (page.ayahs.some((a) => a.number === currentAyah.number)) {
          setSelectedJuz(juz.juzNumber);
          setSelectedDisplayPage(page.displayPage);
          return;
        }
      }
    }
  };

  if (currentPages.length === 0) return null;

  const isDualPage = visiblePages.length > 1;
  const displayPageIdx = uniqueDisplayPages.indexOf(selectedDisplayPage);
  // Derive the display page range shown in dual view
  const dualRightPage = isDualPage ? visiblePages[0].displayPage : null;
  const dualLeftPage = isDualPage ? visiblePages[visiblePages.length - 1].displayPage : null;

  return (
    <div
      ref={rootRef}
      className={`hafezi-quran${fitToHeight ? ' fit-to-height' : ''}${dualPageView ? ' dual-auto-fit' : ''}`}
    >
      {/* ---- Left Control Panel ---- */}
      <div className={`hafezi-sidebar${sidebarOpen ? '' : ' collapsed'}`}>
        {/* Brand / Title */}
        <div className="hafezi-sidebar-header">
          <BookOpen size={20} className="hafezi-controls-icon" />
          <span className="hafezi-title">Hafezi Quran</span>
        </div>

        {/* Para (Juz) Selector + Page Selector */}
        {fitToHeight ? (
          <div className="hafezi-row-group">
            <div className="hafezi-sidebar-section">
              <label className="hafezi-sidebar-label">PARA (JUZ)</label>
              <select
                value={selectedJuz}
                onChange={(e) => setSelectedJuz(Number(e.target.value))}
                className="hafezi-select"
              >
                {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
                  <option key={j} value={j}>
                    {j} - {juzNames[j]}
                  </option>
                ))}
              </select>
            </div>

            <div className="hafezi-sidebar-section">
              <label className="hafezi-sidebar-label">PAGE</label>
              <select
                value={selectedDisplayPage}
                onChange={(e) => setSelectedDisplayPage(Number(e.target.value))}
                className="hafezi-select"
              >
                {uniqueDisplayPages.map((dp) => {
                  const pagesWithDp = currentJuz.pages.filter(
                    (p) => p.displayPage === dp,
                  );
                  const suffix =
                    pagesWithDp.length > 1 ? ` (${pagesWithDp.length} pages)` : "";
                  return (
                    <option key={dp} value={dp}>
                      {dp}
                      {suffix}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        ) : (
          <>
            {/* Para (Juz) Selector */}
            <div className="hafezi-sidebar-section">
              <label className="hafezi-sidebar-label">PARA (JUZ)</label>
              <select
                value={selectedJuz}
                onChange={(e) => setSelectedJuz(Number(e.target.value))}
                className="hafezi-select"
              >
                {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => (
                  <option key={j} value={j}>
                    {j} - {juzNames[j]}
                  </option>
                ))}
              </select>
            </div>

            {/* Page Selector */}
            <div className="hafezi-sidebar-section">
              <label className="hafezi-sidebar-label">PAGE</label>
              <select
                value={selectedDisplayPage}
                onChange={(e) => setSelectedDisplayPage(Number(e.target.value))}
                className="hafezi-select"
              >
                {uniqueDisplayPages.map((dp) => {
                  const pagesWithDp = currentJuz.pages.filter(
                    (p) => p.displayPage === dp,
                  );
                  const suffix =
                    pagesWithDp.length > 1 ? ` (${pagesWithDp.length} pages)` : "";
                  return (
                    <option key={dp} value={dp}>
                      {dp}
                      {suffix}
                    </option>
                  );
                })}
              </select>
            </div>
          </>
        )}

        {/* Page Navigation */}
        <div className="hafezi-sidebar-section">
          <label className="hafezi-sidebar-label">NAVIGATION</label>
          <div className="hafezi-page-indicator">
            <span className="hafezi-page-num">
              {dualRightPage !== null && dualLeftPage !== null && dualRightPage !== dualLeftPage
                ? `Pages ${dualRightPage}–${dualLeftPage}`
                : `Page ${selectedDisplayPage}`
              }
            </span>
            {isDualPage && visiblePagesJuzInfo.length === 2 ? (
              // Show juz info for each page when they're from different paras
              visiblePagesJuzInfo[0].juzNumber !== visiblePagesJuzInfo[1].juzNumber ? (
                <span className="hafezi-page-meta">
                  Page {visiblePagesJuzInfo[0].page.displayPage} from Para {visiblePagesJuzInfo[0].juzNumber} • Page {visiblePagesJuzInfo[1].page.displayPage} from Para {visiblePagesJuzInfo[1].juzNumber}
                </span>
              ) : (
                <span className="hafezi-page-meta">
                  Para {selectedJuz} • {displayPageIdx + 1} of {uniqueDisplayPages.length}
                </span>
              )
            ) : (
              <span className="hafezi-page-meta">
                Para {selectedJuz} • {displayPageIdx + 1} of {uniqueDisplayPages.length}
              </span>
            )}
            {isDualPage && (
              <span className="hafezi-dual-badge">{dualPageView ? "Dual View" : "Side by Side"}</span>
            )}
          </div>
          <div className="hafezi-nav-row">
            <button
              className="hafezi-nav-btn"
              onClick={() => {
                setSelectedJuz(Math.max(1, selectedJuz - 1));
              }}
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
            <button
              className="hafezi-nav-btn"
              onClick={handleNextPage}
              disabled={
                displayPageIdx === uniqueDisplayPages.length - 1 &&
                selectedJuz === 30
              }
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
            <button
              className="hafezi-nav-btn"
              onClick={() => {
                setSelectedJuz(Math.min(30, selectedJuz + 1));
              }}
              disabled={selectedJuz >= 30}
              title="Next Para"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="hafezi-sidebar-divider" />

        {/* View Mode Toggle */}
        <div className={`hafezi-sidebar-section${fitToHeight ? ' hafezi-button-row' : ''}`}>
          <label className="hafezi-sidebar-label">VIEW MODE</label>
          <button
            className={`hafezi-view-toggle-btn ${viewMode === "image" ? "active" : ""}`}
            onClick={() => setViewMode(viewMode === "text" ? "image" : "text")}
            title={
              viewMode === "text"
                ? "Switch to Image view"
                : "Switch to Text view"
            }
          >
            {viewMode === "text" ? <Image size={16} /> : <Type size={16} />}
            <span>{viewMode === "text" ? "Image" : "Text"}</span>
          </button>
          <button
            className={`hafezi-view-toggle-btn ${fitToHeight ? "active" : ""}`}
            onClick={() => setFitToHeight(!fitToHeight)}
            title={fitToHeight ? 'Exit fit-to-height' : 'Fit page and sidebar to device height'}
          >
            {fitToHeight ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span>{fitToHeight ? 'Scroll' : 'Fit'}</span>
          </button>
          <button
            className={`hafezi-view-toggle-btn ${dualPageView ? "active" : ""}`}
            onClick={() => setDualPageView(!dualPageView)}
            title={dualPageView ? "Switch to Single Page view" : "Switch to Dual Page (book spread) view"}
          >
            <BookOpen size={16} />
            <span>{dualPageView ? '1 Page' : '2 Pages'}</span>
          </button>
          {dualPageView && (
            <button
              className={`hafezi-view-toggle-btn ${paraContinuous ? "active" : ""}`}
              onClick={() => setParaContinuous(!paraContinuous)}
              title={paraContinuous ? "Para Continuous ON – last page of a para shows next para's first page" : "Para Continuous OFF – only show pages within current para"}
            >
              <Link2 size={16} />
              <span>{paraContinuous ? 'Continuous' : 'Separated'}</span>
            </button>
          )}
        </div>

        {/* Playback */}
        <div className="hafezi-sidebar-section">
          <label className="hafezi-sidebar-label">PAGE PLAYBACK</label>
          <div className="hafezi-playback-row">
            <button
              className={`hafezi-repeat-btn ${repeatOn ? "active" : ""}`}
              onClick={handleToggleRepeat}
              title={repeatOn ? "Repeat ON" : "Repeat OFF"}
            >
              <Repeat size={16} />
            </button>
            <button
              className={`hafezi-play-page-btn ${isPagePlaying ? "playing" : ""}`}
              onClick={handlePlayPage}
              title={isPagePlaying ? "Stop page" : "Play page"}
            >
              {isLoading && isPagePlaying ? (
                <Loader size={16} className="spin" />
              ) : isPagePlaying && isPlaying ? (
                <Pause size={16} />
              ) : (
                <Play size={16} />
              )}
              <span>{isPagePlaying && isPlaying ? "Stop" : "Play Page"}</span>
            </button>
          </div>
        </div>

        {/* Spacer pushes player to bottom */}
        <div className="hafezi-sidebar-spacer" />

        {/* ---- Embedded Audio Player ---- */}
        {currentAyah && (
          <div className="hafezi-player">
            {/* Player Info (top) */}
            <div className="hafezi-player-info">
              <div className="hafezi-player-text">
                <span className="hafezi-player-surah">{surahName}</span>
                <span className="hafezi-player-ayah">
                  Ayah {currentAyah.numberInSurah} • Juz {currentAyah.juz} •
                  Page {currentAyah.page}
                </span>
              </div>
              <button
                className="hafezi-player-goto-btn"
                onClick={handleGoToCurrentAyah}
                title="Go to this ayah's page"
              >
                <BookMarked size={15} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="hafezi-player-progress">
              <div
                className="hafezi-player-progress-fill"
                style={{ width: `${playerProgress}%` }}
              />
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={(e) => onSeek(Number(e.target.value))}
                className="hafezi-player-progress-input"
              />
            </div>

            {/* Time */}
            <div className="hafezi-player-time">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Controls (bottom) */}
            <div className="hafezi-player-controls">
              <button
                className="hafezi-player-btn"
                onClick={onPrevious}
                title="Previous Ayah"
              >
                <SkipBack size={16} />
              </button>
              <button
                className="hafezi-player-btn hafezi-player-btn-main"
                onClick={onTogglePlay}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isLoading ? (
                  <Loader size={20} className="spin" />
                ) : isPlaying ? (
                  <Pause size={20} />
                ) : (
                  <Play size={20} />
                )}
              </button>
              <button
                className="hafezi-player-btn"
                onClick={onNext}
                title="Next Ayah"
              >
                <SkipForward size={16} />
              </button>
              <button
                className="hafezi-player-btn"
                onClick={onStop}
                title="Stop"
              >
                <Square size={14} />
              </button>
            </div>

            {/* Volume slider */}
            <div className="hafezi-player-volume-slider">
              <button
                className="hafezi-player-vol-btn"
                onClick={handleToggleMute}
                title={volume === 0 ? "Unmute" : "Mute"}
              >
                <VolumeIcon size={14} />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
              />
              <span className="hafezi-player-volume-pct">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ---- Right: Quran Page Area ---- */}
      <div className="hafezi-page-area" ref={pageContentRef}>
        <div className={`hafezi-page-wrapper ${isDualPage ? "dual" : ""}`}>
          {visiblePages.map((page, idx) => {
            const pageJuzInfo = visiblePagesJuzInfo.find(
              info => info.page.pageIndex === page.pageIndex && info.page.pageNumber === page.pageNumber
            );
            return (
              <SinglePage
                key={`${page.pageIndex}-${page.pageNumber}`}
                page={page}
                selectedJuz={pageJuzInfo?.juzNumber || selectedJuz}
                currentAyah={currentAyah}
                isPlaying={isPlaying}
                onPlayAyah={onPlayAyah}
                isDualPage={isDualPage}
                viewMode={viewMode}
                pagePosition={
                  isDualPage ? (idx === 0 ? "right" : "left") : undefined
                }
                jumpToAyah={jumpToAyah}
              />
            );
          })}
        </div>
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
  viewMode: "text" | "image";
  pagePosition?: "right" | "left";
  jumpToAyah?: Ayah | null;
}

const SinglePage: React.FC<SinglePageProps> = ({
  page,
  selectedJuz,
  currentAyah,
  isPlaying,
  onPlayAyah,
  isDualPage,
  viewMode,
  pagePosition,
  jumpToAyah,
}) => {

  // Normalize Arabic text for better comparison (e.g. to detect Bismillah)
  const normalizeArabic = (text: string) => {
    return text
      .normalize("NFKD")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/ٱ/g, "ا")
      .trim();
  }

  // Detect surah starts on current page
  const surahStartsOnPage = useMemo(() => {
    const starts: {
      surahNumber: number;
      surahName: string;
      surahArabicName: string;
      index: number;
    }[] = [];
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
      surahStart?: {
        surahNumber: number;
        surahName: string;
        surahArabicName: string;
      };
    }

    const lines: Line[] = [];

    page.ayahs.forEach((ayah, idx) => {
      const surahStart = surahStartsOnPage.find((s) => s.index === idx);
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

      const normalizedAyah = normalizeArabic(ayah.text);
      const normalizedBismillah = normalizeArabic("بسم الله الرحمن الرحيم");

      if (
        ayah.numberInSurah === 1 &&
        normalizedAyah.startsWith(normalizedBismillah)
      ) {
        ayah.text = ayah.text.replace(/^.*?ٱلرَّحِيمِ\s*/u, "");
      }

      const ayahText = `${ayah.text} ﴿${toArabicNumber(ayah.numberInSurah)}﴾`;
      const isActive = currentAyah?.number === ayah.number || jumpToAyah?.number === ayah.number;

      if (
        lines.length === 0 ||
        lines[lines.length - 1].surahStart ||
        lines[lines.length - 1].parts.length === 0
      ) {
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
  }, [page, currentAyah, isPlaying, surahStartsOnPage, jumpToAyah]);

  return (
    <div
      className={`hafezi-page ${isDualPage ? "hafezi-page-half" : ""} ${pagePosition ? `page-${pagePosition}` : ""}`}
    >
      {/* Page header ornament */}
      <div className="hafezi-page-header-ornament">
        <div className="hafezi-ornament-line"></div>
        <div className="hafezi-page-juz-badge">
          الجزء {toArabicNumber(selectedJuz)}
        </div>
        <div className="hafezi-ornament-line"></div>
      </div>

      {/* Content */}
      {viewMode === "image" ? (
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
                      <span className="hafezi-surah-name-ar">
                        {line.surahStart.surahArabicName}
                      </span>
                    </div>
                    <div className="hafezi-surah-ornament-wing right"></div>
                  </div>
                  {line.surahStart.surahNumber !== 9 &&
                    line.surahStart.surahNumber !== 1 && (
                      <div className="hafezi-bismillah">
                        بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                      </div>
                    )}
                </div>
              );
            }

            return (
              <div
                key={`line-${lineIdx}`}
                className="hafezi-line"
                dir="rtl"
                lang="ar"
              >
                {line.parts.map((part, partIdx) => (
                  <span
                    key={`${part.ayah.number}-${partIdx}`}
                    className={`hafezi-ayah-text ${
                      (currentAyah?.number === part.ayah.number || jumpToAyah?.number === part.ayah.number) ? "active" : ""
                    } ${part.isPlaying ? "playing" : ""}`}
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
