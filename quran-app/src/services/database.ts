import initSqlJs, { type Database } from 'sql.js';

export interface PageMapping {
  id: number;
  juz: number;
  pageIndex: number;       // 0-based page index within the juz
  originalPage: number;    // original quran page number
  startAyah: number;       // global ayah number start
  endAyah: number;         // global ayah number end
  customStartAyah: number; // user-defined start
  customEndAyah: number;   // user-defined end
  isCustom: boolean;       // whether user has overridden
}

const DB_STORAGE_KEY = 'quran_admin_db';

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

function saveToStorage() {
  if (!db) return;
  const data = db.export();
  const base64 = btoa(String.fromCharCode(...data));
  localStorage.setItem(DB_STORAGE_KEY, base64);
}

function loadFromStorage(): Uint8Array | null {
  const stored = localStorage.getItem(DB_STORAGE_KEY);
  if (!stored) return null;
  try {
    const binary = atob(stored);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export async function initDatabase(): Promise<Database> {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm',
    });

    const existingData = loadFromStorage();
    if (existingData) {
      db = new SQL.Database(existingData);
    } else {
      db = new SQL.Database();
    }

    // Create table if not exists
    db.run(`
      CREATE TABLE IF NOT EXISTS page_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        juz INTEGER NOT NULL,
        page_index INTEGER NOT NULL,
        original_page INTEGER NOT NULL,
        start_ayah INTEGER NOT NULL,
        end_ayah INTEGER NOT NULL,
        custom_start_ayah INTEGER NOT NULL,
        custom_end_ayah INTEGER NOT NULL,
        is_custom INTEGER NOT NULL DEFAULT 0,
        UNIQUE(juz, page_index)
      )
    `);

    saveToStorage();
    return db;
  })();

  return initPromise;
}

export function getDatabase(): Database | null {
  return db;
}

/**
 * Seed all default page mappings from the Quran data.
 * Only inserts rows that don't already exist.
 */
export function seedDefaultMappings(
  allAyahs: { number: number; juz: number; page: number }[]
): void {
  if (!db) return;

  // Build juz -> page -> ayah range
  const juzPages = new Map<number, Map<number, { min: number; max: number }>>();

  allAyahs.forEach(a => {
    if (!juzPages.has(a.juz)) juzPages.set(a.juz, new Map());
    const pMap = juzPages.get(a.juz)!;
    if (!pMap.has(a.page)) pMap.set(a.page, { min: a.number, max: a.number });
    const range = pMap.get(a.page)!;
    if (a.number < range.min) range.min = a.number;
    if (a.number > range.max) range.max = a.number;
  });

  // Check existing count
  const result = db.exec('SELECT COUNT(*) as cnt FROM page_mappings');
  const count = result.length > 0 ? (result[0].values[0][0] as number) : 0;

  if (count > 0) return; // Already seeded

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO page_mappings 
     (juz, page_index, original_page, start_ayah, end_ayah, custom_start_ayah, custom_end_ayah, is_custom)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
  );

  for (let j = 1; j <= 30; j++) {
    const pMap = juzPages.get(j);
    if (!pMap) continue;
    
    // Get sorted pages
    const pages = Array.from(pMap.entries()).sort((a, b) => a[0] - b[0]);
    pages.forEach(([page, range], idx) => {
      stmt.run([j, idx, page, range.min, range.max, range.min, range.max]);
    });
  }

  stmt.free();
  saveToStorage();
}

/**
 * Get all page mappings for a given juz
 */
export function getPageMappings(juz: number): PageMapping[] {
  if (!db) return [];

  const results = db.exec(
    `SELECT id, juz, page_index, original_page, start_ayah, end_ayah, 
            custom_start_ayah, custom_end_ayah, is_custom
     FROM page_mappings 
     WHERE juz = ${juz}
     ORDER BY page_index`
  );

  if (results.length === 0) return [];

  return results[0].values.map((row: any[]) => ({
    id: row[0] as number,
    juz: row[1] as number,
    pageIndex: row[2] as number,
    originalPage: row[3] as number,
    startAyah: row[4] as number,
    endAyah: row[5] as number,
    customStartAyah: row[6] as number,
    customEndAyah: row[7] as number,
    isCustom: (row[8] as number) === 1,
  }));
}

/**
 * Get a single page mapping
 */
export function getPageMapping(juz: number, pageIndex: number): PageMapping | null {
  if (!db) return null;

  const results = db.exec(
    `SELECT id, juz, page_index, original_page, start_ayah, end_ayah, 
            custom_start_ayah, custom_end_ayah, is_custom
     FROM page_mappings 
     WHERE juz = ${juz} AND page_index = ${pageIndex}
     LIMIT 1`
  );

  if (results.length === 0 || results[0].values.length === 0) return null;

  const row = results[0].values[0];
  return {
    id: row[0] as number,
    juz: row[1] as number,
    pageIndex: row[2] as number,
    originalPage: row[3] as number,
    startAyah: row[4] as number,
    endAyah: row[5] as number,
    customStartAyah: row[6] as number,
    customEndAyah: row[7] as number,
    isCustom: (row[8] as number) === 1,
  };
}

/**
 * Update the custom ayah range for a page
 */
export function updatePageMapping(
  juz: number,
  pageIndex: number,
  customStartAyah: number,
  customEndAyah: number
): void {
  if (!db) return;

  db.run(
    `UPDATE page_mappings 
     SET custom_start_ayah = ${customStartAyah}, 
         custom_end_ayah = ${customEndAyah}, 
         is_custom = 1 
     WHERE juz = ${juz} AND page_index = ${pageIndex}`
  );

  saveToStorage();
}

/**
 * Reset a page mapping to its original values
 */
export function resetPageMapping(juz: number, pageIndex: number): void {
  if (!db) return;

  db.run(
    `UPDATE page_mappings 
     SET custom_start_ayah = start_ayah, 
         custom_end_ayah = end_ayah, 
         is_custom = 0
     WHERE juz = ${juz} AND page_index = ${pageIndex}`
  );

  saveToStorage();
}

/**
 * Reset ALL mappings to original
 */
export function resetAllMappings(): void {
  if (!db) return;

  db.run(
    `UPDATE page_mappings 
     SET custom_start_ayah = start_ayah, 
         custom_end_ayah = end_ayah, 
         is_custom = 0`
  );

  saveToStorage();
}

/**
 * Get all custom (modified) mappings count
 */
export function getCustomMappingsCount(): number {
  if (!db) return 0;

  const results = db.exec('SELECT COUNT(*) FROM page_mappings WHERE is_custom = 1');
  if (results.length === 0) return 0;
  return results[0].values[0][0] as number;
}

/**
 * Export the database as a downloadable file
 */
export function exportDatabase(): Uint8Array | null {
  if (!db) return null;
  return db.export();
}
