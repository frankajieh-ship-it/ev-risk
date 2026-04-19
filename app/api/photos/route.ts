/**
 * GET /api/photos?make=Tesla&model=Model+3&year=2023&vin=...
 *
 * Fetches professional vehicle images.
 * Primary:    VinAudit Vehicle Images API (stock images, consistent quality)
 * Fallback 1: Auto.dev market listings (actual listing photos)
 * Fallback 2: Imagin Studios CDN renders (free, no API key required)
 */

import { NextRequest, NextResponse } from "next/server";
import { searchListings } from "@/lib/auto-dev-client";
import { getVehicleImages } from "@/lib/vinaudit-client";

export const maxDuration = 10;

// Auto.dev exact model name overrides (after stripping make prefix).
// Key = lowercase, value = exact string Auto.dev expects.
const MODEL_EXACT_MAP: Record<string, string> = {
  // Nissan
  "leaf": "LEAF", "leaf s": "LEAF", "leaf sv": "LEAF", "leaf sl": "LEAF",
  "leaf plus": "LEAF", "leaf plus s": "LEAF", "leaf plus sv": "LEAF", "leaf plus sl": "LEAF",
  // Ford
  "mustang mach-e": "Mustang Mach-E",
  "mustang mach-e select rwd": "Mustang Mach-E",
  "mustang mach-e select": "Mustang Mach-E",
  "mustang mach-e premium rwd": "Mustang Mach-E",
  "mustang mach-e premium awd": "Mustang Mach-E",
  "mustang mach-e premium": "Mustang Mach-E",
  "mustang mach-e gt awd": "Mustang Mach-E",
  "mustang mach-e gt": "Mustang Mach-E",
  "mustang mach-e california route 1 awd": "Mustang Mach-E",
  "mustang mach-e california route 1 rwd": "Mustang Mach-E",
  "mustang mach-e california route 1": "Mustang Mach-E",
  // Volvo — Auto.dev uses "C40" / "XC40" (not "C40 Recharge")
  "c40 recharge twin ultimate eawd": "C40",
  "c40 recharge twin ultimate": "C40",
  "c40 recharge twin": "C40",
  "c40 recharge single": "C40",
  "c40 recharge": "C40",
  "c40": "C40",
  "xc40 recharge twin ultimate": "XC40",
  "xc40 recharge twin": "XC40",
  "xc40 recharge single": "XC40",
  "xc40 recharge": "XC40",
  "xc40": "XC40",
  // Genesis
  "gv60 performance": "GV60",
  "gv60 advanced": "GV60",
  "gv60 standard": "GV60",
  "gv70 electrified": "GV70 Electrified",
  "gv70 gt-line": "GV70",
  "gv70": "GV70",
  "gv80 electrified": "GV80 Electrified",
  "g80 electrified": "G80 Electrified",
  // Hyundai — Auto.dev uses title case, NOT all-caps
  "ioniq 5": "Ioniq 5", "ioniq 6": "Ioniq 6",
  // Kia
  "ev6": "EV6", "ev9": "EV9",
  // Rivian
  "r1t": "R1T", "r1s": "R1S",
  // Volkswagen
  "id.4": "ID.4", "id4": "ID.4",
  // Tesla
  "cybertruck": "Cybertruck",
  "cybertruck crew cab": "Cybertruck",
  "cybertruck foundation series": "Cybertruck",
  // Chevrolet EVs
  "bolt euv": "Bolt EUV", "bolt euv lt": "Bolt EUV", "bolt euv premier": "Bolt EUV",
  "bolt ev": "Bolt EV", "bolt ev lt": "Bolt EV", "bolt ev premier": "Bolt EV",
  "bolt": "Bolt EV",
  "equinox ev": "Equinox EV", "blazer ev": "Blazer EV", "silverado ev": "Silverado EV",
  // Cadillac
  "lyriq": "LYRIQ", "lyriq luxury 1": "LYRIQ", "lyriq luxury 2": "LYRIQ", "lyriq luxury 3": "LYRIQ",
  "lyriq sport 1": "LYRIQ", "lyriq sport 2": "LYRIQ", "lyriq v-series": "LYRIQ",
  "optiq": "OPTIQ", "escalade iq": "ESCALADE IQ",
  // BMW
  "i3": "i3", "i4": "i4", "i5": "i5", "i7": "i7", "ix": "iX", "ix3": "iX3",
  "i4 edrive40": "i4", "i4 m50": "i4", "i5 xdrive40": "i5", "i5 edrive40": "i5",
  "i7 xdrive60": "i7", "ix xdrive40": "iX", "ix xdrive50": "iX", "ix m60": "iX",
  "ix xdrive60": "iX",
  // Mercedes (make comes in as "Mercedes" or "Mercedes-Benz")
  "eqs 450+": "EQS", "eqs 580 4matic": "EQS", "eqs": "EQS",
  "eqb 300 4matic": "EQB", "eqb": "EQB",
  "eqe 350+": "EQE", "eqe": "EQE",
};

