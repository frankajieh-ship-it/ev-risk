/**
 * Server-only session utilities — requires Node.js crypto.
 * Do NOT import this file from client components.
 */

import { createHash } from "crypto";

const IP_HASH_SALT = process.env.IP_HASH_SALT || "evroutine-session-salt-2024";

export function hashIP(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256")
    .update(ip + IP_HASH_SALT)
    .digest("hex")
    .substring(0, 16);
}

export function getClientIP(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const realIP = headers.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || realIP || null;
}
