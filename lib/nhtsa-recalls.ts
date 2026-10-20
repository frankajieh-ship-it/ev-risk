/**
 * NHTSA Recall lookup by make/model/year.
 * Free, unlimited, authoritative — no API key required.
 * https://api.nhtsa.gov/recalls/recallsByVehicle
 *
 * This is a campaign count for the MODEL YEAR, not a per-VIN open/closed
 * check (D-011) — NHTSA has no public per-VIN recall-status API. Callers
 * must present this as "campaigns for this model year" and link the buyer
 * to NHTSA's own VIN-level checker, never as "no open recalls on this car".
 *
 * F-3 fix: a hand-maintained name map (the old NHTSA_MODEL_MAP) silently
 * returned 0 recalls for any model it didn't know how NHTSA spells
 * (Mach-E, Ariya, bare "Bolt", "Niro"), which reads to a buyer as a clean
 * bill of health. Model names are now resolved against NHTSA's own model
 * list for that make/year; an unresolved name returns null (unavailable),
 * never a trusted 0.
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
  /** The model string actually sent to NHTSA, for debugging/audit. Optional
   *  so older call sites constructing a RecallResult-shaped value (e.g. from
   *  a cached API response) don't need to synthesize it. */
  resolved_model?: string;
}

// In-memory cache of NHTSA's model list per make/year — avoids one extra
// fetch per lookup for repeat makes within the same process lifetime.
const _modelListCache = new Map<string, string[]>();

/** Test-only: clears the module-level model-list cache so tests don't leak state across runs. */
export function _clearModelListCacheForTests(): void {
  _modelListCache.clear();
}

async function fetchNhtsaModelList(make: string, year: number): Promise<string[] | null> {
  const key = `${make.toLowerCase()}|${year}`;
  const cached = _modelListCache.get(key);
  if (cached) return cached;

  try {
    const url = `https://api.nhtsa.gov/products/vehicle/models?modelYear=${year}&make=${encodeURIComponent(make)}&issueType=r`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const results: Array<{ model?: string }> = data?.results ?? [];
    const models = results.map((r) => r.model ?? "").filter(Boolean);
    if (models.length === 0) return null;
    _modelListCache.set(key, models);
    return models;
  } catch {
    return null;
  }
}

/**
 * Resolve our model string to the exact spelling NHTSA's recall API expects,
 * by matching against NHTSA's own model list for that make/year. Returns null
 * when nothing matches — callers must treat that as "unavailable", not "0".
 *
 * Every caller in this product is asking about an EV, so when our model
 * string is ambiguous against NHTSA's list (e.g. "Niro" matches both the gas
 * "NIRO" and "NIRO EV"), the EV-suffixed variant wins over a bare/shorter
 * match. This only matters when our string itself doesn't already say EV.
 */
async function resolveNhtsaModel(make: string, model: string, year: number): Promise<string | null> {
  const models = await fetchNhtsaModelList(make, year);
  if (!models) return null;

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = norm(model);
  const targetSaysEv = target.endsWith("ev");

  // Exact normalized match — but only decisive when our own string already
  // disambiguates (says "EV") or NHTSA's list has no competing EV variant of
  // the same nameplate. A bare "Niro" exactly matches NHTSA's gas "NIRO" too,
  // and every lookup in this product concerns an EV trim, so an unqualified
  // exact match yields to a same-nameplate EV variant if one exists.
  const exact = models.find((m) => norm(m) === target);
  if (exact && (targetSaysEv || !models.some((m) => m !== exact && norm(m).startsWith(target) && norm(m).endsWith("ev")))) {
    return exact;
  }

  // Then substring matches either direction (handles "Bolt" vs "Bolt EV",
  // "Ariya Hatchback" vs "Ariya", "Niro" vs "Niro EV"/"Niro Plug-In Hybrid").
  // Prefer the shortest EV-suffixed candidate over a shorter non-EV one,
  // since every lookup in this product concerns an EV trim.
  const candidates = models.filter((m) => {
    const nm = norm(m);
    return nm.includes(target) || target.includes(nm);
  });
  if (candidates.length === 0) return exact ?? null;
  if (candidates.length === 1) return candidates[0];

  const evCandidates = candidates.filter((m) => norm(m).endsWith("ev"));
  const pool = evCandidates.length > 0 ? evCandidates : candidates;
  return pool.sort((a, b) => a.length - b.length)[0];
}

export async function getNhtsaRecalls(
  make: string,
  model: string,
  year: number
): Promise<RecallResult | null> {
  try {
    const listModel = await resolveNhtsaModel(make, model, year);
    if (!listModel) return null; // unresolved name — unavailable, never a trusted 0

    // The vehicle/models list and recallsByVehicle disagree on punctuation
    // (model list: "MUSTANG MACH-E"; recallsByVehicle only matches
    // "MUSTANG MACH E" — confirmed live, 0 vs 13 results). Hyphens become
    // spaces for the actual recall search; the model-list spelling is kept
    // in `resolved_model` for audit/debugging.
    const nhtsaModel = listModel.replace(/-/g, " ");

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
      resolved_model: listModel,
    };
  } catch {
    return null;
  }
}
