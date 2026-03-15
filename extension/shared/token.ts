/**
 * Receipt Token Helper
 *
 * Generates and caches a receipt_token using the same format as the ev-risk
 * web app (lib/session-utils.ts → getOrCreateReceiptToken).
 * Format: rt_${13-digit-timestamp}_${8-char-random}
 * Valid for 30 days.
 */

const STORAGE_KEY = "offo_receipt_token";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function isTokenValid(token: string): boolean {
  const match = token.match(/^rt_(\d{13})_[a-z0-9]+$/);
  if (!match) return false;
  const ts = parseInt(match[1], 10);
  const now = Date.now();
  if (ts > now + 60_000) return false; // reject future tokens
  return now - ts < MAX_AGE_MS;
}

function createToken(): string {
  return `rt_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

export function getOrCreateReceiptToken(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const existing = result[STORAGE_KEY];
      if (existing && isTokenValid(existing)) {
        resolve(existing);
        return;
      }
      const fresh = createToken();
      chrome.storage.local.set({ [STORAGE_KEY]: fresh });
      resolve(fresh);
    });
  });
}