// Trim suffixes Auto.dev doesn't use — strip these from model names.
// Order matters: longer strings first.
const TRIM_SUFFIXES = [
  // Truck / cab body styles (must come before shorter suffixes)
  " crew cab", " super crew", " super cab", " extended cab", " double cab",
  " quad cab", " mega cab", " king cab", " access cab", " regular cab",
  " foundation series",
  // Powertrain descriptors (long forms before short)
  " rear-wheel drive", " all-wheel drive", " front-wheel drive",
  " dual motor", " tri motor", " single motor",
  // Range
  " long range", " standard range plus", " standard range", " extended range", " extended", " standard",
  // Performance tiers
  " performance", " plaid", " plaid+",
  // Trim levels
  " gt", " gt-line", " gt line", " wind", " earth", " light",
  " sel", " se", " limited", " blue",
  // Pack/battery descriptors (Rivian)
  " large pack", " max pack", " adventure",
  " xdrive50", " xdrive40", " edrive40", " edrive35", " m50",
  " 4s", " turbo", " turbo s", " cross turismo", " sport turismo",
  " pure", " grand touring", " grand touring+",
  // Tesla battery/powertrain designators (e.g. "Model S 90D AWD" → "Model S")
  " p100d", " p90d", " p85d", " p85+", " p85",
  " 100d", " 90d", " 85d", " 75d", " 70d", " 60d",
  // Drivetrain short forms
  " awd", " rwd", " fwd", " 4wd",
  " 450+", " 580", " 350+",
  " e-4wd",
  " select", " premium", " pro s", " pro", " plus", " s",
  // Volvo sub-model descriptors
  " twin ultimate eawd", " twin ultimate", " twin", " single motor eawd", " single motor",
  " recharge",
  // Genesis / Hyundai trim words
  " electrified", " performance", " advanced",
  // Ford Mach-E variants
  " california route 1", " california route",
  // Body styles
  " hatchback", " sedan", " suv", " crossover", " coupe", " convertible", " wagon",
  // Electric-specific descriptors
  " electric", " ev",
];

// Make aliases — Auto.dev uses specific make strings
const MAKE_ALIASES: Record<string, string> = {
  "mercedes": "Mercedes-Benz",
};

/**
 * Normalize make + model for Auto.dev search:
 * 1. Apply make aliases
 * 2. Strip make prefix from model string if present
 * 3. Apply exact model overrides
 * 4. Strip known trim suffixes to get base model name
 */
function normalizeForAutodev(
  make: string | undefined,
  model: string | undefined
): { make: string | undefined; model: string | undefined } {
  const normalizedMake = make ? (MAKE_ALIASES[make.toLowerCase()] ?? make) : make;

  if (!model) return { make: normalizedMake, model };

  let m = model.trim();

  // Strip make prefix (e.g. "Chevrolet Bolt EUV" → "Bolt EUV")
  if (normalizedMake && m.toLowerCase().startsWith(normalizedMake.toLowerCase() + " ")) {
    m = m.slice(normalizedMake.length + 1).trim();
  } else if (make && m.toLowerCase().startsWith(make.toLowerCase() + " ")) {
    m = m.slice(make.length + 1).trim();
  }

  // Apply exact overrides first
  const exactKey = m.toLowerCase();
  if (MODEL_EXACT_MAP[exactKey]) {
    return { make: normalizedMake, model: MODEL_EXACT_MAP[exactKey] };
  }

  // Strip known trim suffixes (case-insensitive) — loop until no more match
  let stripped = true;
  while (stripped) {
    stripped = false;
    const mLower = m.toLowerCase();
    for (const suffix of TRIM_SUFFIXES) {
      if (mLower.endsWith(suffix)) {
        m = m.slice(0, m.length - suffix.length).trim();
        // Re-check exact map after stripping
        const newKey = m.toLowerCase();
        if (MODEL_EXACT_MAP[newKey]) {
          return { make: normalizedMake, model: MODEL_EXACT_MAP[newKey] };
        }
        stripped = true;
        break;
      }
    }
  }

  return { make: normalizedMake, model: m };
}

