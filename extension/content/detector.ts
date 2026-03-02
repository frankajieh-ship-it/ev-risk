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
  const hash = window.location.hash.toLowerCase();
  return (
    path.startsWith("/details/") || // Primary VDP format (Remix-based)
    path.includes("/listing/") || // /Cars/listing/{id}
    path.includes("inventorylisting/vdp.action") || // Legacy VDP (narrowed to avoid matching search pages)
    path.includes("vehicledetails.xhtml") || // Older legacy
    path.includes("/vdp/") || // Alternative VDP path
    /^#listing=\d+/.test(hash) // Hash-based listing overlay on search pages
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

/** Try to extract vehicle info from Remix context (CarGurus /details/ pages use Remix) */
function extractFromRemixContext(): VehicleInfo | null {
  try {
    const ctx = (window as any).__remixContext;
    if (!ctx?.state?.loaderData) return null;

    // Search through route loader data for vehicle/listing objects
    for (const routeData of Object.values(ctx.state.loaderData) as any[]) {
      if (!routeData || typeof routeData !== "object") continue;
      const listing =
        routeData.listing ||
        routeData.vehicle ||
        routeData.vdpData ||
        routeData.listingDetails;
      if (listing?.make && listing?.model) {
        return {
          year: String(listing.year || listing.modelYear || ""),
          make: listing.make || listing.makeName || "",
          model: listing.model || listing.modelName || "",
          trim: listing.trim || listing.trimName || "",
          price: String(listing.price || listing.listPrice || ""),
          mileage: String(listing.mileage || listing.miles || ""),
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Fallback: extract from page title (format: "2022 Tesla Model 3 Performance AWD - $27,999 - CarGurus") */
function extractFromTitle(): VehicleInfo | null {
  const title = document.title;
  if (!title || !title.toLowerCase().includes("cargurus")) return null;

  // Strip " - CarGurus" suffix and parse
  const clean = title.replace(/\s*[-|]\s*CarGurus.*$/i, "").trim();

  // Split on " - " to separate vehicle from price
  const parts = clean.split(/\s+-\s+/);
  const vehiclePart = parts[0] || clean;
  const pricePart = parts[1] || "";

  const match = vehiclePart.match(/^(\d{4})\s+(\w+)\s+(.+)/);
  if (!match) return null;

  const [, year, make, rest] = match;
  // Model is usually the first two words, trim is the remainder
  const words = rest.split(/\s+/);
  const model = words.slice(0, 2).join(" ");
  const trim = words.slice(2).join(" ");
  const price = pricePart.replace(/[^0-9]/g, "");

  return {
    year,
    make,
    model,
    trim: trim || undefined,
    price: price || undefined,
  };
}

/** Main detection: extract vehicle info and check if EV */
function detectEVListing(): { isEV: boolean; vehicle: VehicleInfo | null } {
  if (!isListingPage()) {
    return { isEV: false, vehicle: null };
  }

  const vehicle = extractFromNextData() || extractFromRemixContext() || extractFromTitle();
  if (!vehicle?.make || !vehicle?.model) {
    return { isEV: false, vehicle: null };
  }

  const evDetected = isEV(vehicle.make, vehicle.model, vehicle.trim);
  return { isEV: evDetected, vehicle };
}

// Store last result so badge.ts can request it after loading (race condition fix)
let lastDetectionResult: { isEV: boolean; vehicle: VehicleInfo | null } | null =
  null;

/** Run detection and notify badge script */
function detectAndNotify() {
  const result = detectEVListing();
  lastDetectionResult = result;
  console.log("[OFFO] Detection result:", result);

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

// Badge.ts requests current state after it loads (handles script load order race)
window.addEventListener("offo-request-detection", () => {
  if (lastDetectionResult) {
    window.dispatchEvent(
      new CustomEvent("offo-detection", {
        detail: {
          isEV: lastDetectionResult.isEV,
          vehicle: lastDetectionResult.vehicle,
          url: window.location.href,
        },
      })
    );
  }
});

// Initial detection
console.log("[OFFO] Detector loaded on:", window.location.href);
console.log("[OFFO] isListingPage:", isListingPage());
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
