import { useState, useEffect, useCallback, useMemo } from 'react';
import type { QuranData, Surah, Ayah } from './types/quran';
import { SurahList } from './components/SurahList';
import { SurahView } from './components/SurahView';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { HafeziQuran } from './components/HafeziQuran';
import { AdminPanel } from './components/AdminPanel';
import { RecitationPanel } from './components/RecitationPanel';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { initDatabase, seedDefaultMappings } from './services/database';
import { BookOpen, Menu, X, BookMarked, LayoutGrid, Settings, Headphones } from 'lucide-react';
import './App.css';

type ViewMode = 'surah' | 'hafezi' | 'recitation' | 'admin';

function App() {
  const [quranData, setQuranData] = useState<QuranData | null>(null);
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('surah');
  const [mappingsVersion, setMappingsVersion] = useState(0);
  const [dbReady, setDbReady] = useState(false);
  const [hafeziJumpAyah, setHafeziJumpAyah] = useState<Ayah | null>(null);
  const [recitationActive, setRecitationActive] = useState(false);

  // Main player: Surah view + Recitation view
  const player = useAudioPlayer();
  // Separate player exclusively for Hafezi Quran (runs independently)
  const hafeziPlayer = useAudioPlayer();

  // ── Cross-stop wrappers ───────────────────────────────────────────────────
  // Starting hafezi player stops the main player and vice-versa.
  const hafeziPlayPage = useCallback((ayahs: Ayah[]) => {
    player.stop();
    hafeziPlayer.playSurah(ayahs);
  }, [player, hafeziPlayer]);

  const hafeziPlayAyah = useCallback((ayah: Ayah) => {
    player.stop();
    hafeziPlayer.playAyah(ayah);
  }, [player, hafeziPlayer]);

  const mainPlayAyah = useCallback((ayah: Ayah) => {
    hafeziPlayer.stop();
    player.playAyah(ayah);
  }, [player, hafeziPlayer]);

  const mainPlaySurah = useCallback((ayahs: Ayah[]) => {
    hafeziPlayer.stop();
    player.playSurah(ayahs);
  }, [player, hafeziPlayer]);

  // Resume the main player from a specific ayah (preserves playlist, repeat, etc.)
  const resumeMainPlayerFromAyah = useCallback((ayah: Ayah) => {
    hafeziPlayer.stop();
    player.playAyah(ayah);
  }, [player, hafeziPlayer]);

  const handleSetViewMode = useCallback((mode: ViewMode, jumpTo?: Ayah | null) => {
    if (mode === 'hafezi') {
      // Prefer an explicitly provided ayah (e.g. from the bottom player),
      // otherwise fall back to the main player's current ayah.
      setHafeziJumpAyah(jumpTo ?? player.currentAyah ?? null);
    }
    setViewMode(mode);
  }, [player.currentAyah]);

  // Surah name for the main (surah/recitation) player
  const currentSurahName = useMemo(() => {
    if (!player.currentAyah || !quranData) return undefined;
    const surah = quranData.data.surahs.find(s =>
      s.ayahs.some(a => a.number === player.currentAyah!.number)
    );
    return surah?.englishName;
  }, [player.currentAyah, quranData]);

  // Surah name for the hafezi player
  const hafeziSurahName = useMemo(() => {
    if (!hafeziPlayer.currentAyah || !quranData) return undefined;
    const surah = quranData.data.surahs.find(s =>
      s.ayahs.some(a => a.number === hafeziPlayer.currentAyah!.number)
    );
    return surah?.englishName;
  }, [hafeziPlayer.currentAyah, quranData]);

  // Initialize database
  useEffect(() => {
    initDatabase().then(() => setDbReady(true)).catch(console.error);
  }, []);

  useEffect(() => {
    fetch('/quran-data.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load Quran data');
        return res.json();
      })
      .then((data: QuranData) => {
        setQuranData(data);
        setSelectedSurah(data.data.surahs[0]);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Seed database defaults once both data and DB are ready
  useEffect(() => {
    if (quranData && dbReady) {
      const allAyahs = quranData.data.surahs.flatMap(s =>
        s.ayahs.map(a => ({ number: a.number, juz: a.juz, page: a.page }))
      );
      seedDefaultMappings(allAyahs);
    }
  }, [quranData, dbReady]);

  const handleMappingsChanged = useCallback(() => {
    setMappingsVersion(v => v + 1);
  }, []);

  useEffect(() => {
    if (selectedSurah) {
      player.setAyahsList(selectedSurah.ayahs);
      player.setAutoPlayNext(true);
    }
  }, [selectedSurah]);

  const handleSelectSurah = useCallback((surah: Surah) => {
    setSelectedSurah(surah);
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, []);

  const handlePreviousAyah = useCallback(() => {
    if (!selectedSurah || !player.currentAyah) return;
    const idx = selectedSurah.ayahs.findIndex(a => a.number === player.currentAyah?.number);
    if (idx > 0) {
      player.playAyah(selectedSurah.ayahs[idx - 1]);
    }
  }, [selectedSurah, player]);

  const handleNextAyah = useCallback(() => {
    if (!selectedSurah || !player.currentAyah) return;
    const idx = selectedSurah.ayahs.findIndex(a => a.number === player.currentAyah?.number);
    if (idx < selectedSurah.ayahs.length - 1) {
      player.playAyah(selectedSurah.ayahs[idx + 1]);
    }
  }, [selectedSurah, player]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="loading-icon">
            <BookOpen size={48} />
          </div>
          <h1>Al-Quran Al-Kareem</h1>
          <p>Loading the Noble Quran...</p>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-screen error-screen">
        <div className="loading-content">
          <h1>Error</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <button
            className="menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="header-brand">
            <span className="header-icon">📖</span>
            <div>
              <h1>Al-Quran Al-Kareem</h1>
              <p>القرآن الكريم</p>
            </div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="header-tabs">
          <button
            className={`header-tab ${viewMode === 'surah' ? 'active' : ''}`}
            onClick={() => handleSetViewMode('surah')}
          >
            <LayoutGrid size={16} />
            <span>Surah View</span>
          </button>
          <button
            className={`header-tab ${viewMode === 'hafezi' ? 'active' : ''}`}
            onClick={() => handleSetViewMode('hafezi')}
          >
            <BookMarked size={16} />
            <span>Hafezi Quran</span>
          </button>
          <button
            className={`header-tab ${viewMode === 'recitation' ? 'active' : ''}`}
            onClick={() => handleSetViewMode('recitation')}
          >
            <Headphones size={16} />
            <span>Recitation</span>
          </button>
          <button
            className={`header-tab ${viewMode === 'admin' ? 'active' : ''}`}
            onClick={() => handleSetViewMode('admin')}
          >
            <Settings size={16} />
            <span>Admin</span>
          </button>
        </div>

        <div className="header-right">
          <div className="reciter-info">
            <span className="reciter-label">Reciter</span>
            <span className="reciter-name">
              {quranData?.data.edition.englishName}
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="app-body">
        {viewMode === 'surah' && sidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {viewMode === 'surah' && (
          <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
            <SurahList
              surahs={quranData?.data.surahs || []}
              selectedSurah={selectedSurah}
              onSelectSurah={handleSelectSurah}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </aside>
        )}

        <main className="app-main">
          {viewMode === 'surah' ? (
            selectedSurah ? (
              <SurahView
                surah={selectedSurah}
                currentAyah={player.currentAyah}
                isPlaying={player.isPlaying}
                isLoading={player.isLoading}
                onPlayAyah={mainPlayAyah}
                onPlaySurah={mainPlaySurah}
              />
            ) : (
              <div className="empty-state">
                <BookOpen size={64} />
                <h2>Select a Surah</h2>
                <p>Choose a surah from the list to begin reading</p>
              </div>
            )
          ) : viewMode === 'hafezi' ? (
            <HafeziQuran
              surahs={quranData?.data.surahs || []}
              currentAyah={hafeziPlayer.currentAyah}
              isPlaying={hafeziPlayer.isPlaying}
              isLoading={hafeziPlayer.isLoading}
              onPlayPage={hafeziPlayPage}
              onPlayAyah={hafeziPlayAyah}
              onSetRepeat={hafeziPlayer.setRepeatMode}
              onSetAyahsList={hafeziPlayer.setAyahsList}
              onSetAutoPlayNext={hafeziPlayer.setAutoPlayNext}
              onStop={hafeziPlayer.stop}
              mappingsVersion={mappingsVersion}
              jumpToAyah={hafeziJumpAyah}
              sidebarOpen={sidebarOpen}
              currentTime={hafeziPlayer.currentTime}
              duration={hafeziPlayer.duration}
              volume={hafeziPlayer.volume}
              surahName={hafeziSurahName}
              onTogglePlay={hafeziPlayer.togglePlay}
              onSeek={hafeziPlayer.seek}
              onPrevious={hafeziPlayer.previousAyah}
              onNext={hafeziPlayer.nextAyah}
              onVolumeChange={hafeziPlayer.setVolume}
              isRecitationActive={recitationActive}
              onResumeMainFromAyah={resumeMainPlayerFromAyah}
              onSetOnPlaylistEnd={hafeziPlayer.setOnPlaylistEnd}
              onResetPlayer={hafeziPlayer.reset}
              mainPlayerCurrentAyah={player.currentAyah}
              mainPlayerIsPlaying={player.isPlaying}
            />
          ) : viewMode === 'admin' ? (
            <AdminPanel
              surahs={quranData?.data.surahs || []}
              onMappingsChanged={handleMappingsChanged}
            />
          ) : null}
          <div style={{ display: viewMode === 'recitation' ? undefined : 'none' }}>
            <RecitationPanel
              surahs={quranData?.data.surahs || []}
              currentAyah={player.currentAyah}
              isPlaying={player.isPlaying}
              isLoading={player.isLoading}
              mappingsVersion={mappingsVersion}
              onPlay={mainPlaySurah}
              onStop={player.stop}
              onSetRepeat={player.setRepeatMode}
              onSetAyahsList={player.setAyahsList}
              onSetAutoPlayNext={player.setAutoPlayNext}
              onSetOnPlaylistEnd={player.setOnPlaylistEnd}
              onActiveChange={setRecitationActive}
            />
          </div>
        </main>
      </div>

      {/* Bottom audio bar — only for Surah / Recitation views (hide in Hafezi and Admin) */}
      {(viewMode === 'surah' || viewMode === 'recitation') && (
        <AudioPlayerBar
          isPlaying={player.isPlaying}
          currentAyah={player.currentAyah}
          currentTime={player.currentTime}
          duration={player.duration}
          isLoading={player.isLoading}
          surahName={currentSurahName}
          volume={player.volume}
          onTogglePlay={player.togglePlay}
          onStop={player.stop}
          onSeek={player.seek}
          onPrevious={handlePreviousAyah}
          onNext={handleNextAyah}
          onGoToPage={player.currentAyah ? () => handleSetViewMode('hafezi', player.currentAyah) : undefined}
          onVolumeChange={player.setVolume}
        />
      )}
    </div>
  );
}

export default App;