// ---------------------------------------------------------------------------
// Static Wikipedia Commons fallback — curated photo URLs for EV catalog.
// Keys are lowercase normalized model names (make prefix stripped, trim stripped).
// All URLs are stable Wikimedia CDN thumb URLs (Creative Commons licensed).
// ---------------------------------------------------------------------------

const STATIC_PHOTO_MAP: Record<string, string> = {
  // Hyundai
  "ioniq 5": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Hyundai_Ioniq_5_1X7A7085.jpg/960px-Hyundai_Ioniq_5_1X7A7085.jpg",
  "ioniq 6": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Hyundai_Ioniq_6_1X7A7258.jpg/960px-Hyundai_Ioniq_6_1X7A7258.jpg",
  // Kia
  "ev6": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Kia_EV6_GT_IMG_8171.jpg/960px-Kia_EV6_GT_IMG_8171.jpg",
  "ev9": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Kia_EV9_MV1_Aurora_Black_Pearl_%285%29.jpg/960px-Kia_EV9_MV1_Aurora_Black_Pearl_%285%29.jpg",
  // Tesla
  "model 3": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Tesla_Model_3_%282023%29_IMG_9488_%28cropped%29.jpg/960px-Tesla_Model_3_%282023%29_IMG_9488_%28cropped%29.jpg",
  "model y": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Tesla_Model_in_M%C3%BCnchen.jpg/960px-Tesla_Model_in_M%C3%BCnchen.jpg",
  "model s": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Tesla_Model_S_%282023%29_Motorworld_Munich_1X7A0025.jpg/960px-Tesla_Model_S_%282023%29_Motorworld_Munich_1X7A0025.jpg",
  "model x": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Tesla_Model_X_100D_1X7A6736.jpg/960px-Tesla_Model_X_100D_1X7A6736.jpg",
  "cybertruck": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/2024_Tesla_Cybertruck_Foundation_Series_IMG_0634_%28cropped%29.jpg/960px-2024_Tesla_Cybertruck_Foundation_Series_IMG_0634_%28cropped%29.jpg",
  // Chevrolet
  "bolt ev": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Chevrolet_Bolt_EV_Black.jpg/960px-Chevrolet_Bolt_EV_Black.jpg",
  "bolt euv": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/2022-2024_Chevrolet_Bolt_EUV_%C3%89nergir.JPG/960px-2022-2024_Chevrolet_Bolt_EUV_%C3%89nergir.JPG",
  "equinox ev": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Chevrolet_Equinox_EV_002.jpg/960px-Chevrolet_Equinox_EV_002.jpg",
  "blazer ev": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Chevrolet_Blazer_EV_%28LT%2C_Riptide_Blue%29_-_badge_closeup.jpg/960px-Chevrolet_Blazer_EV_%28LT%2C_Riptide_Blue%29_-_badge_closeup.jpg",
  "spark": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Chevrolet_Spark_EV_%26_Bolt_EV_CRI_02_2023_1899.jpg/960px-Chevrolet_Spark_EV_%26_Bolt_EV_CRI_02_2023_1899.jpg",
  // Nissan
  "leaf": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/2023_Nissan_Leaf_Tekna.jpg/960px-2023_Nissan_Leaf_Tekna.jpg",
  // Ford
  "mustang mach-e": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Ford_Mustang_Mach-E_Rally_Auto_Zuerich_2023_1X7A1182.jpg/960px-Ford_Mustang_Mach-E_Rally_Auto_Zuerich_2023_1X7A1182.jpg",
  "f-150 lightning": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Ford_F-150_Lightning_IAA_2023_1X7A0596.jpg/960px-Ford_F-150_Lightning_IAA_2023_1X7A0596.jpg",
  // Rivian
  "r1t": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Rivian_R1T_-_2nd_Row_07.png/960px-Rivian_R1T_-_2nd_Row_07.png",
  "r1s": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Rivian_R1S_-_3.jpg/960px-Rivian_R1S_-_3.jpg",
  // Volkswagen
  "id.4": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/VW_ID4_CRI_03_2023_2386.jpg/960px-VW_ID4_CRI_03_2023_2386.jpg",
  "id4": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/VW_ID4_CRI_03_2023_2386.jpg/960px-VW_ID4_CRI_03_2023_2386.jpg",
  // BMW
  "ix": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/2023_BMW_iX_12_2022_CRI_0831.jpg/960px-2023_BMW_iX_12_2022_CRI_0831.jpg",
  "i4": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/BMW_i4_CRI_02_2023_1881.jpg/960px-BMW_i4_CRI_02_2023_1881.jpg",
  "i5": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/BMW_i5_M60_xDrive_%28G60%2C_2024%29_%2853767149083%29.jpg/960px-BMW_i5_M60_xDrive_%28G60%2C_2024%29_%2853767149083%29.jpg",
  "i7": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/BMW_G70E_i7_xDrive60_Design_Pure_Excellence_BMW_Individual_Oxide_Grey_Tanzanite_Blue_Metallic_%2830%29.jpg/960px-BMW_G70E_i7_xDrive60_Design_Pure_Excellence_BMW_Individual_Oxide_Grey_Tanzanite_Blue_Metallic_%2830%29.jpg",
  "i3": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/D%C3%BClmen%2C_Hausd%C3%BClmen%2C_Sandstra%C3%9Fe%2C_BMW_i3_--_2016_--_1748-54.jpg/960px-D%C3%BClmen%2C_Hausd%C3%BClmen%2C_Sandstra%C3%9Fe%2C_BMW_i3_--_2016_--_1748-54.jpg",
  // Polestar
  "polestar 2": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Polestar_2_BST_Edition_230_Auto_Zuerich_2023_1X7A1303.jpg/960px-Polestar_2_BST_Edition_230_Auto_Zuerich_2023_1X7A1303.jpg",
  "2": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Polestar_2_CMA_Space_%282%29.jpg/960px-Polestar_2_CMA_Space_%282%29.jpg",
  // Lucid
  "air": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Lucid_Air_Dream_edition%2C_IAA_Open_Space_2023%2C_Munich_%28P1120054%29.jpg/960px-Lucid_Air_Dream_edition%2C_IAA_Open_Space_2023%2C_Munich_%28P1120054%29.jpg",
  // Mercedes
  "eqs": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Mercedes-Benz_EQS_450%2B%2C_IAA_Open_Space_2023%2C_Munich_%28P1120197%29.jpg/960px-Mercedes-Benz_EQS_450%2B%2C_IAA_Open_Space_2023%2C_Munich_%28P1120197%29.jpg",
  // Genesis
  "gv60": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Genesis_GV60_Classic-Gala_2022_1X7A0354.jpg/960px-Genesis_GV60_Classic-Gala_2022_1X7A0354.jpg",
  "gv70": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Genesis_Electrified_GV70_1X7A6390.jpg/960px-Genesis_Electrified_GV70_1X7A6390.jpg",
  "gv70 electrified": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Genesis_Electrified_GV70_1X7A6390.jpg/960px-Genesis_Electrified_GV70_1X7A6390.jpg",
  "g80 electrified": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Genesis_Electrified_G80_Auto_Zuerich_2023_1X7A1133.jpg/960px-Genesis_Electrified_G80_Auto_Zuerich_2023_1X7A1133.jpg",
  // Cadillac
  "lyriq": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/2023_Cadillac_Lyriq_Luxury_1%2C_front_right%2C_08-22-2024.jpg/960px-2023_Cadillac_Lyriq_Luxury_1%2C_front_right%2C_08-22-2024.jpg",
  // Volvo
  "c40 recharge": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/VOLVO_C40_RECHARGE_INTERIOR.jpg/960px-VOLVO_C40_RECHARGE_INTERIOR.jpg",
  "xc40 recharge": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Volvo_XC40_Recharge_Facelift_IMG_8127.jpg/960px-Volvo_XC40_Recharge_Facelift_IMG_8127.jpg",
};

