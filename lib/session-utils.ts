/**
 * Session Tracking Utilities
 * Helpers for IP hashing and session management
 */

import { createHash } from "crypto";

// Salt for IP hashing (in production, use env variable)
const IP_HASH_SALT = process.env.IP_HASH_SALT || "evroutine-session-salt-2024";

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
