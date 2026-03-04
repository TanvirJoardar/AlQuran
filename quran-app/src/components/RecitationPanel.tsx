import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { Surah, Ayah } from '../types/quran';
import { getPageMappings } from '../services/database';
import {
  Headphones,
  Play,
  Pause,
  Square,
  ChevronRight,
  Loader,
  BookOpen,
  SkipForward,
  Repeat,
  Infinity,
} from 'lucide-react';

interface RecitationPanelProps {
  surahs: Surah[];
  currentAyah: Ayah | null;
  isPlaying: boolean;
  isLoading: boolean;
  mappingsVersion?: number;
  onPlay: (ayahs: Ayah[]) => void;
  onStop: () => void;
  onSetRepeat: (v: boolean) => void;
  onSetAyahsList: (ayahs: Ayah[]) => void;
  onSetAutoPlayNext: (v: boolean) => void;
  onSetOnPlaylistEnd: (cb: (() => void) | null) => void;
}

type EnrichedAyah = Ayah & { surahNumber: number; surahName: string; juzNumber: number; pageIndex: number };

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

export const RecitationPanel: React.FC<RecitationPanelProps> = ({
  surahs,
  currentAyah,
  isPlaying,
  isLoading,
  mappingsVersion,
  onPlay,
  onStop,
  onSetRepeat,
  onSetAyahsList,
  onSetAutoPlayNext,
  onSetOnPlaylistEnd,
}) => {
  const [selectedPage, setSelectedPage] = useState(1);
  const [fromPara, setFromPara] = useState(1);
  const [toPara, setToPara] = useState(30);
  const [isActive, setIsActive] = useState(false);
  // repeatCount: 0 = infinite, 1+ = fixed number of rounds
  const [repeatCount, setRepeatCount] = useState(1);
  const [currentRound, setCurrentRound] = useState(1);
  const currentRoundRef  = useRef(1);
  const repeatCountRef   = useRef(1);
  const playlistRef      = useRef<Ayah[]>([]);
  const isActiveRef      = useRef(false);

  // Flat enriched ayah map: ayah.number -> EnrichedAyah
  const allAyahsMap = useMemo(() => {
    const map = new Map<number, EnrichedAyah>();
    surahs.forEach(s => {
      s.ayahs.forEach(a => {
        map.set(a.number, {
          ...a,
          surahNumber: s.number,
          surahName: s.englishName,
          juzNumber: a.juz,
          pageIndex: 0,
        });
      });
    });
    return map;
  }, [surahs]);

  // How many pages each para actually has (max displayPage across all mappings)
  const paraPageCounts = useMemo(() => {
    const result: Record<number, number> = {};
    for (let j = 1; j <= 30; j++) {
      const mappings = getPageMappings(j);
      if (mappings.length === 0) {
        result[j] = 20; // fallback
      } else {
        result[j] = Math.max(...mappings.map(m => m.displayPage));
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappingsVersion]);

  // Max pages selectable = min of maxPages across the selected para range
  const maxSelectablePage = useMemo(() => {
    let min = 25;
    for (let j = fromPara; j <= toPara; j++) {
      min = Math.min(min, paraPageCounts[j] ?? 25);
    }
    return Math.max(1, min);
  }, [fromPara, toPara, paraPageCounts]);

  // Clamp selectedPage when range changes
  useEffect(() => {
    if (selectedPage > maxSelectablePage) setSelectedPage(maxSelectablePage);
  }, [maxSelectablePage]);

  // Build the playlist: for each para in [fromPara..toPara],
  // find the page with displayPage === selectedPage, collect its ayahs in order.
  const playlist = useMemo(() => {
    const ayahs: Ayah[] = [];
    for (let j = fromPara; j <= toPara; j++) {
      const mappings = getPageMappings(j);
      const match = mappings.filter(m => m.displayPage === selectedPage);
      // sort by pageIndex so dual-pages come in order
      match.sort((a, b) => a.pageIndex - b.pageIndex);
      match.forEach(m => {
        for (let n = m.customStartAyah; n <= m.customEndAyah; n++) {
          const a = allAyahsMap.get(n);
          if (a) ayahs.push(a);
        }
      });
    }
    return ayahs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromPara, toPara, selectedPage, allAyahsMap, mappingsVersion]);

  // Which para is currently being played
  const activeParaInfo = useMemo(() => {
    if (!currentAyah || !isActive) return null;
    const a = allAyahsMap.get(currentAyah.number);
    if (!a) return null;
    return { juz: a.juzNumber, surahName: a.surahName };
  }, [currentAyah, isActive, allAyahsMap]);

  // Which page within the active para is playing
  const activeParaPage = useMemo(() => {
    if (!currentAyah || !isActive) return null;
    const a = allAyahsMap.get(currentAyah.number);
    if (!a) return null;
    const mappings = getPageMappings(a.juzNumber);
    const match = mappings.find(
      m => currentAyah.number >= m.customStartAyah && currentAyah.number <= m.customEndAyah
    );
    return match ? match.displayPage : null;
  }, [currentAyah, isActive, allAyahsMap]);

  // Detect playback ending — only used when repeat is off (rounds=1); multi-round handled via onSetOnPlaylistEnd
  useEffect(() => {
    if (isActive && !isPlaying && !isLoading) {
      setIsActive(false);
      isActiveRef.current = false;
    }
  }, [isPlaying, isLoading, isActive]);

  // Keep refs in sync
  useEffect(() => { repeatCountRef.current = repeatCount; }, [repeatCount]);

  const startRound = useCallback((pl: Ayah[], round: number) => {
    onSetRepeat(false);
    onSetAyahsList(pl);
    onSetAutoPlayNext(true);
    onPlay(pl);
    currentRoundRef.current = round;
    setCurrentRound(round);
  }, [onPlay, onSetRepeat, onSetAyahsList, onSetAutoPlayNext]);

  const handlePlay = useCallback(() => {
    if (playlistRef.current.length === 0) return;
    const pl = playlistRef.current;

    // Register end-of-round callback for repeat
    onSetOnPlaylistEnd(() => {
      if (!isActiveRef.current) return;
      const nextRound = currentRoundRef.current + 1;
      const maxRounds  = repeatCountRef.current; // 0 = infinite
      if (maxRounds === 0 || nextRound <= maxRounds) {
        startRound(pl, nextRound);
      } else {
        setIsActive(false);
        isActiveRef.current = false;
        onSetOnPlaylistEnd(null);
      }
    });

    isActiveRef.current = true;
    setIsActive(true);
    startRound(pl, 1);
  }, [startRound, onSetOnPlaylistEnd]);

  const handleStop = useCallback(() => {
    onStop();
    onSetOnPlaylistEnd(null);
    setIsActive(false);
    isActiveRef.current = false;
  }, [onStop, onSetOnPlaylistEnd]);

  const handleParaFromChange = (v: number) => {
    setFromPara(v);
    if (v > toPara) setToPara(v);
  };

  const handleParaToChange = (v: number) => {
    setToPara(v);
    if (v < fromPara) setFromPara(v);
  };

  const isCurrentlyPlaying = isActive && isPlaying;
  const isCurrentlyLoading = isActive && isLoading;
  const totalRounds = repeatCount === 0 ? '∞' : repeatCount;

  // Keep playlistRef synced so the end-of-round callback always has the current playlist
  useEffect(() => { playlistRef.current = playlist; }, [playlist]);

  // Build segment list for display (one row per para in range)
  const segments = useMemo(() => {
    return Array.from({ length: toPara - fromPara + 1 }, (_, i) => {
      const juz = fromPara + i;
      const mappings = getPageMappings(juz);
      const match = mappings.filter(m => m.displayPage === selectedPage);
      const ayahCount = match.reduce((acc, m) => acc + (m.customEndAyah - m.customStartAyah + 1), 0);
      return { juz, ayahCount, exists: match.length > 0 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromPara, toPara, selectedPage, mappingsVersion]);

  return (
    <div className="recitation-panel">
      {/* Header */}
      <div className="recitation-header">
        <Headphones size={22} className="recitation-icon" />
        <div>
          <h2>Recitation</h2>
          <p>Play a specific page across multiple Juz (Para)</p>
        </div>
      </div>

      {/* Controls */}
      <div className="recitation-controls-card">
        <div className="recitation-field-group">
          {/* Page selector */}
          <div className="recitation-field">
            <label className="recitation-label">
              <BookOpen size={14} />
              Page within Para
            </label>
            <select
              className="recitation-select"
              value={selectedPage}
              onChange={e => setSelectedPage(Number(e.target.value))}
            >
              {Array.from({ length: maxSelectablePage }, (_, i) => i + 1).map(p => (
                <option key={p} value={p}>Page {p}</option>
              ))}
            </select>
          </div>

          {/* Para from */}
          <div className="recitation-field">
            <label className="recitation-label">From Para</label>
            <select
              className="recitation-select"
              value={fromPara}
              onChange={e => handleParaFromChange(Number(e.target.value))}
            >
              {Array.from({ length: 30 }, (_, i) => i + 1).map(j => (
                <option key={j} value={j}>{j} — {juzNames[j]}</option>
              ))}
            </select>
          </div>

          {/* Para to */}
          <div className="recitation-field">
            <label className="recitation-label">To Para</label>
            <select
              className="recitation-select"
              value={toPara}
              onChange={e => handleParaToChange(Number(e.target.value))}
            >
              {Array.from({ length: 30 }, (_, i) => i + 1).map(j => (
                <option key={j} value={j} disabled={j < fromPara}>
                  {j} — {juzNames[j]}
                </option>
              ))}
            </select>
          </div>

          {/* Repeat count */}
          <div className="recitation-field">
            <label className="recitation-label">
              <Repeat size={14} />
              Repeat
            </label>
            <div className="recitation-repeat-wrap">
              <button
                className={`recitation-repeat-btn${repeatCount === 0 ? ' active' : ''}`}
                title="Infinite repeat"
                onClick={() => setRepeatCount(0)}
              >
                <Infinity size={15} />
              </button>
              {[1, 2, 3, 5, 7, 10].map(n => (
                <button
                  key={n}
                  className={`recitation-repeat-btn${repeatCount === n ? ' active' : ''}`}
                  onClick={() => setRepeatCount(n)}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={999}
                className="recitation-repeat-custom"
                placeholder="N"
                title="Custom repeat count"
                onChange={e => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v >= 1) setRepeatCount(v);
                }}
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="recitation-summary">
          <span className="recitation-summary-text">
            Page <strong>{selectedPage}</strong> ×{' '}
            <strong>{toPara - fromPara + 1}</strong> para{toPara !== fromPara ? 's' : ''} ={' '}
            <strong>{playlist.length}</strong> ayahs
          </span>

          {/* Play / Stop */}
          <div className="recitation-play-wrap">
            {isCurrentlyLoading ? (
              <button className="recitation-play-btn loading" disabled>
                <Loader size={18} className="spin" />
                <span>Loading…</span>
              </button>
            ) : isCurrentlyPlaying ? (
              <button className="recitation-play-btn stop" onClick={handleStop}>
                <Square size={18} />
                <span>Stop</span>
              </button>
            ) : (
              <button
                className="recitation-play-btn"
                onClick={handlePlay}
                disabled={playlist.length === 0}
              >
                <Play size={18} />
                <span>Play{repeatCount !== 1 ? ` (×${repeatCount === 0 ? '∞' : repeatCount})` : ''}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Now playing banner */}
      {isActive && activeParaInfo && (
        <div className="recitation-now-playing">
          <div className="recitation-np-pulse" />
          <span className="recitation-np-label">Now Playing</span>
          <span className="recitation-np-info">
            Para {activeParaInfo.juz} — {juzNames[activeParaInfo.juz]}
            {activeParaPage !== null && <> &nbsp;·&nbsp; Page {activeParaPage}</>}
          </span>
          {(repeatCount !== 1) && (
            <span className="recitation-np-round">
              <Repeat size={12} />
              Round {currentRound}
              {repeatCount !== 0 && <span className="recitation-np-round-total"> / {totalRounds}</span>}
            </span>
          )}
          <span className="recitation-np-surah">{activeParaInfo.surahName}</span>
        </div>
      )}

      {/* Segment list */}
      <div className="recitation-segment-list">
        <div className="recitation-segment-header">
          <span className="rs-col-para">Para</span>
          <span className="rs-col-name">Name</span>
          <span className="rs-col-ayahs">Ayahs on page</span>
          <span className="rs-col-status">Status</span>
        </div>

        {segments.map(seg => {
          const isSegActive =
            isActive &&
            currentAyah !== null &&
            allAyahsMap.get(currentAyah.number)?.juzNumber === seg.juz;

          return (
            <div
              key={seg.juz}
              className={`recitation-segment-row${isSegActive ? ' active' : ''}${!seg.exists ? ' missing' : ''}`}
            >
              <span className="rs-col-para">{seg.juz}</span>
              <span className="rs-col-name">{juzNames[seg.juz]}</span>
              <span className="rs-col-ayahs">
                {seg.exists ? seg.ayahCount : '—'}
              </span>
              <span className="rs-col-status">
                {isSegActive ? (
                  <span className="rs-status playing">
                    {isCurrentlyPlaying ? <><SkipForward size={12} /> Playing</> : <><Pause size={12} /> Paused</>}
                  </span>
                ) : seg.exists ? (
                  <span className="rs-status ready">
                    <ChevronRight size={12} /> Ready
                  </span>
                ) : (
                  <span className="rs-status missing">No page {selectedPage}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