/**
 * Look up a curated Wikipedia Commons photo for a make/model.
 * Returns a URL if matched, otherwise null.
 */
function getStaticPhotoUrl(make: string | undefined, model: string | undefined): string | null {
  if (!make || !model) return null;

  // Strip make prefix from model (e.g. "Hyundai Ioniq 5 SEL Long Range" → "Ioniq 5 SEL Long Range")
  let m = model.trim();
  if (m.toLowerCase().startsWith(make.toLowerCase() + " ")) {
    m = m.slice(make.length + 1).trim();
  }

  // Strip common trim suffixes to get base model
  const trimSuffixes = [
    " sel long range", " se standard", " se long range", " long range", " standard range plus",
    " standard range", " extended range", " performance", " premium awd", " premium rwd", " premium",
    " select rwd", " select", " gt-line awd", " gt-line rwd", " gt-line", " gt line", " gt awd", " gt",
    " pro s", " pro", " plus s", " plus",
    " large pack", " max pack", " adventure", " light long range", " light",
    " awd", " rwd", " fwd", " 4wd", " xdrive60", " xdrive50", " xdrive40", " edrive40", " m50",
    " twin ultimate", " twin", " single motor", " recharge",
    " 450+", " 580", " pure", " ev", " electric",
    " 1lt", " lt", " premier",
  ];
  let stripped = true;
  while (stripped) {
    stripped = false;
    const mLow = m.toLowerCase();
    for (const suf of trimSuffixes) {
      if (mLow.endsWith(suf)) {
        m = m.slice(0, m.length - suf.length).trim();
        stripped = true;
        break;
      }
    }
  }

  return STATIC_PHOTO_MAP[m.toLowerCase()] ?? null;
}

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const vin = p.get("vin") || undefined;
  const make = p.get("make") || undefined;
  const rawModel = p.get("model") || undefined;
  const year = p.get("year") ? Number(p.get("year")) : undefined;

  if (!vin && !make) {
    return NextResponse.json({ photo_urls: [] });
  }

  // --- Primary: VinAudit Vehicle Images ---
  const vinauditResult = await getVehicleImages({ vin, year, make, model: rawModel, limit: 6 });
  if (vinauditResult.success && vinauditResult.photo_urls.length > 0) {
    return NextResponse.json({ photo_urls: vinauditResult.photo_urls, source: "vinaudit" });
  }

  // --- Fallback: Auto.dev listing photos ---
  const { make: normalizedMake, model } = normalizeForAutodev(make, rawModel);
  // Try with year first; if no results, retry without year (Auto.dev inventory varies by year)
  let result = await searchListings({ vin, make: normalizedMake, model, year, limit: 8 });
  if ((!result?.records || result.records.length === 0) && year) {
    result = await searchListings({ vin, make: normalizedMake, model, limit: 8 });
  }

  const photoUrls: string[] = [];
  if (result?.records) {
    for (const record of result.records) {
      // Filter by make to prevent wrong-car images (e.g. Auto.dev returning Genesis when searching BMW i5)
      if (normalizedMake && record.make) {
        const recordMake = record.make.toLowerCase();
        const expectedMake = normalizedMake.toLowerCase();
        if (!recordMake.includes(expectedMake) && !expectedMake.includes(recordMake)) continue;
      }
      // Filter by model to prevent wrong-car images (e.g. gas Mustang GT for Mach-E search)
      if (model && record.model) {
        const recordModel = record.model.toLowerCase();
        const expectedModel = model.toLowerCase();
        const modelWords = expectedModel.split(" ").filter((w) => w.length > 2);
        if (modelWords.length > 0 && !modelWords.every((w) => recordModel.includes(w))) continue;
      }
      if (record.primaryPhotoUrl && !photoUrls.includes(record.primaryPhotoUrl)) {
        photoUrls.push(record.primaryPhotoUrl);
      }
      if (photoUrls.length >= 6) break;
    }
  }

  if (photoUrls.length > 0) {
    return NextResponse.json({ photo_urls: photoUrls, source: "autodev" });
  }

  // --- Final fallback: curated Wikipedia Commons static photos ---
  const staticUrl = getStaticPhotoUrl(make, rawModel);
  if (staticUrl) {
    return NextResponse.json({ photo_urls: [staticUrl], source: "static" });
  }

  return NextResponse.json({ photo_urls: [], source: "none" });
}
