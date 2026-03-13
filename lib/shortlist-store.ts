/**
 * Shortlist Store — client-side localStorage CRUD
 *
 * Manages a list of up to 4 ShortlistCandidates.
 * Safe to import in any client component.
 */

import type { ShortlistCandidate } from "./shortlist-coach";

const SHORTLIST_KEY = "offo_shortlist";
const MAX_SHORTLIST = 4;

function safeRead(): ShortlistCandidate[] {
  try {
    const raw = localStorage.getItem(SHORTLIST_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ShortlistCandidate[];
  } catch {
    return [];
  }
}

function safeWrite(candidates: ShortlistCandidate[]): void {
  try {
    localStorage.setItem(SHORTLIST_KEY, JSON.stringify(candidates));
  } catch {
    // localStorage unavailable (SSR or private mode) — silent no-op
  }
}

export function getShortlist(): ShortlistCandidate[] {
  return safeRead();
}

export function addToShortlist(candidate: ShortlistCandidate): {
  success: boolean;
  reason?: "duplicate" | "full";
} {
  const existing = safeRead();

  if (existing.some((c) => c.run_id === candidate.run_id)) {
    return { success: false, reason: "duplicate" };
  }
  if (existing.length >= MAX_SHORTLIST) {
    return { success: false, reason: "full" };
  }

  safeWrite([...existing, candidate]);
  return { success: true };
}

export function removeFromShortlist(run_id: string): void {
  const existing = safeRead();
  safeWrite(existing.filter((c) => c.run_id !== run_id));
}

export function clearShortlist(): void {
  try {
    localStorage.removeItem(SHORTLIST_KEY);
  } catch {
    // silent
  }
}

export function shortlistCount(): number {
  return safeRead().length;
}
