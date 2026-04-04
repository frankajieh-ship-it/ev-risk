/**
 * Session Tracking Utilities
 * Helpers for IP hashing and session management
 */

import { createHash } from "crypto";

// Salt for IP hashing (in production, use env variable)
const IP_HASH_SALT = process.env.IP_HASH_SALT || "evroutine-session-salt-2024";

// Persistent session keys
const PERSISTENT_SESSION_KEY = "offo_persistent_session";
const RECEIPT_TOKEN_KEY = "offo_receipt_token";

/**
 * Generate a cryptographically secure random hex string of the given byte length.
 * Uses Web Crypto API (available in all modern browsers and Node 19+).
 */
function secureRandomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get or create a persistent session ID (client-side only)
 * This ID persists across browser sessions via localStorage
 * Use this for analytics to track unique customers
 */
export function getOrCreatePersistentSessionId(): string | null {
  if (typeof window === "undefined") return null;

  // Check localStorage first
  let sessionId = localStorage.getItem(PERSISTENT_SESSION_KEY);

  if (!sessionId) {
    // Generate a new persistent session ID (96 bits of entropy)
    sessionId = `psess_${Date.now()}_${secureRandomHex(12)}`;
    localStorage.setItem(PERSISTENT_SESSION_KEY, sessionId);
  }

  return sessionId;
}

/**
 * Get the persistent session ID if it exists (doesn't create one)
 */
export function getPersistentSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PERSISTENT_SESSION_KEY);
}

/**
 * Get or create a receipt token (client-side only)
 * Used as anon_id for the payment system (purchases table)
 */
export function getOrCreateReceiptToken(): string {
  if (typeof window === "undefined") return "";
  const existing = localStorage.getItem(RECEIPT_TOKEN_KEY);
  if (existing && isValidReceiptToken(existing)) return existing;
  // 12 random bytes = 96 bits of entropy (hex-encoded = 24 chars)
  const token = `rt_${Date.now()}_${secureRandomHex(12)}`;
  localStorage.setItem(RECEIPT_TOKEN_KEY, token);
  return token;
}

/**
 * Get the receipt token if it exists (doesn't create one)
 */
export function getReceiptToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(RECEIPT_TOKEN_KEY);
}

/**
 * Validate a receipt token (anon_id) server-side.
 *
 * Tokens are generated as `rt_${Date.now()}_${random}` (client-side).
 * Rejects tokens that don't match the expected format, are in the future,
 * or are older than maxAgeDays (default 30).
 */
export function isValidReceiptToken(token: string | null, maxAgeDays = 30): boolean {
  if (!token || token.length < 10) return false;
  // Accept both legacy base-36 tokens and new hex tokens (24 hex chars = 96 bits)
  const match = token.match(/^rt_(\d{13})_[a-f0-9]{24}$/) || token.match(/^rt_(\d{13})_[a-z0-9]{8}$/);
  if (!match) return false;
  const ts = parseInt(match[1], 10);
  const now = Date.now();
  if (ts > now + 60_000) return false; // reject future tokens (1 min clock skew allowed)
  if (now - ts > maxAgeDays * 24 * 60 * 60 * 1000) return false;
  return true;
}

/**
 * Validate a persistent session ID server-side.
 * Format: psess_{13-digit-timestamp}_{alphanumeric}
 */
export function isValidPersistentSessionId(id: string | null, maxAgeDays = 365): boolean {
  if (!id || id.length < 10) return false;
  // Accept both legacy base-36 tokens and new hex tokens (24 hex chars = 96 bits)
  const match = id.match(/^psess_(\d{13})_[a-f0-9]{24}$/) || id.match(/^psess_(\d{13})_[a-z0-9]{9}$/);
  if (!match) return false;
  const ts = parseInt(match[1], 10);
  const now = Date.now();
  if (ts > now + 60_000) return false;
  if (now - ts > maxAgeDays * 24 * 60 * 60 * 1000) return false;
  return true;
}

/**
 * Hash an IP address for privacy-preserving storage
 */
export function hashIP(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256")
    .update(ip + IP_HASH_SALT)
    .digest("hex")
    .substring(0, 16); // Truncate for storage efficiency
}

/**
 * Extract client IP from request headers
 */
export function getClientIP(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const realIP = headers.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || realIP || null;
}

/**
 * Parse UTM parameters from URL search params
 */
export function parseUTMParams(searchParams: URLSearchParams): Record<string, string> {
  const utm: Record<string, string> = {};
  const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

  for (const key of utmKeys) {
    const value = searchParams.get(key);
    if (value) {
      utm[key] = value;
    }
  }

  return utm;
}

/**
 * Validate session ID format (UUID)
 */
export function isValidSessionId(id: string | null): boolean {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Risk tag type for type safety
 */
export type RiskTag =
  | "PUBLIC_CHARGING_DEPENDENCY"
  | "SHARED_INFRA_COMPETITION"
  | "ROUTINE_VARIABILITY_HIGH"
  | "LOW_PLANNING_TOLERANCE"
  | "WINTER_MOTORWAY_COMPRESSION"
  | "NO_DESTINATION_CHARGING"
  | "LONG_DAYS_FREQUENT"
  | "HOME_CHARGING_LIMITED"
  | "APARTMENT_CONDITIONAL"
  | "PRICE_SENSITIVITY_PUBLIC_RATES";

/**
 * Fit signal type
 */
export type FitSignal = "GOOD" | "CONDITIONAL" | "HIGH_FRICTION";

/**
 * Decision outcome type
 */
export type DecisionOutcome =
  | "MORE_CONFIDENT_BUYING"
  | "MORE_CONFIDENT_NOT_BUYING"
  | "NEED_MORE_TIME"
  | "CONFIRMED_CONCERNS"
  | "OTHER";

/**
 * Region type
 */
export type Region = "AUTO" | "UK" | "US";
