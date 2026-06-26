/**
 * NHTSA Recall Client
 *
 * Fetches live recall data from NHTSA's public API (no key required).
 * Used to ground recall claims in the receipt prompt — prevents the AI
 * from inventing or misquoting recall details from training memory.
 *
 * API: https://api.nhtsa.gov/recalls/recallsByVehicle?make=X&model=Y&modelYear=Z
 */

export interface NhtsaRecall {
  NHTSACampaignNumber: string;
  Component: string;
  Summary: string;
  Consequence: string;
  Remedy: string;
  ReportReceivedDate: string;
}

export interface RecallLookupResult {
  found: boolean;
  count: number;
  safety_critical: NhtsaRecall[];
  other: NhtsaRecall[];
  prompt_block: string;
  source: "nhtsa_live" | "nhtsa_unavailable";
}

const SAFETY_KEYWORDS = ["BATTERY", "FIRE", "FUEL", "STEERING", "BRAKE", "LOSS OF CONTROL", "ROLLAWAY", "IGNITION", "AIRBAG", "SEAT BELT"];

function isSafetyCritical(recall: NhtsaRecall): boolean {
  const component = recall.Component?.toUpperCase() ?? "";
  const summary = recall.Summary?.toUpperCase() ?? "";
  return SAFETY_KEYWORDS.some((kw) => component.includes(kw) || summary.includes(kw));
}

function formatRecall(r: NhtsaRecall): string {
  const date = r.ReportReceivedDate ? r.ReportReceivedDate.split("T")[0] : "unknown date";
  return `- Campaign ${r.NHTSACampaignNumber} (${date}): ${r.Component} — ${r.Summary.slice(0, 200)}${r.Summary.length > 200 ? "..." : ""} | Remedy: ${r.Remedy.slice(0, 150)}${r.Remedy.length > 150 ? "..." : ""}`;
}

function buildPromptBlock(year: number, make: string, model: string, result: RecallLookupResult): string {
  const lines: string[] = [
    `NHTSA RECALL DATA (live, verified — use ONLY this data for recall claims):`,
    `Source: api.nhtsa.gov | Vehicle: ${year} ${make} ${model}`,
  ];

  if (result.source === "nhtsa_unavailable") {
    lines.push("Status: NHTSA lookup unavailable — do NOT make specific recall claims.");
    lines.push("INSTRUCTION: Tell the user to check recalls.nhtsa.dot.gov with their VIN.");
    return lines.join("\n");
  }

  if (result.count === 0) {
    lines.push(`Status: No open recalls found for this vehicle on NHTSA.`);
    lines.push("INSTRUCTION: You may state no open recalls were found. Do not add caveats about recalls that aren't listed here.");
    return lines.join("\n");
  }

  lines.push(`Total recalls found: ${result.count}`);

  if (result.safety_critical.length > 0) {
    lines.push(`\nSAFETY-CRITICAL RECALLS (${result.safety_critical.length}):`);
    result.safety_critical.forEach((r) => lines.push(formatRecall(r)));
  }

  if (result.other.length > 0) {
    lines.push(`\nOTHER RECALLS (${result.other.length}):`);
    result.other.slice(0, 5).forEach((r) => lines.push(formatRecall(r)));
    if (result.other.length > 5) lines.push(`  ... and ${result.other.length - 5} more`);
  }

  lines.push("\nINSTRUCTION: State only the recall facts listed above. Do not add, infer, or expand on recall details beyond what is listed here. If a recall is listed, flag it and recommend the buyer verify remedy completion with the dealer using the campaign number.");
  return lines.join("\n");
}

// In-memory cache: key = "year|make|model", value = { result, expiresAt }
const _cache = new Map<string, { result: RecallLookupResult; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function fetchNhtsaRecalls(
  year: number,
  make: string,
  model: string
): Promise<RecallLookupResult> {
  const cacheKey = `${year}|${make.toLowerCase()}|${model.toLowerCase()}`;
  const cached = _cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`NHTSA returned ${res.status}`);

    const json = await res.json() as { Count: number; results: NhtsaRecall[] };
    const recalls: NhtsaRecall[] = json.results ?? [];

    const safety_critical = recalls.filter(isSafetyCritical);
    const other = recalls.filter((r) => !isSafetyCritical(r));

    const result: RecallLookupResult = {
      found: recalls.length > 0,
      count: recalls.length,
      safety_critical,
      other,
      prompt_block: "",
      source: "nhtsa_live",
    };
    result.prompt_block = buildPromptBlock(year, make, model, result);

    _cache.set(cacheKey, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch {
    clearTimeout(timeout);
    const result: RecallLookupResult = {
      found: false,
      count: 0,
      safety_critical: [],
      other: [],
      source: "nhtsa_unavailable",
      prompt_block: "",
    };
    result.prompt_block = buildPromptBlock(year, make, model, result);
    return result;
  }
}
