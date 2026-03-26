/**
 * Dealer Inventory Match Utility
 *
 * Given a dealership ID, cross-references active inventory against
 * the set of vehicle make/models being researched in the same metro
 * over the last 30 days (from user_events).
 */

import { getSupabaseAdmin } from "@/lib/api-auth";

export interface MatchResult {
  make: string;
  model: string;
  research_count: number;
  inventory_count: number;
  inventory_ids: string[];
}

/**
 * Returns vehicles in dealer_inventory that match models currently being
 * researched (from user_events last 30d, filtered by dealer metro).
 */
export async function getInventoryMatches(
  dealershipId: string,
  metro: string | null
): Promise<MatchResult[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch active inventory for this dealership
  const { data: inventory } = await supabase
    .from("dealer_inventory")
    .select("id, make, model")
    .eq("dealership_id", dealershipId)
    .eq("status", "active");

  if (!inventory?.length) return [];

  // Fetch researched make/models in this metro
  let eventsQuery = supabase
    .from("user_events")
    .select("event_data")
    .in("event_name", ["routine_result_viewed", "report_view", "receipt_generate"])
    .gte("timestamp", since);

  if (metro) {
    eventsQuery = eventsQuery.eq("geo_metro", metro);
  }

  const { data: events } = await eventsQuery;

  // Count research hits per make+model from event_data
  const researchCounts = new Map<string, number>();
  for (const ev of events || []) {
    const make = (ev.event_data?.make || ev.event_data?.vehicle?.make || "").toLowerCase().trim();
    const model = (ev.event_data?.model || ev.event_data?.vehicle?.model || "").toLowerCase().trim();
    if (!make || !model) continue;
    const key = `${make}|${model}`;
    researchCounts.set(key, (researchCounts.get(key) || 0) + 1);
  }

  // Match inventory items to research counts (substring match on model)
  const matchMap = new Map<string, MatchResult>();
  for (const item of inventory) {
    const invMake = item.make.toLowerCase().trim();
    const invModel = item.model.toLowerCase().trim();

    let bestCount = 0;
    for (const [key, count] of researchCounts) {
      const [rMake, rModel] = key.split("|");
      if (rMake === invMake && invModel.includes(rModel)) {
        bestCount = Math.max(bestCount, count);
      }
    }

    const mapKey = `${invMake}|${invModel}`;
    if (!matchMap.has(mapKey)) {
      matchMap.set(mapKey, {
        make: item.make,
        model: item.model,
        research_count: bestCount,
        inventory_count: 0,
        inventory_ids: [],
      });
    }
    const entry = matchMap.get(mapKey)!;
    entry.inventory_count++;
    entry.inventory_ids.push(item.id);
    entry.research_count = Math.max(entry.research_count, bestCount);
  }

  return Array.from(matchMap.values()).sort(
    (a, b) => b.research_count - a.research_count
  );
}
