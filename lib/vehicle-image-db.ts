/**
 * OFFO Local Vehicle Image Database
 *
 * Reads data/vehicle-images.csv and provides fast O(1) lookup.
 * This is Tier 0 in the image extraction chain — checked before VinAudit
 * and all external APIs. You own the data; edit the CSV to add images.
 *
 * CSV format:
 *   make, model, year_from, year_to, image_url, priority, notes
 *
 * image_url can be:
 *   - A full URL (https://...)
 *   - A local path (/vehicles/filename.jpg) served from public/vehicles/
 *
 * Multiple rows for the same vehicle are supported — sorted by priority (1=best).
 */

import fs from "fs";
import path from "path";

export interface VehicleImageRow {
  make: string;
  model: string;
  year_from: number;
  year_to: number;
  image_url: string;
  priority: number;
  notes: string;
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function parseCSV(content: string): VehicleImageRow[] {
  const rows: VehicleImageRow[] = [];
  const lines = content.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    // Skip header row
    if (line.toLowerCase().startsWith("make,")) continue;

    const cols = line.split(",");
    if (cols.length < 6) continue;

    const [make, model, year_from_s, year_to_s, image_url, priority_s, ...noteParts] = cols;
    const year_from = parseInt(year_from_s ?? "");
    const year_to = parseInt(year_to_s ?? "");
    const priority = parseInt(priority_s ?? "1") || 1;

    if (!make?.trim() || !model?.trim() || isNaN(year_from) || isNaN(year_to) || !image_url?.trim()) continue;

    rows.push({
      make: make.trim(),
      model: model.trim(),
      year_from,
      year_to,
      image_url: image_url.trim(),
      priority,
      notes: noteParts.join(",").trim(),
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// In-memory index
// ---------------------------------------------------------------------------

// Key: "make||model" (lowercased). Value: all matching rows (may span years).
type RowIndex = Map<string, VehicleImageRow[]>;

let _index: RowIndex | null = null;
let _lastMtime = 0;

const CSV_PATH = path.join(process.cwd(), "data", "vehicle-images.csv");

function buildIndex(rows: VehicleImageRow[]): RowIndex {
  const idx: RowIndex = new Map();
  for (const row of rows) {
    const key = makeIndexKey(row.make, row.model);
    const existing = idx.get(key) ?? [];
    existing.push(row);
    idx.set(key, existing);
  }
  // Sort each bucket by priority ascending (1 = best)
  for (const [, bucket] of idx) {
    bucket.sort((a, b) => a.priority - b.priority);
  }
  return idx;
}

function makeIndexKey(make: string, model: string): string {
  return `${make.toLowerCase().trim()}||${model.toLowerCase().trim()}`;
}

function getIndex(): RowIndex {
  try {
    const stat = fs.statSync(CSV_PATH);
    const mtime = stat.mtimeMs;
    if (_index && mtime === _lastMtime) return _index;

    const content = fs.readFileSync(CSV_PATH, "utf-8");
    const rows = parseCSV(content);
    _index = buildIndex(rows);
    _lastMtime = mtime;
    return _index;
  } catch {
    // CSV missing or unreadable — return empty index, not fatal
    return new Map();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LocalImageResult {
  urls: string[];
  matched: boolean;
}

/**
 * Look up vehicle images from the local CSV database.
 *
 * Matching strategy:
 * 1. Exact make + model match, year in [year_from, year_to]
 * 2. Make match + model contains the lookup model (handles "Bolt EV" matching "Bolt EV LT")
 * 3. Returns all matching rows sorted by priority
 */
export function lookupLocalImages(
  make: string,
  model: string,
  year?: number
): LocalImageResult {
  const idx = getIndex();

  // Normalize inputs
  const makeLow = make.toLowerCase().trim();
  const modelLow = normalizeModel(model, make);

  const candidates: VehicleImageRow[] = [];

  // Walk all index keys for this make, find model matches
  for (const [key, rows] of idx) {
    const [keyMake, keyModel] = key.split("||");
    if (keyMake !== makeLow) continue;

    // Model matching: CSV model must appear in the lookup model or vice versa
    const keyModelNorm = normalizeModel(keyModel ?? "", "");
    if (!modelMatches(modelLow, keyModelNorm)) continue;

    // Year filtering
    for (const row of rows) {
      if (year === undefined || (year >= row.year_from && year <= row.year_to)) {
        candidates.push(row);
      }
    }
  }

  if (candidates.length === 0) {
    return { urls: [], matched: false };
  }

  // Sort: priority first, then prefer rows where year is an exact closer match
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    // Among same priority, prefer narrower year ranges (more specific)
    const aRange = a.year_to - a.year_from;
    const bRange = b.year_to - b.year_from;
    return aRange - bRange;
  });

  // Deduplicate URLs, skip local paths that don't exist on disk
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const row of candidates) {
    if (seen.has(row.image_url)) continue;
    seen.add(row.image_url);
    // Validate local paths — skip if file is missing (avoids broken image src)
    if (row.image_url.startsWith("/")) {
      const diskPath = path.join(process.cwd(), "public", row.image_url);
      try { fs.statSync(diskPath); } catch { continue; }
    }
    urls.push(row.image_url);
  }

  if (urls.length === 0) return { urls: [], matched: false };
  return { urls, matched: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip make prefix and common trim words so "Ioniq 5 SEL Long Range" → "ioniq 5" */
function normalizeModel(model: string, make: string): string {
  let m = model.toLowerCase().trim();

  // Strip make prefix
  const makeLow = make.toLowerCase().trim();
  if (makeLow && m.startsWith(makeLow + " ")) {
    m = m.slice(makeLow.length + 1).trim();
  }

  return m;
}

/**
 * Model match: the CSV model key should be a prefix or substring of the lookup model,
 * or the lookup model should contain all words in the CSV model key.
 * E.g. CSV "model 3" matches lookup "model 3 long range awd".
 */
function modelMatches(lookupModel: string, csvModel: string): boolean {
  if (lookupModel === csvModel) return true;
  // CSV model is a prefix of lookup ("focus electric" matches "focus electric hatchback lx")
  if (lookupModel.startsWith(csvModel + " ")) return true;
  // Lookup is a prefix of CSV model ("focus electric" matches CSV "focus electric hatchback")
  if (csvModel.startsWith(lookupModel + " ")) return true;

  // Substring match — only when the CSV model is longer (more specific) than a single word
  // Avoids "model x" matching "model 3 rwd" via partial substring
  const csvWordCount = csvModel.split(" ").length;
  if (csvWordCount >= 2) {
    if (lookupModel.includes(csvModel)) return true;
    if (csvModel.includes(lookupModel)) return true;
  }

  // Word-level: only when CSV model has multiple significant words (3+ chars each)
  // Single-word models (or models with only short identifiers) must match via prefix above
  const csvWords = csvModel.split(" ").filter((w) => w.length >= 3);
  if (csvWords.length >= 2 && csvWords.every((w) => lookupModel.includes(w))) return true;

  return false;
}
