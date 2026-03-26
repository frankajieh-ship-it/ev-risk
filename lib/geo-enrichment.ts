/**
 * IP-to-Metro Geo Enrichment
 *
 * Resolves an IP address to city/state/lat/lon using ip-api.com
 * (free tier, no API key required, limit 45 req/min).
 *
 * Results are persisted back to user_events.geo_metro etc. on event insert.
 * Failures are silent — missing geo data is acceptable.
 */

export interface GeoResult {
  metro: string;   // "Chicago, IL"
  state: string;   // "IL"
  lat: number;
  lon: number;
}

const GEO_CACHE = new Map<string, GeoResult | null>();

/**
 * Look up geo data for an IP address.
 * Returns null for private IPs, unknown addresses, or API failures.
 */
export async function enrichGeo(ip: string | null | undefined): Promise<GeoResult | null> {
  if (!ip || ip === "unknown" || isPrivateIp(ip)) return null;

  // In-memory cache per process (short-lived; avoids hammering the API for bot storms)
  if (GEO_CACHE.has(ip)) return GEO_CACHE.get(ip)!;

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,regionCode,lat,lon`,
      { signal: AbortSignal.timeout(1500) }
    );
    if (!res.ok) {
      GEO_CACHE.set(ip, null);
      return null;
    }
    const data = await res.json();
    if (data.status !== "success" || !data.city) {
      GEO_CACHE.set(ip, null);
      return null;
    }
    const result: GeoResult = {
      metro: data.regionCode ? `${data.city}, ${data.regionCode}` : data.city,
      state: data.regionCode || "",
      lat: data.lat,
      lon: data.lon,
    };
    GEO_CACHE.set(ip, result);
    return result;
  } catch {
    GEO_CACHE.set(ip, null);
    return null;
  }
}

function isPrivateIp(ip: string): boolean {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.") ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "localhost"
  );
}
