/**
 * UTM Attribution — Client-side capture, persist, and retrieval
 *
 * Captures UTM params + click IDs from URL on landing,
 * persists in localStorage for 30 days, and provides
 * a flat object for embedding in event payloads.
 */

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  fbclid?: string;
  msclkid?: string;
  page_source?: string;
  landing_page?: string;
  referrer?: string;
  stored_at?: string;
}

const STORAGE_KEY = "offo_attribution_v1";
const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

const CLICK_ID_KEYS = ["gclid", "fbclid", "msclkid"] as const;

function captureFromUrl(): Partial<Attribution> | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const attr: Partial<Attribution> = {};
  let hasAny = false;

  for (const key of UTM_KEYS) {
    const val = params.get(key);
    if (val) {
      attr[key] = val;
      hasAny = true;
    }
  }

  for (const key of CLICK_ID_KEYS) {
    const val = params.get(key);
    if (val) {
      attr[key] = val;
      hasAny = true;
    }
  }

  return hasAny ? attr : null;
}

// Derives traffic source from UTM params or referrer.
// Paid campaigns MUST include UTM params in the ad URL to distinguish from organic:
//   e.g. ?utm_source=reddit&utm_medium=paid&utm_campaign=launch_v1
// Without UTMs, paid Reddit traffic is tagged as "reddit" (same as organic).
function derivePageSource(attr: Partial<Attribution>): string {
  if (attr.utm_source) return attr.utm_source;

  if (typeof document !== "undefined" && document.referrer) {
    try {
      const host = new URL(document.referrer).hostname.toLowerCase();
      // Own domain — treat as direct (internal navigation or extension links)
      if (host.includes("offolab.com")) return "direct";
      if (host.includes("google")) return "google_organic";
      if (host.includes("reddit")) return "reddit";
      if (host.includes("facebook") || host.includes("fb.com")) return "facebook";
      if (host.includes("twitter") || host.includes("x.com")) return "twitter";
      if (host.includes("bing")) return "bing_organic";
      return `ref_${host.replace(/\./g, "_")}`;
    } catch {
      return "direct";
    }
  }

  return "direct";
}

function getStored(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Attribution;
    // Check expiry
    if (parsed.stored_at) {
      const age = Date.now() - new Date(parsed.stored_at).getTime();
      if (age > EXPIRY_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

function store(attr: Attribution): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attr));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Initialize attribution on page load.
 * Captures URL params if present, merges with stored attribution,
 * derives page_source, and persists.
 */
export function initAttribution(): Attribution {
  if (typeof window === "undefined") return {};

  const fromUrl = captureFromUrl();
  const stored = getStored();

  // URL params override stored values
  const merged: Attribution = { ...stored, ...fromUrl };

  // Set defaults for fields only captured on first touch
  if (!merged.landing_page) {
    merged.landing_page = window.location.pathname;
  }
  if (!merged.referrer && document.referrer) {
    try {
      merged.referrer = new URL(document.referrer).hostname;
    } catch {
      // invalid referrer URL
    }
  }
  if (!merged.stored_at) {
    merged.stored_at = new Date().toISOString();
  }

  // Always re-derive page_source (URL params may have changed it)
  merged.page_source = derivePageSource(merged);

  // Persist if we got new URL params or had no stored attribution
  if (fromUrl || !stored) {
    store(merged);
  }

  return merged;
}

/**
 * Get attribution context for embedding in event payloads.
 * Returns a flat object with only non-undefined values.
 * Safe to call server-side (returns empty object).
 */
export function getAttributionForEvent(): Record<string, string> | null {
  if (typeof window === "undefined") return null;

  const stored = getStored();
  if (!stored) return null;

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(stored)) {
    if (typeof value === "string" && value.length > 0) {
      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}
