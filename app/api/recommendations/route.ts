/**
 * Vehicle Recommendations API
 *
 * POST /api/recommendations
 * Scores all EVs in the catalog against the user's routine and returns
 * ranked recommendations with optional dealer inventory matches.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateMVR, type MinimumViableRoutine } from "@/types/v2";
import { loadRangeDeltaData } from "@/lib/data";
import { batchScoreVehicles } from "@/lib/batch-score-vehicles";
import { buildDealerQuestionsV2 } from "@/lib/dealer-questions";
import { computeOwnershipRisk } from "@/lib/compute-ownership-risk";
import { guardTurnstile } from "@/lib/turnstile";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";
import { getSupabaseAdmin } from "@/lib/api-auth";
import type { VehicleRecommendation, DealerListingMatch } from "@/types/recommendations";

const recLimiter = new RateLimiter(
  60 * 60 * 1000, // 1 hour window
  process.env.NODE_ENV === "development" ? 100 : 10
);

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);

  try {
    const body = await request.json();

    // Bot protection
    const blocked = await guardTurnstile(body, clientIP, "/api/recommendations");
    if (blocked) return blocked;

    // Rate limit
    const burst = recLimiter.check(clientIP);
    if (!burst.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    // Validate routine
    const routine = body.routine as MinimumViableRoutine;
    if (!routine) {
      return NextResponse.json({ error: "routine is required" }, { status: 400 });
    }

    const validation = validateMVR(routine);
    if (!validation.ok) {
      return NextResponse.json(
        { error: "invalid_routine", details: validation.errors },
        { status: 422 }
      );
    }

    // 1. Score all vehicles
    const rangeData = loadRangeDeltaData();
    const scored = batchScoreVehicles(routine, rangeData);

    // 2. Query dealer inventory (optional — gracefully degrades)
    const dealerMap = await fetchDealerInventoryMatches(scored);

    // 3. Merge dealer listings into recommendations
    const recommendations: VehicleRecommendation[] = scored.map((v) => ({
      ...v,
      dealer_listings: dealerMap.get(normalizeModelKey(v.make, v.model_short)) ?? [],
    }));

    // 4. Build dealer questions (use no-vehicle ownership risk for generic questions)
    const ownershipRisk = computeOwnershipRisk();
    const dealerQuestions = buildDealerQuestionsV2(routine, ownershipRisk);

    // 5. Build routine summary
    const weeklyMiles = routine.weekly_miles
      ?? (routine.commute_miles_roundtrip ? routine.commute_miles_roundtrip * 5 : 100);

    return NextResponse.json({
      success: true,
      recommendations,
      dealer_questions: dealerQuestions,
      routine_summary: {
        charging_access: routine.charging_access,
        weekly_miles: weeklyMiles,
        climate: routine.climate,
      },
    });
  } catch (error) {
    console.error("[recommendations] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}

// ============================================
// Dealer Inventory Matching
// ============================================

function normalizeModelKey(make: string, modelShort: string): string {
  return `${make.toLowerCase()}|${modelShort.toLowerCase().replace(/\s+/g, " ")}`;
}

/**
 * Query dealer inventory and group by make/model for matching.
 * Returns a Map of normalized model keys → dealer listing matches.
 */
async function fetchDealerInventoryMatches(
  vehicles: Omit<VehicleRecommendation, "dealer_listings">[]
): Promise<Map<string, DealerListingMatch[]>> {
  const result = new Map<string, DealerListingMatch[]>();

  const supabase = getSupabaseAdmin();
  if (!supabase) return result;

  try {
    // Get unique makes from scored vehicles
    const makes = [...new Set(vehicles.map(v => v.make))];

    const { data: rows, error } = await supabase
      .from("dealer_inventory")
      .select(`
        make, model, year, price_cents,
        dealerships!inner ( name, slug, city, state )
      `)
      .eq("status", "active")
      .in("make", makes);

    if (error || !rows?.length) return result;

    // Group by dealer + model
    const grouped = new Map<string, Map<string, {
      dealer_name: string;
      dealer_slug: string;
      dealer_city: string;
      dealer_state: string;
      prices: number[];
    }>>();

    for (const row of rows) {
      const dealership = row.dealerships as unknown as {
        name: string; slug: string; city: string; state: string;
      };

      // Try to match this inventory item to one of our scored vehicles
      const matchKey = findBestVehicleMatch(row.make, row.model, vehicles);
      if (!matchKey) continue;

      if (!grouped.has(matchKey)) grouped.set(matchKey, new Map());
      const dealerMap = grouped.get(matchKey)!;

      if (!dealerMap.has(dealership.slug)) {
        dealerMap.set(dealership.slug, {
          dealer_name: dealership.name,
          dealer_slug: dealership.slug,
          dealer_city: dealership.city ?? "",
          dealer_state: dealership.state ?? "",
          prices: [],
        });
      }

      if (row.price_cents) {
        dealerMap.get(dealership.slug)!.prices.push(row.price_cents);
      }
    }

    // Convert to DealerListingMatch[]
    for (const [modelKey, dealerMap] of grouped) {
      const listings: DealerListingMatch[] = [];
      for (const dealer of dealerMap.values()) {
        const match: DealerListingMatch = {
          dealer_name: dealer.dealer_name,
          dealer_slug: dealer.dealer_slug,
          dealer_city: dealer.dealer_city,
          dealer_state: dealer.dealer_state,
          listing_count: dealer.prices.length || 1,
        };
        if (dealer.prices.length > 0) {
          match.price_range_cents = {
            min: Math.min(...dealer.prices),
            max: Math.max(...dealer.prices),
          };
        }
        listings.push(match);
      }
      result.set(modelKey, listings);
    }
  } catch (err) {
    console.error("[recommendations] Dealer inventory query failed:", err);
    // Gracefully degrade — return empty matches
  }

  return result;
}

/**
 * Fuzzy match a dealer inventory row to one of our scored vehicles.
 * Returns the normalized model key if matched, null otherwise.
 */
function findBestVehicleMatch(
  invMake: string,
  invModel: string,
  vehicles: Omit<VehicleRecommendation, "dealer_listings">[]
): string | null {
  const make = invMake.toLowerCase().trim();
  const model = invModel.toLowerCase().trim();

  for (const v of vehicles) {
    if (v.make.toLowerCase() !== make) continue;
    const vModel = v.model_short.toLowerCase();
    // Check if inventory model contains (or is contained by) the vehicle model short name
    // e.g. inventory "Model 3" matches vehicle "Model 3 Long Range"
    if (vModel.includes(model) || model.includes(vModel)) {
      return normalizeModelKey(v.make, v.model_short);
    }
  }
  return null;
}
