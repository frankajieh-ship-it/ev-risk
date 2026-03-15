/**
 * Anonymous Garage — localStorage-first persistence
 *
 * Stores saved items for unauthenticated users. On login, the
 * auth hook calls syncAnonGarage() to push items to the server.
 *
 * Key: "offo_anon_garage"
 */

const STORAGE_KEY = "offo_anon_garage";

export interface AnonGarageItem {
  id: string;
  type: "shortlist" | "receipt" | "fit_profile";
  label: string;
  data: Record<string, unknown>;
  saved_at: string;
}

function read(): AnonGarageItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AnonGarageItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: AnonGarageItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or private mode — silently no-op
  }
}

export function getAnonGarage(): AnonGarageItem[] {
  return read();
}

export function addToAnonGarage(
  item: Omit<AnonGarageItem, "id" | "saved_at">
): AnonGarageItem {
  const items = read();
  const newItem: AnonGarageItem = {
    ...item,
    id: crypto.randomUUID(),
    saved_at: new Date().toISOString(),
  };
  write([newItem, ...items]);
  return newItem;
}

export function removeFromAnonGarage(id: string): void {
  write(read().filter((item) => item.id !== id));
}

export function clearAnonGarage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function anonGarageCount(): number {
  return read().length;
}

/** Total saved items visible to the user in nav badge (anon garage + shortlist). */
export function totalGarageCount(): number {
  const anon = anonGarageCount();
  // Also count shortlist items that may not be in anon garage yet
  try {
    const shortlist = localStorage.getItem("offo_shortlist");
    const shortlistCount = shortlist ? (JSON.parse(shortlist) as unknown[]).length : 0;
    // Avoid double-counting: shortlist items added via addToAnonGarage are in anon garage
    // Use anon garage count as source of truth for nav badge
    return Math.max(anon, shortlistCount);
  } catch {
    return anon;
  }
}
