/**
 * Region Resolution
 * Auto-detects user region from browser settings
 */

import type { Region } from "./regionCopy";

export type RegionSelection = "AUTO" | "US" | "UK";

export function resolveRegion(selection: RegionSelection): Region {
  if (selection !== "AUTO") return selection;

  // 1) Language detection
  if (typeof navigator !== "undefined") {
    const lang = navigator.language?.toLowerCase() || "";
    if (lang.includes("en-gb")) return "UK";
  }

  // 2) Timezone detection
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.includes("London") || tz.includes("Europe/London")) return "UK";
  } catch {
    // Ignore timezone detection errors
  }

  return "US"; // Default
}
