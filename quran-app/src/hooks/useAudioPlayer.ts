import { useState, useRef, useCallback, useEffect } from 'react';
import type { Ayah } from '../types/quran';

interface AudioPlayerState {
  isPlaying: boolean;
  currentAyah: Ayah | null;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  volume: number;
}

export function useAudioPlayer() {
  // ── Double-buffer ping-pong for gapless playback ──────────────────────────
  // bufsRef[0] and bufsRef[1] swap roles: one plays while the other preloads
  // the upcoming ayah so transitions are instantaneous.
  const bufsRef  = useRef<[HTMLAudioElement, HTMLAudioElement] | null>(null);
  const activeRef = useRef<0 | 1>(0); // index of the currently-playing buffer

  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    currentAyah: null,
    currentTime: 0,
    duration: 0,
    isLoading: false,
    volume: 1,
  });

  const volumeRef = useRef(1);

  const ayahsRef         = useRef<Ayah[]>([]);
  const autoPlayNextRef  = useRef(false);
  const repeatModeRef    = useRef(false);
  const onPlaylistEndRef = useRef<(() => void) | null>(null);

  // ── Helpers (all ref-based, never stale) ──────────────────────────────────
  const getActive = (): HTMLAudioElement | null =>
    bufsRef.current?.[activeRef.current] ?? null;

  const getIdle = (): HTMLAudioElement | null => {
    const b = bufsRef.current;
    if (!b) return null;
    return b[activeRef.current === 0 ? 1 : 0];
  };

  const swapBuffers = () => {
    activeRef.current = activeRef.current === 0 ? 1 : 0;
  };

  /** Load ayah into the idle buffer so it's ready before it's needed. */
  const schedulePreload = (ayah: Ayah | null) => {
    const idle = getIdle();
    if (!idle || !ayah) return;
    if (idle.dataset.ayahNumber === String(ayah.number)) return; // already queued
    idle.pause();
    idle.src = ayah.audio;
    idle.dataset.ayahNumber = String(ayah.number);
    idle.load();
  };

  // ── Core play function ────────────────────────────────────────────────────
  /** Play `ayah` on the active buffer and immediately preload the next one. */
  const playAyah = useCallback((ayah: Ayah) => {
    const active = getActive();
    if (!active) return;

    if (active.dataset.ayahNumber !== String(ayah.number)) {
      active.src = ayah.audio;
      active.dataset.ayahNumber = String(ayah.number);
    }
    active.play().catch(() => {});

    setState(prev => ({
      ...prev,
      isPlaying: true,
      currentAyah: ayah,
      isLoading: active.readyState < 3,
    }));

    // Preload the following ayah while this one plays
    const list = ayahsRef.current;
    const idx  = list.findIndex(a => a.number === ayah.number);
    schedulePreload(idx >= 0 && idx + 1 < list.length ? list[idx + 1] : null);
  }, []); // stable — only uses refs

  // ── Wire up both audio elements once ─────────────────────────────────────
  useEffect(() => {
    const bufs: [HTMLAudioElement, HTMLAudioElement] = [new Audio(), new Audio()];
    bufsRef.current = bufs;
    bufs.forEach(a => { a.volume = volumeRef.current; });

    bufs.forEach((audio, bufIdx) => {

      audio.addEventListener('timeupdate', () => {
        if (bufIdx !== activeRef.current) return;
        setState(prev => ({ ...prev, currentTime: audio.currentTime }));
      });

      audio.addEventListener('loadedmetadata', () => {
        if (bufIdx !== activeRef.current) return;
        setState(prev => ({ ...prev, duration: audio.duration, isLoading: false }));
      });

      audio.addEventListener('canplay', () => {
        if (bufIdx !== activeRef.current) return;
        setState(prev => ({ ...prev, isLoading: false }));
      });

      audio.addEventListener('waiting', () => {
        if (bufIdx !== activeRef.current) return;
        setState(prev => ({ ...prev, isLoading: true }));
      });

      audio.addEventListener('ended', () => {
        // Only the active buffer drives progression
        if (bufIdx !== activeRef.current) return;

        if (!autoPlayNextRef.current) {
          setState(prev => ({ ...prev, isPlaying: false }));
          return;
        }

        const list       = ayahsRef.current;
        const currentNum = parseInt(audio.dataset.ayahNumber || '0');
        const idx        = list.findIndex(a => a.number === currentNum);

        if (idx >= 0 && idx < list.length - 1) {
          const next      = list[idx + 1];
          const afterNext = idx + 2 < list.length ? list[idx + 2] : null;

          const idle       = bufs[bufIdx === 0 ? 1 : 0];
          const preloaded  = idle.dataset.ayahNumber === String(next.number);
          const readyState = idle.readyState; // 0=NOTHING … 4=ENOUGH_DATA

          if (preloaded && readyState >= 2) {
            // ✅ Gapless: swap to the preloaded idle buffer and start instantly
            swapBuffers();
            idle.play().catch(() => {});
            setState(prev => ({
              ...prev,
              isPlaying: true,
              currentAyah: next,
              isLoading: idle.readyState < 3,
            }));

            // Recycle the old active buffer to preload the one after next
            audio.pause();
            if (afterNext && audio.dataset.ayahNumber !== String(afterNext.number)) {
              audio.src = afterNext.audio;
              audio.dataset.ayahNumber = String(afterNext.number);
              audio.load();
            }
          } else {
            // ⚠️ Fallback (next wasn't ready yet) — play normally on active buffer
            playAyah(next);
          }

          // Ensure the buffer after-next is queued regardless of which path we took
          if (afterNext) schedulePreload(afterNext);

        } else if (repeatModeRef.current && list.length > 0) {
          playAyah(list[0]);
        } else {
          setState(prev => ({ ...prev, isPlaying: false }));
          onPlaylistEndRef.current?.();
        }
      });
    });

    return () => {
      bufs.forEach(a => { a.pause(); a.src = ''; });
    };
  }, []); // runs once — all mutable state accessed through refs

  // ── Public API ────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const active = getActive();
    if (!active) return;

    if (state.isPlaying) {
      active.pause();
      setState(prev => ({ ...prev, isPlaying: false }));
    } else if (state.currentAyah) {
      active.play().catch(() => {});
      setState(prev => ({ ...prev, isPlaying: true }));
    }
  }, [state.isPlaying, state.currentAyah]);

  const stop = useCallback(() => {
    // Stop both buffers
    bufsRef.current?.forEach(a => { a.pause(); a.currentTime = 0; });
    setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
  }, []);

  const seek = useCallback((time: number) => {
    const active = getActive();
    if (!active) return;
    active.currentTime = time;
  }, []);

  const setAyahsList = useCallback((ayahs: Ayah[]) => {
    ayahsRef.current = ayahs;
  }, []);

  const setAutoPlayNext = useCallback((value: boolean) => {
    autoPlayNextRef.current = value;
  }, []);

  const playSurah = useCallback((ayahs: Ayah[]) => {
    ayahsRef.current = ayahs;
    autoPlayNextRef.current = true;
    if (ayahs.length > 0) {
      playAyah(ayahs[0]);
    }
  }, [playAyah]);

  const setRepeatMode = useCallback((value: boolean) => {
    repeatModeRef.current = value;
  }, []);

  const setOnPlaylistEnd = useCallback((cb: (() => void) | null) => {
    onPlaylistEndRef.current = cb;
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    volumeRef.current = clamped;
    bufsRef.current?.forEach(a => { a.volume = clamped; });
    setState(prev => ({ ...prev, volume: clamped }));
  }, []);

  return {
    ...state,
    playAyah,
    togglePlay,
    stop,
    seek,
    setAyahsList,
    setAutoPlayNext,
    playSurah,
    setRepeatMode,
    setOnPlaylistEnd,
    setVolume,
  };
}
