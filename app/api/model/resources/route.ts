/**
 * Model Resources API
 *
 * GET /api/model/resources?make=X&model=Y&year=Z&country_mode=US|UK
 * Returns array of external resource links for a given vehicle.
 * All links are deterministic (no external API calls).
 */

import { NextRequest, NextResponse } from "next/server";

interface ModelResource {
  type: string;
  label: string;
  url: string;
  description: string;
}

// Curated manufacturer support pages for common makes
const MANUFACTURER_SUPPORT: Record<string, string> = {
  tesla: "https://www.tesla.com/support",
  toyota: "https://www.toyota.com/owners",
  honda: "https://owners.honda.com",
  ford: "https://www.ford.com/support",
  chevrolet: "https://my.chevrolet.com/how-to-support",
  hyundai: "https://www.hyundaiusa.com/us/en/owners",
  kia: "https://owners.kia.com",
  nissan: "https://www.nissanusa.com/owners",
  bmw: "https://www.bmwusa.com/owners-manuals.html",
  mercedes: "https://www.mbusa.com/en/owners",
  audi: "https://www.audiusa.com/us/web/en/myaudi.html",
  volkswagen: "https://www.vw.com/en/owners",
  subaru: "https://www.subaru.com/owners",
  mazda: "https://www.mazdausa.com/owners",
  rivian: "https://rivian.com/support",
  lucid: "https://www.lucidmotors.com/owners",
  polestar: "https://www.polestar.com/us/owner-resources",
};

function titleCase(s: string): string {
  return s
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("_");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const make = searchParams.get("make")?.trim();
  const model = searchParams.get("model")?.trim();
  const year = searchParams.get("year")?.trim();
  const countryMode = searchParams.get("country_mode") || "US";

  if (!make || !model) {
    return NextResponse.json(
      { success: false, error: "make and model are required" },
      { status: 400 }
    );
  }

  const resources: ModelResource[] = [];
  const makeLower = make.toLowerCase();
  const yearStr = year || "";

  // 1. Recall / Safety lookup
  if (countryMode === "UK") {
    resources.push({
      type: "recall",
      label: "Check MOT History",
      url: "https://www.check-mot.service.gov.uk/",
      description: "UK GOV.UK MOT check — requires registration number",
    });
  } else {
    const nhtsa = year
      ? `https://www.nhtsa.gov/recalls?nhtsaId=&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&year=${encodeURIComponent(year)}`
      : `https://www.nhtsa.gov/recalls?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
    resources.push({
      type: "recall",
      label: "NHTSA Recall Lookup",
      url: nhtsa,
      description: "Check for safety recalls and investigations",
    });
  }

  // 2. Wikipedia — best-guess article link
  const wikiTitle = `${titleCase(make)}_${titleCase(model)}`;
  resources.push({
    type: "wikipedia",
    label: "General Reference",
    url: `https://en.wikipedia.org/wiki/${wikiTitle}`,
    description: "Wikipedia article on this model (community-edited)",
  });

  // 3. Manufacturer support
  const mfgUrl = MANUFACTURER_SUPPORT[makeLower];
  if (mfgUrl) {
    resources.push({
      type: "manufacturer",
      label: `${make} Owner Support`,
      url: mfgUrl,
      description: "Official manufacturer support and resources",
    });
  } else {
    resources.push({
      type: "manufacturer",
      label: `${make} Support`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`${make} official owner support`)}`,
      description: "Search for manufacturer support page",
    });
  }

  // 4. Owner manual search
  resources.push({
    type: "manual",
    label: "Owner Manual",
    url: `https://www.google.com/search?q=${encodeURIComponent(`${yearStr} ${make} ${model} owner manual PDF`.trim())}`,
    description: "Search for the owner's manual PDF",
  });

  // 5. Warranty info search
  resources.push({
    type: "warranty",
    label: "Warranty Info",
    url: `https://www.google.com/search?q=${encodeURIComponent(`${make} warranty coverage ${yearStr}`.trim())}`,
    description: "Search for warranty coverage details",
  });

  return NextResponse.json(
    {
      success: true,
      make,
      model,
      year: year || null,
      resources,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    }
  );
}
