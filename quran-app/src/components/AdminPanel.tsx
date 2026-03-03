import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Surah, Ayah } from '../types/quran';
import {
  getPageMappings,
  updatePageMapping,
  resetPageMapping,
  resetAllMappings,
  getCustomMappingsCount,
  exportDatabase,
  type PageMapping,
} from '../services/database';
import {
  Settings,
  Save,
  RotateCcw,
  Download,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit3,
  Eye,
} from 'lucide-react';

interface AdminPanelProps {
  surahs: Surah[];
  onMappingsChanged: () => void;
}

// Arabic Juz names (shared)
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

export const AdminPanel: React.FC<AdminPanelProps> = ({ surahs, onMappingsChanged }) => {
  const [selectedJuz, setSelectedJuz] = useState(1);
  const [mappings, setMappings] = useState<PageMapping[]>([]);
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [editStart, setEditStart] = useState(0);
  const [editEnd, setEditEnd] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [customCount, setCustomCount] = useState(0);
  const [expandedPage, setExpandedPage] = useState<number | null>(null);
  const [showOnlyCustom, setShowOnlyCustom] = useState(false);

  // Build a global ayah lookup
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

  const totalAyahs = allAyahs.length;

  const loadMappings = useCallback(() => {
    const m = getPageMappings(selectedJuz);
    setMappings(m);
    setCustomCount(getCustomMappingsCount());
  }, [selectedJuz]);

  useEffect(() => {
    loadMappings();
    setEditingPage(null);
    setExpandedPage(null);
  }, [selectedJuz, loadMappings]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleEdit = (mapping: PageMapping) => {
    setEditingPage(mapping.pageIndex);
    setEditStart(mapping.customStartAyah);
    setEditEnd(mapping.customEndAyah);
    setExpandedPage(mapping.pageIndex);
  };

  const handleSave = () => {
    if (editingPage === null) return;

    // Validate
    if (editStart < 1 || editEnd < 1) {
      showToast('Ayah numbers must be at least 1', 'error');
      return;
    }
    if (editStart > editEnd) {
      showToast('Start ayah must be less than or equal to end ayah', 'error');
      return;
    }
    if (editEnd > totalAyahs) {
      showToast(`End ayah cannot exceed ${totalAyahs}`, 'error');
      return;
    }

    updatePageMapping(selectedJuz, editingPage, editStart, editEnd);
    setEditingPage(null);
    loadMappings();
    onMappingsChanged();
    showToast('Page mapping saved successfully!', 'success');
  };

  const handleCancel = () => {
    setEditingPage(null);
  };

  const handleReset = (mapping: PageMapping) => {
    resetPageMapping(mapping.juz, mapping.pageIndex);
    loadMappings();
    onMappingsChanged();
    showToast(`Page ${mapping.originalPage} reset to original`, 'success');
  };

  const handleResetAll = () => {
    if (!window.confirm('Are you sure you want to reset ALL custom page mappings to their original values?')) {
      return;
    }
    resetAllMappings();
    loadMappings();
    onMappingsChanged();
    showToast('All mappings reset to original', 'success');
  };

  const handleExport = () => {
    const data = exportDatabase();
    if (!data) return;

    const blob = new Blob([data], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quran_page_mappings.db';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Database exported successfully', 'success');
  };

  // Get ayah info for preview
  const getAyahInfo = (globalNumber: number) => {
    const ayah = allAyahs.find(a => a.number === globalNumber);
    if (!ayah) return null;
    return ayah;
  };

  const getAyahRangePreview = (start: number, end: number) => {
    const startAyah = getAyahInfo(start);
    const endAyah = getAyahInfo(end);
    if (!startAyah || !endAyah) return 'Invalid range';

    const count = end - start + 1;
    if (startAyah.surahNumber === endAyah.surahNumber) {
      return `${startAyah.surahName} ${startAyah.numberInSurah}-${endAyah.numberInSurah} (${count} ayahs)`;
    }
    return `${startAyah.surahName} ${startAyah.numberInSurah} → ${endAyah.surahName} ${endAyah.numberInSurah} (${count} ayahs)`;
  };

  const filteredMappings = showOnlyCustom ? mappings.filter(m => m.isCustom) : mappings;

  return (
    <div className="admin-panel">
      {/* Toast notification */}
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="admin-header">
        <div className="admin-header-left">
          <Settings size={22} className="admin-icon" />
          <div>
            <h2>Admin Panel</h2>
            <p>Manage Hafezi Quran page mappings</p>
          </div>
        </div>
        <div className="admin-header-actions">
          <button className="admin-btn admin-btn-outline" onClick={handleExport} title="Export database">
            <Download size={14} />
            <span>Export DB</span>
          </button>
          {customCount > 0 && (
            <button className="admin-btn admin-btn-danger" onClick={handleResetAll} title="Reset all to original">
              <Trash2 size={14} />
              <span>Reset All ({customCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="admin-stats">
        <div className="admin-stat">
          <span className="admin-stat-value">{totalAyahs}</span>
          <span className="admin-stat-label">Total Ayahs</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat-value">604</span>
          <span className="admin-stat-label">Total Pages</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat-value">30</span>
          <span className="admin-stat-label">Juz (Para)</span>
        </div>
        <div className="admin-stat highlight">
          <span className="admin-stat-value">{customCount}</span>
          <span className="admin-stat-label">Custom Mappings</span>
        </div>
      </div>

      {/* Controls */}
      <div className="admin-controls">
        <div className="admin-select-group">
          <label>Select Para (Juz)</label>
          <select
            value={selectedJuz}
            onChange={e => setSelectedJuz(Number(e.target.value))}
            className="admin-select"
          >
            {Array.from({ length: 30 }, (_, i) => i + 1).map(j => (
              <option key={j} value={j}>
                Para {j} — {juzNames[j]}
              </option>
            ))}
          </select>
        </div>

        <label className="admin-filter-toggle">
          <input
            type="checkbox"
            checked={showOnlyCustom}
            onChange={e => setShowOnlyCustom(e.target.checked)}
          />
          <span>Show only custom mappings</span>
        </label>
      </div>

      {/* Page list */}
      <div className="admin-page-list">
        <div className="admin-page-list-header">
          <span className="admin-col col-page">Page</span>
          <span className="admin-col col-original">Original Range</span>
          <span className="admin-col col-custom">Custom Range</span>
          <span className="admin-col col-info">Ayah Info</span>
          <span className="admin-col col-actions">Actions</span>
        </div>

        {filteredMappings.length === 0 ? (
          <div className="admin-empty">
            {showOnlyCustom
              ? 'No custom mappings in this para. Edit a page to create one.'
              : 'No page mappings found. Please wait for data to load.'}
          </div>
        ) : (
          filteredMappings.map(mapping => {
            const isEditing = editingPage === mapping.pageIndex;
            const isExpanded = expandedPage === mapping.pageIndex;

            return (
              <div
                key={mapping.id}
                className={`admin-page-row ${mapping.isCustom ? 'custom' : ''} ${isEditing ? 'editing' : ''}`}
              >
                {/* Main row */}
                <div className="admin-page-row-main" onClick={() => setExpandedPage(isExpanded ? null : mapping.pageIndex)}>
                  <span className="admin-col col-page">
                    <span className="admin-page-number">{mapping.originalPage}</span>
                    {mapping.isCustom && <span className="admin-custom-badge">Custom</span>}
                  </span>
                  <span className="admin-col col-original">
                    <span className="admin-range">{mapping.startAyah} — {mapping.endAyah}</span>
                  </span>
                  <span className="admin-col col-custom">
                    {mapping.isCustom ? (
                      <span className="admin-range custom">{mapping.customStartAyah} — {mapping.customEndAyah}</span>
                    ) : (
                      <span className="admin-range muted">Same as original</span>
                    )}
                  </span>
                  <span className="admin-col col-info">
                    <span className="admin-info-text">
                      {getAyahRangePreview(mapping.customStartAyah, mapping.customEndAyah)}
                    </span>
                  </span>
                  <span className="admin-col col-actions">
                    <button
                      className="admin-row-btn"
                      onClick={e => { e.stopPropagation(); handleEdit(mapping); }}
                      title="Edit"
                    >
                      <Edit3 size={14} />
                    </button>
                    {mapping.isCustom && (
                      <button
                        className="admin-row-btn admin-row-btn-reset"
                        onClick={e => { e.stopPropagation(); handleReset(mapping); }}
                        title="Reset to original"
                      >
                        <RotateCcw size={14} />
                      </button>
                    )}
                    <button
                      className="admin-row-btn admin-row-btn-expand"
                      onClick={e => { e.stopPropagation(); setExpandedPage(isExpanded ? null : mapping.pageIndex); }}
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </span>
                </div>

                {/* Expanded / Edit section */}
                {(isExpanded || isEditing) && (
                  <div className="admin-page-expanded">
                    {isEditing ? (
                      <div className="admin-edit-form">
                        <h4>Edit Page {mapping.originalPage} — Para {mapping.juz}</h4>
                        <div className="admin-edit-fields">
                          <div className="admin-edit-field">
                            <label>Start Ayah (Global #)</label>
                            <input
                              type="number"
                              min={1}
                              max={totalAyahs}
                              value={editStart}
                              onChange={e => setEditStart(Number(e.target.value))}
                              className="admin-input"
                            />
                            {getAyahInfo(editStart) && (
                              <span className="admin-edit-hint">
                                {getAyahInfo(editStart)!.surahName} — Ayah {getAyahInfo(editStart)!.numberInSurah}
                              </span>
                            )}
                          </div>
                          <div className="admin-edit-field">
                            <label>End Ayah (Global #)</label>
                            <input
                              type="number"
                              min={1}
                              max={totalAyahs}
                              value={editEnd}
                              onChange={e => setEditEnd(Number(e.target.value))}
                              className="admin-input"
                            />
                            {getAyahInfo(editEnd) && (
                              <span className="admin-edit-hint">
                                {getAyahInfo(editEnd)!.surahName} — Ayah {getAyahInfo(editEnd)!.numberInSurah}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Live preview */}
                        <div className="admin-edit-preview">
                          <Eye size={14} />
                          <span>Preview: {getAyahRangePreview(editStart, editEnd)}</span>
                        </div>

                        <div className="admin-edit-original">
                          <span>Original: {mapping.startAyah} — {mapping.endAyah}</span>
                          <span>({getAyahRangePreview(mapping.startAyah, mapping.endAyah)})</span>
                        </div>

                        <div className="admin-edit-actions">
                          <button className="admin-btn admin-btn-primary" onClick={handleSave}>
                            <Save size={14} />
                            <span>Save Changes</span>
                          </button>
                          <button className="admin-btn admin-btn-outline" onClick={handleCancel}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="admin-page-details">
                        <div className="admin-detail-row">
                          <span className="admin-detail-label">Original Range:</span>
                          <span>{mapping.startAyah} — {mapping.endAyah}</span>
                          <span className="admin-detail-info">
                            ({getAyahRangePreview(mapping.startAyah, mapping.endAyah)})
                          </span>
                        </div>
                        <div className="admin-detail-row">
                          <span className="admin-detail-label">Active Range:</span>
                          <span>{mapping.customStartAyah} — {mapping.customEndAyah}</span>
                          <span className="admin-detail-info">
                            ({getAyahRangePreview(mapping.customStartAyah, mapping.customEndAyah)})
                          </span>
                        </div>
                        {/* Preview first ayah text */}
                        {getAyahInfo(mapping.customStartAyah) && (
                          <div className="admin-detail-preview" dir="rtl" lang="ar">
                            <span className="admin-detail-label-ar">First ayah:</span>
                            {getAyahInfo(mapping.customStartAyah)!.text.substring(0, 80)}...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
