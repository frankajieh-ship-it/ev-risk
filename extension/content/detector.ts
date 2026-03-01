/**
 * CarGurus Listing Detector
 *
 * Content script that detects EV listings on CarGurus pages.
 * Parses vehicle info from __NEXT_DATA__ or page title,
 * then checks against known EV models.
 */

import { isEV } from "../shared/ev-models";

interface VehicleInfo {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
  price?: string;
  mileage?: string;
}

/** Check if current URL is a CarGurus individual listing page (not search/browse) */
function isListingPage(): boolean {
  const path = window.location.pathname.toLowerCase();
  return (
    path.includes("/listing/") ||
    path.includes("inventorylisting/") ||
    path.includes("vehicledetails.xhtml") ||
    path.includes("/vdp/")
  );
}

/** Try to extract vehicle info from __NEXT_DATA__ (CarGurus uses Next.js) */
function extractFromNextData(): VehicleInfo | null {
  try {
    const el = document.getElementById("__NEXT_DATA__");
    if (!el?.textContent) return null;

    const data = JSON.parse(el.textContent);
    const pageProps = data?.props?.pageProps;
    if (!pageProps) return null;

    // CarGurus stores listing data in various shapes — try common paths
    const listing =
      pageProps.listing ||
      pageProps.listingDetails ||
      pageProps.vehicleListing ||
      pageProps.initialData?.listing;

    if (listing) {
      return {
        year: String(listing.year || listing.modelYear || ""),
        make: listing.make || listing.makeName || "",
        model: listing.model || listing.modelName || "",
        trim: listing.trim || listing.trimName || "",
        price: String(listing.price || listing.listPrice || ""),
        mileage: String(listing.mileage || listing.miles || ""),
      };
    }

    return null;
  } catch {
    return null;
  }
}

/** Fallback: extract from page title (format: "YEAR MAKE MODEL ... - CarGurus") */
function extractFromTitle(): VehicleInfo | null {
  const title = document.title;
  if (!title || !title.toLowerCase().includes("cargurus")) return null;

  // Strip " - CarGurus" suffix and parse
  const clean = title.replace(/\s*[-|]\s*CarGurus.*$/i, "").trim();
  const match = clean.match(/^(\d{4})\s+(\w+)\s+(.+)/);
  if (!match) return null;

  const [, year, make, rest] = match;
  // Model is usually the first word(s) of the rest
  const model = rest.split(/\s+/).slice(0, 2).join(" ");

  return { year, make, model };
}

/** Main detection: extract vehicle info and check if EV */
function detectEVListing(): { isEV: boolean; vehicle: VehicleInfo | null } {
  if (!isListingPage()) {
    return { isEV: false, vehicle: null };
  }

  const vehicle = extractFromNextData() || extractFromTitle();
  if (!vehicle?.make || !vehicle?.model) {
    return { isEV: false, vehicle: null };
  }

  const evDetected = isEV(vehicle.make, vehicle.model, vehicle.trim);
  return { isEV: evDetected, vehicle };
}

/** Run detection and notify badge script */
function detectAndNotify() {
  const result = detectEVListing();

  // Dispatch custom event for badge.ts to listen to
  window.dispatchEvent(
    new CustomEvent("offo-detection", {
      detail: {
        isEV: result.isEV,
        vehicle: result.vehicle,
        url: window.location.href,
      },
    })
  );
}

// Initial detection
detectAndNotify();

// Re-detect on SPA navigation (CarGurus uses Next.js client-side routing)
let lastUrl = window.location.href;

const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    // Small delay to let Next.js hydrate new page data
    setTimeout(detectAndNotify, 500);
  }
});

observer.observe(document.querySelector("head > title") || document.head, {
  childList: true,
  subtree: true,
  characterData: true,
});

window.addEventListener("popstate", () => {
  setTimeout(detectAndNotify, 500);
});
