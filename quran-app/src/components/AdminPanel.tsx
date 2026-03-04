import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Surah, Ayah } from '../types/quran';
import {
  getPageMappings,
  updatePageMapping,
  resetPageMapping,
  resetAllMappings,
  getCustomMappingsCount,
  exportDatabase,
  updatePageImage,
  removePageImage,
  renumberSubsequentPages,
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
  Upload,
  Image,
  X,
} from 'lucide-react';

interface AdminPanelProps {
  surahs: Surah[];
  onMappingsChanged: () => void;
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

export const AdminPanel: React.FC<AdminPanelProps> = ({ surahs, onMappingsChanged }) => {
  const [selectedJuz, setSelectedJuz] = useState(1);
  const [mappings, setMappings] = useState<PageMapping[]>([]);
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [editStart, setEditStart] = useState(0);
  const [editEnd, setEditEnd] = useState(0);
  const [editDisplayPage, setEditDisplayPage] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [customCount, setCustomCount] = useState(0);
  const [expandedPage, setExpandedPage] = useState<number | null>(null);
  const [showOnlyCustom, setShowOnlyCustom] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ pageIndex: number; percent: number; phase: 'reading' | 'saving' } | null>(null);

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
    setEditDisplayPage(mapping.displayPage);
    setExpandedPage(mapping.pageIndex);
  };

  const handleSave = () => {
    if (editingPage === null) return;

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
    if (editDisplayPage < 1) {
      showToast('Display page number must be at least 1', 'error');
      return;
    }

    updatePageMapping(selectedJuz, editingPage, editStart, editEnd, editDisplayPage);
    renumberSubsequentPages(selectedJuz, editingPage, editDisplayPage);
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
    showToast(`Page index ${mapping.pageIndex} reset to original`, 'success');
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

    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quran_page_mappings.db';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Database exported successfully', 'success');
  };

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

  const handleImageUpload = (mapping: PageMapping, file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be less than 5MB', 'error');
      return;
    }

    setUploadingImage(mapping.pageIndex);
    setUploadProgress({ pageIndex: mapping.pageIndex, percent: 0, phase: 'reading' });

    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.min(80, Math.round((e.loaded / e.total) * 80));
        setUploadProgress({ pageIndex: mapping.pageIndex, percent: pct, phase: 'reading' });
      }
    };

    reader.onload = () => {
      const base64 = reader.result as string;
      // Show saving phase — use setTimeout so React can paint before heavy DB work
      setUploadProgress({ pageIndex: mapping.pageIndex, percent: 85, phase: 'saving' });

      setTimeout(() => {
        try {
          updatePageImage(mapping.juz, mapping.pageIndex, base64);
          showToast(`Image uploaded for page ${mapping.displayPage}`, 'success');
        } catch (err) {
          console.error('Failed to save image:', err);
          showToast('Failed to save image to database', 'error');
        } finally {
          // Always clear upload state and refresh, even if save threw
          setUploadingImage(null);
          setUploadProgress(null);
          loadMappings();
          onMappingsChanged();
        }
      }, 50);
    };

    reader.onerror = () => {
      setUploadingImage(null);
      setUploadProgress(null);
      showToast('Failed to read image file', 'error');
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (mapping: PageMapping) => {
    if (!window.confirm(`Remove image for page ${mapping.displayPage}?`)) return;
    try {
      removePageImage(mapping.juz, mapping.pageIndex);
      showToast(`Image removed for page ${mapping.displayPage}`, 'success');
    } catch (err) {
      console.error('Failed to remove image:', err);
      showToast('Failed to remove image', 'error');
    }
    // Reload mappings from DB so UI reflects removal immediately
    loadMappings();
    onMappingsChanged();
  };

  // Check for duplicate display page numbers
  const duplicateDisplayPages = useMemo(() => {
    const counts = new Map<number, number>();
    mappings.forEach(m => {
      counts.set(m.displayPage, (counts.get(m.displayPage) || 0) + 1);
    });
    const dupes = new Set<number>();
    counts.forEach((count, page) => {
      if (count > 1) dupes.add(page);
    });
    return dupes;
  }, [mappings]);

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
          <span className="admin-col col-idx">Index</span>
          <span className="admin-col col-display">Page #</span>
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
            const isDuplicate = duplicateDisplayPages.has(mapping.displayPage);

            return (
              <div
                key={mapping.id}
                className={`admin-page-row ${mapping.isCustom ? 'custom' : ''} ${isEditing ? 'editing' : ''}`}
              >
                {/* Main row */}
                <div className="admin-page-row-main" onClick={() => setExpandedPage(isExpanded ? null : mapping.pageIndex)}>
                  <span className="admin-col col-idx">
                    <span className="admin-page-idx">{mapping.pageIndex}</span>
                  </span>
                  <span className="admin-col col-display">
                    <span className="admin-page-number">{mapping.displayPage}</span>
                    {mapping.isCustom && <span className="admin-custom-badge">Custom</span>}
                    {isDuplicate && <span className="admin-dup-badge">Dup</span>}
                    {mapping.pageImage && <span className="admin-img-badge" title="Has image"><Image size={12} /></span>}
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
                        <h4>Edit Page Index {mapping.pageIndex} — Para {mapping.juz}</h4>
                        <div className="admin-edit-fields">
                          <div className="admin-edit-field">
                            <label>Display Page #</label>
                            <input
                              type="number"
                              min={1}
                              value={editDisplayPage}
                              onChange={e => setEditDisplayPage(Number(e.target.value))}
                              className="admin-input"
                            />
                            <span className="admin-edit-hint">
                              Original: {mapping.pageIndex + 1}
                              {mappings.some(m => m.displayPage === editDisplayPage && m.pageIndex !== mapping.pageIndex) && (
                                <span className="admin-dup-warning"> — Duplicate! Will show side by side</span>
                              )}
                            </span>
                          </div>
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

                        {/* Image upload section */}
                        <div className="admin-image-section">
                          <h5><Image size={14} /> Page Image</h5>
                          {mapping.pageImage ? (
                            <div className="admin-image-preview-wrap">
                              <img src={mapping.pageImage} alt={`Page ${mapping.displayPage}`} className="admin-image-preview" />
                              <div className="admin-image-actions">
                                <label className="admin-btn admin-btn-outline admin-btn-sm">
                                  <Upload size={12} />
                                  <span>Replace</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (file) handleImageUpload(mapping, file);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                                <button
                                  className="admin-btn admin-btn-danger admin-btn-sm"
                                  onClick={() => handleRemoveImage(mapping)}
                                >
                                  <X size={12} />
                                  <span>Remove</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <label className={`admin-image-upload-area ${uploadingImage === mapping.pageIndex ? 'uploading' : ''}`}>
                              {uploadingImage === mapping.pageIndex ? (
                                <>
                                  <Upload size={20} className="admin-upload-spin" />
                                  <span>
                                    {uploadProgress?.phase === 'saving' ? 'Saving to database...' : 'Reading image...'}
                                    {' '}<strong>{uploadProgress?.percent ?? 0}%</strong>
                                  </span>
                                  <div className="admin-upload-progress-bar">
                                    <div
                                      className="admin-upload-progress-fill"
                                      style={{ width: `${uploadProgress?.percent ?? 0}%` }}
                                    />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <Upload size={20} />
                                  <span>Click to upload page image</span>
                                  <span className="admin-image-hint">PNG, JPG up to 5MB</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                hidden
                                disabled={uploadingImage === mapping.pageIndex}
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(mapping, file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                        </div>

                        {/* Live preview */}
                        <div className="admin-edit-preview">
                          <Eye size={14} />
                          <span>Preview: Page {editDisplayPage} — {getAyahRangePreview(editStart, editEnd)}</span>
                        </div>

                        <div className="admin-edit-original">
                          <span>Original: Page {mapping.pageIndex} — Ayahs {mapping.startAyah}–{mapping.endAyah}</span>
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
                          <span className="admin-detail-label">Page Index:</span>
                          <span>{mapping.pageIndex}</span>
                          <span className="admin-detail-info">(Quran page {mapping.originalPage})</span>
                        </div>
                        <div className="admin-detail-row">
                          <span className="admin-detail-label">Display Page #:</span>
                          <span>{mapping.displayPage}</span>
                          {mapping.displayPage !== mapping.pageIndex + 1 && (
                            <span className="admin-detail-info">(default: {mapping.pageIndex + 1})</span>
                          )}
                        </div>
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
                        {isDuplicate && (
                          <div className="admin-detail-row">
                            <span className="admin-detail-label">⚠ Duplicate:</span>
                            <span className="admin-dup-warning">
                              Page #{mapping.displayPage} is shared — pages will show side by side
                            </span>
                          </div>
                        )}
                        {getAyahInfo(mapping.customStartAyah) && (
                          <div className="admin-detail-preview" dir="rtl" lang="ar">
                            <span className="admin-detail-label-ar">First ayah:</span>
                            {getAyahInfo(mapping.customStartAyah)!.text.substring(0, 80)}...
                          </div>
                        )}
                        {/* Page image section */}
                        <div className="admin-detail-image-section">
                          <span className="admin-detail-label"><Image size={14} /> Page Image:</span>
                          {mapping.pageImage ? (
                            <div className="admin-image-preview-wrap">
                              <img src={mapping.pageImage} alt={`Page ${mapping.displayPage}`} className="admin-image-preview" />
                              <div className="admin-image-actions">
                                <label className="admin-btn admin-btn-outline admin-btn-sm">
                                  <Upload size={12} />
                                  <span>Replace</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    onChange={e => {
                                      const file = e.target.files?.[0];
                                      if (file) handleImageUpload(mapping, file);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                                <button
                                  className="admin-btn admin-btn-danger admin-btn-sm"
                                  onClick={() => handleRemoveImage(mapping)}
                                >
                                  <X size={12} />
                                  <span>Remove</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <label className={`admin-image-upload-area small ${uploadingImage === mapping.pageIndex ? 'uploading' : ''}`}>
                              <Upload size={16} className={uploadingImage === mapping.pageIndex ? 'admin-upload-spin' : ''} />
                              {uploadingImage === mapping.pageIndex ? (
                                <>
                                  <span>
                                    {uploadProgress?.phase === 'saving' ? 'Saving...' : 'Reading...'}
                                    {' '}<strong>{uploadProgress?.percent ?? 0}%</strong>
                                  </span>
                                  <div className="admin-upload-progress-bar">
                                    <div
                                      className="admin-upload-progress-fill"
                                      style={{ width: `${uploadProgress?.percent ?? 0}%` }}
                                    />
                                  </div>
                                </>
                              ) : (
                                <span>Upload image</span>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                hidden
                                disabled={uploadingImage === mapping.pageIndex}
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleImageUpload(mapping, file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                        </div>
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
