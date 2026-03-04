import { useState, useEffect, useCallback } from 'react';
import type { QuranData, Surah } from './types/quran';
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

  const player = useAudioPlayer();

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
            onClick={() => setViewMode('surah')}
          >
            <LayoutGrid size={16} />
            <span>Surah View</span>
          </button>
          <button
            className={`header-tab ${viewMode === 'hafezi' ? 'active' : ''}`}
            onClick={() => setViewMode('hafezi')}
          >
            <BookMarked size={16} />
            <span>Hafezi Quran</span>
          </button>
          <button
            className={`header-tab ${viewMode === 'recitation' ? 'active' : ''}`}
            onClick={() => setViewMode('recitation')}
          >
            <Headphones size={16} />
            <span>Recitation</span>
          </button>
          <button
            className={`header-tab ${viewMode === 'admin' ? 'active' : ''}`}
            onClick={() => setViewMode('admin')}
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
                onPlayAyah={player.playAyah}
                onPlaySurah={player.playSurah}
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
              currentAyah={player.currentAyah}
              isPlaying={player.isPlaying}
              isLoading={player.isLoading}
              onPlayPage={player.playSurah}
              onPlayAyah={player.playAyah}
              onSetRepeat={player.setRepeatMode}
              onSetAyahsList={player.setAyahsList}
              onSetAutoPlayNext={player.setAutoPlayNext}
              onStop={player.stop}
              mappingsVersion={mappingsVersion}
            />
          ) : viewMode === 'recitation' ? (
            <RecitationPanel
              surahs={quranData?.data.surahs || []}
              currentAyah={player.currentAyah}
              isPlaying={player.isPlaying}
              isLoading={player.isLoading}
              mappingsVersion={mappingsVersion}
              onPlay={player.playSurah}
              onStop={player.stop}
              onSetRepeat={player.setRepeatMode}
              onSetAyahsList={player.setAyahsList}
              onSetAutoPlayNext={player.setAutoPlayNext}
              onSetOnPlaylistEnd={player.setOnPlaylistEnd}
            />
          ) : (
            <AdminPanel
              surahs={quranData?.data.surahs || []}
              onMappingsChanged={handleMappingsChanged}
            />
          )}
        </main>
      </div>

      {/* Audio Player */}
      <AudioPlayerBar
        isPlaying={player.isPlaying}
        currentAyah={player.currentAyah}
        currentTime={player.currentTime}
        duration={player.duration}
        isLoading={player.isLoading}
        surahName={selectedSurah?.englishName}
        onTogglePlay={player.togglePlay}
        onStop={player.stop}
        onSeek={player.seek}
        onPrevious={handlePreviousAyah}
        onNext={handleNextAyah}
      />
    </div>
  );
}

export default App;
