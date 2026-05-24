/**
 * Resolves a photo URL for a vehicle.
 *
 * Tier 0 (sync): static curated Wikimedia map — covers all common EVs instantly.
 * Tier 0b (sync): make-level fallback — generic make photo when model unknown.
 * Tier 1 (async): VinAudit stock image lookup.
 * Tier 2 (async): Auto.dev market listing scrape.
 *
 * Always call this instead of fetching /api/photos from server-side code.
 */

import { getStaticPhotoUrl, MAKE_FALLBACK_MAP } from "@/lib/vehicle-photo";
import { getVehicleImages } from "@/lib/vinaudit-client";
import { searchListings } from "@/lib/auto-dev-client";

function proxyIfWikimedia(url: string): string {
  if (url.includes("upload.wikimedia.org")) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

const MAKE_ALIASES: Record<string, string> = {
  "mercedes": "Mercedes-Benz",
};

const MODEL_EXACT_MAP: Record<string, string> = {
  "leaf": "LEAF", "leaf s": "LEAF", "leaf sv": "LEAF", "leaf sl": "LEAF",
  "leaf plus": "LEAF",
  "mustang mach-e": "Mustang Mach-E",
  "c40 recharge": "C40", "c40": "C40",
  "xc40 recharge": "XC40", "xc40": "XC40",
  "ioniq 5": "Ioniq 5", "ioniq 6": "Ioniq 6",
  "ev6": "EV6", "ev9": "EV9",
  "r1t": "R1T", "r1s": "R1S",
  "id.4": "ID.4", "id4": "ID.4",
  "cybertruck": "Cybertruck",
  "bolt euv": "Bolt EUV", "bolt ev": "Bolt EV", "bolt": "Bolt EV",
  "equinox ev": "Equinox EV", "blazer ev": "Blazer EV", "silverado ev": "Silverado EV",
  "lyriq": "LYRIQ", "optiq": "OPTIQ",
  "i4": "i4", "i5": "i5", "i7": "i7", "ix": "iX", "i3": "i3",
  "eqs": "EQS", "eqe": "EQE", "eqb": "EQB",
  "gv60": "GV60", "gv70": "GV70", "gv70 electrified": "GV70 Electrified",
};

const TRIM_SUFFIXES = [
  " crew cab", " super crew", " super cab", " extended cab", " double cab",
  " foundation series",
  " rear-wheel drive", " all-wheel drive", " front-wheel drive",
  " dual motor", " tri motor", " single motor",
  " long range", " standard range plus", " standard range", " extended range",
  " performance", " plaid", " gt", " gt-line",
  " sel", " se", " limited",
  " large pack", " max pack", " adventure",
  " xdrive60", " xdrive50", " xdrive40", " edrive40", " m50",
  " twin ultimate eawd", " twin ultimate", " twin", " single motor eawd",
  " recharge",
  " awd", " rwd", " fwd", " 4wd",
  " select", " premium", " pro", " plus", " s",
  " electrified", " electric", " ev",
  " hatchback", " sedan", " suv", " crossover",
];

function normalizeForAutodev(make: string, model: string | undefined) {
  const normMake = MAKE_ALIASES[make.toLowerCase()] ?? make;
  if (!model) return { make: normMake, model: undefined };
  let m = model.trim();
  if (m.toLowerCase().startsWith(normMake.toLowerCase() + " ")) m = m.slice(normMake.length + 1).trim();
  else if (m.toLowerCase().startsWith(make.toLowerCase() + " ")) m = m.slice(make.length + 1).trim();
  const exact = MODEL_EXACT_MAP[m.toLowerCase()];
  if (exact) return { make: normMake, model: exact };
  let stripped = true;
  while (stripped) {
    stripped = false;
    const low = m.toLowerCase();
    for (const suf of TRIM_SUFFIXES) {
      if (low.endsWith(suf)) {
        m = m.slice(0, m.length - suf.length).trim();
        const k = MODEL_EXACT_MAP[m.toLowerCase()];
        if (k) return { make: normMake, model: k };
        stripped = true;
        break;
      }
    }
  }
  return { make: normMake, model: m };
}

export async function resolveVehiclePhoto(opts: {
  make: string | null | undefined;
  model: string | null | undefined;
  year: number | null | undefined;
  trim?: string | null | undefined;
}): Promise<string | null> {
  const make = opts.make ?? undefined;
  if (!make) return null;

  const rawModel = [opts.model, opts.trim].filter(Boolean).join(" ") || undefined;

  // Tier 0: static map (sync, zero latency)
  const staticUrl = getStaticPhotoUrl(make, rawModel, opts.year ?? undefined);
  if (staticUrl) return proxyIfWikimedia(staticUrl);

  // Tier 0b: make fallback (sync)
  const makeFallback = MAKE_FALLBACK_MAP[make.toLowerCase()];
  if (makeFallback) return proxyIfWikimedia(makeFallback);

  // Tier 1: VinAudit
  const vaResult = await getVehicleImages({ year: opts.year ?? undefined, make, model: rawModel, limit: 1 });
  if (vaResult.success && vaResult.photo_urls.length > 0) return vaResult.photo_urls[0];

  // Tier 2: Auto.dev
  const { make: normMake, model: normModel } = normalizeForAutodev(make, rawModel);
  let result = await searchListings({ make: normMake, model: normModel, year: opts.year ?? undefined, limit: 3 });
  if (!result?.records?.length && opts.year) {
    result = await searchListings({ make: normMake, model: normModel, limit: 3 });
  }
  if (result?.records) {
    for (const record of result.records) {
      if (normMake && record.make) {
        const rMake = record.make.toLowerCase().replace(/[^a-z0-9]/g, "");
        const eMake = normMake.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (rMake !== eMake) continue;
      }
      if (record.primaryPhotoUrl) return record.primaryPhotoUrl;
    }
  }

  return null;
}
