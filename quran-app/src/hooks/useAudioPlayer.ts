import { useState, useRef, useCallback, useEffect } from 'react';
import type { Ayah } from '../types/quran';

interface AudioPlayerState {
  isPlaying: boolean;
  currentAyah: Ayah | null;
  currentTime: number;
  duration: number;
  isLoading: boolean;
}

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    currentAyah: null,
    currentTime: 0,
    duration: 0,
    isLoading: false,
  });

  const ayahsRef = useRef<Ayah[]>([]);
  const autoPlayNextRef = useRef(false);
  const repeatModeRef = useRef(false);
  const onPlaylistEndRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    audio.addEventListener('timeupdate', () => {
      setState(prev => ({ ...prev, currentTime: audio.currentTime }));
    });

    audio.addEventListener('loadedmetadata', () => {
      setState(prev => ({ ...prev, duration: audio.duration, isLoading: false }));
    });

    audio.addEventListener('ended', () => {
      if (autoPlayNextRef.current) {
        const currentNum = parseInt(audioRef.current?.dataset?.ayahNumber || '0');
        const idx = ayahsRef.current.findIndex(a => a.number === currentNum);
        if (idx >= 0 && idx < ayahsRef.current.length - 1) {
          const nextAyah = ayahsRef.current[idx + 1];
          playAyah(nextAyah);
        } else if (repeatModeRef.current && ayahsRef.current.length > 0) {
          // Repeat: go back to first ayah in the list
          playAyah(ayahsRef.current[0]);
        } else {
          setState(prev => ({ ...prev, isPlaying: false }));
          onPlaylistEndRef.current?.();
        }
      } else {
        setState(prev => ({ ...prev, isPlaying: false }));
      }
    });

    audio.addEventListener('waiting', () => {
      setState(prev => ({ ...prev, isLoading: true }));
    });

    audio.addEventListener('canplay', () => {
      setState(prev => ({ ...prev, isLoading: false }));
    });

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  const playAyah = useCallback((ayah: Ayah) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.dataset.ayahNumber = String(ayah.number);
    audio.src = ayah.audio;
    audio.play().catch(() => {});
    setState(prev => ({
      ...prev,
      isPlaying: true,
      currentAyah: ayah,
      isLoading: true,
    }));
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (state.isPlaying) {
      audio.pause();
      setState(prev => ({ ...prev, isPlaying: false }));
    } else if (state.currentAyah) {
      audio.play().catch(() => {});
      setState(prev => ({ ...prev, isPlaying: true }));
    }
  }, [state.isPlaying, state.currentAyah]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
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
  };
}
