/**
 * OFFO Region Configuration
 *
 * Supports US (default) and UK (beta).
 * Provides currency formatting, locale config, and UK copy overrides.
 */

export type Region = "US" | "UK";

export interface RegionConfig {
  code: Region;
  currency: string;
  currencySymbol: string;
  locale: string;
  mileageUnit: string;
  labels: Record<string, string>;
}

export const REGION_CONFIGS: Record<Region, RegionConfig> = {
  US: {
    code: "US",
    currency: "USD",
    currencySymbol: "$",
    locale: "en-US",
    mileageUnit: "mi",
    labels: {},
  },
  UK: {
    code: "UK",
    currency: "GBP",
    currencySymbol: "£",
    locale: "en-GB",
    mileageUnit: "mi",
    labels: {
      title_check: "Ownership & vehicle history checks",
      seller_questions: "Seller or dealer questions",
      fees_addons: "Dealer extras and fees",
      out_the_door_price: "Drive-away price",
      registration_paperwork: "V5C, service history & MOT checks",
      carfax: "HPI or vehicle history check",
      title_status: "Ownership status",
      clean_title: "Clear ownership",
      salvage_title: "Insurance write-off",
      rebuilt_title: "Cat S/N repaired",
      doc_fee: "Admin fee",
      tax_estimate: "VAT estimate",
    },
  },
};

/** Format a price number for the given region */
export function formatPrice(amount: number, region: Region = "US"): string {
  const cfg = REGION_CONFIGS[region];
  return new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency: cfg.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Get a UI label, using UK override if available */
export function getLabel(key: string, region: Region = "US"): string {
  return REGION_CONFIGS[region].labels[key] || key;
}

/** Auto-detect region from browser locale/timezone */
export function detectRegion(): Region {
  if (typeof navigator === "undefined") return "US";
  const lang = navigator.language || "";
  if (lang.startsWith("en-GB") || lang.includes("GB")) return "UK";
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "Europe/London") return "UK";
  } catch {
    // ignore
  }
  return "US";
}
