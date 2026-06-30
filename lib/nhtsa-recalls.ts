/**
 * NHTSA Recall lookup by make/model/year.
 * Free, unlimited, authoritative — no API key required.
 * https://api.nhtsa.gov/recalls/recallsByVehicle
 */

export interface NhtsaRecall {
  campaign_number: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
  report_date: string;
  park_it: boolean;
  park_outside: boolean;
  over_the_air_update: boolean;
}

export interface RecallResult {
  recall_count: number;
  park_it: boolean;
  park_outside: boolean;
  recalls: NhtsaRecall[];
}

// Model name overrides: NHTSA uses specific strings that differ from common names.
// Key = lowercase make|model, value = NHTSA model string.
const NHTSA_MODEL_MAP: Record<string, string> = {
  "chevrolet|bolt ev": "Bolt EV",
  "chevrolet|bolt euv": "Bolt EUV",
  "chevrolet|blazer ev": "Blazer EV",
  "chevrolet|equinox ev": "Equinox EV",
  "chevrolet|silverado ev": "Silverado EV",
  "ford|mustang mach-e": "MUSTANG MACH-E",
  "ford|f-150 lightning": "F-150 LIGHTNING",
  "nissan|leaf": "LEAF",
  "volkswagen|id.4": "ID.4",
  "hyundai|ioniq 5": "IONIQ 5",
  "hyundai|ioniq 6": "IONIQ 6",
  "kia|ev6": "EV6",
  "kia|ev9": "EV9",
  "bmw|i4": "I4",
  "bmw|ix": "IX",
  "bmw|i7": "I7",
  "cadillac|lyriq": "LYRIQ",
  "gmc|hummer ev": "HUMMER EV",
  "rivian|r1t": "R1T",
  "rivian|r1s": "R1S",
};

function resolveNhtsaModel(make: string, model: string): string {
  const key = `${make.toLowerCase()}|${model.toLowerCase()}`;
  return NHTSA_MODEL_MAP[key] ?? model;
}

export async function getNhtsaRecalls(
  make: string,
  model: string,
  year: number
): Promise<RecallResult | null> {
  try {
    const nhtsaModel = resolveNhtsaModel(make, model);
    const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(nhtsaModel)}&modelYear=${year}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;

    const data = await res.json();
    const results: Array<Record<string, unknown>> = data?.results ?? [];

    const recalls: NhtsaRecall[] = results.map((r) => ({
      campaign_number: String(r.NHTSACampaignNumber ?? ""),
      component: String(r.Component ?? ""),
      summary: String(r.Summary ?? ""),
      consequence: String(r.Consequence ?? ""),
      remedy: String(r.Remedy ?? ""),
      report_date: String(r.ReportReceivedDate ?? ""),
      park_it: r.parkIt === true || r.parkIt === "true" || r.parkIt === 1,
      park_outside: r.parkOutSide === true || r.parkOutSide === "true" || r.parkOutSide === 1,
      over_the_air_update: r.overTheAirUpdate === true || r.overTheAirUpdate === "true" || r.overTheAirUpdate === 1,
    }));

    return {
      recall_count: recalls.length,
      park_it: recalls.some((r) => r.park_it),
      park_outside: recalls.some((r) => r.park_outside),
      recalls,
    };
  } catch {
    return null;
  }
}
