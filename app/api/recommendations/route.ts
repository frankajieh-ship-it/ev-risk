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
import { getWeatherClient, inferWeatherFallback } from "@/lib/weather-client";
import { trackServerEvent } from "@/lib/track-server-event";
import { getChargerClient } from "@/lib/charger-client";
import type { VehicleRecommendation, DealerListingMatch, DataSources } from "@/types/recommendations";
import { computeOwnershipCost } from "@/lib/ownership-cost";
import type { WeatherData } from "@/types/routine-v2";

const recLimiter = new RateLimiter(
  60 * 60 * 1000, // 1 hour window
  process.env.NODE_ENV === "development" ? 100 : 10
);

/**
 * Randomize vehicle order within each fit score tier.
 * Prevents brand bias when multiple vehicles have identical scores.
 *
 * Uses Fisher-Yates shuffle for unbiased randomization within each score group.
 *
 * @example
 * Input:  [Tesla 85, Hyundai 85, Ford 85, Nissan 80, Kia 80]
 * Output: [Ford 85, Hyundai 85, Tesla 85, Kia 80, Nissan 80] (randomized within tiers)
 */
function randomizeWithinScoreTiers(vehicles: VehicleRecommendation[]): VehicleRecommendation[] {
  if (vehicles.length <= 1) return vehicles;

  // Group by fit_score
  const scoreGroups = new Map<number, VehicleRecommendation[]>();

  for (const vehicle of vehicles) {
    const score = vehicle.fit_score;
    if (!scoreGroups.has(score)) {
      scoreGroups.set(score, []);
    }
    scoreGroups.get(score)!.push(vehicle);
  }

  // Randomize within each group using Fisher-Yates shuffle
  for (const [score, group] of scoreGroups.entries()) {
    if (group.length > 1) {
      for (let i = group.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [group[i], group[j]] = [group[j], group[i]];
      }
    }
  }

  // Recombine in descending score order
  const sortedScores = Array.from(scoreGroups.keys()).sort((a, b) => b - a);
  const result: VehicleRecommendation[] = [];

  for (const score of sortedScores) {
    result.push(...scoreGroups.get(score)!);
  }

  return result;
}

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);

  // Body size cap — routine profile fields only, no large payloads expected
  const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
  if (contentLength > 20_000) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  try {
    const body = await request.json();

    // Bot protection
    const blocked = await guardTurnstile(body, clientIP, "/api/recommendations");
    if (blocked) return blocked;

    // Rate limit
    const burst = await recLimiter.checkAsync(clientIP);
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

    // Extract ZIP code from routine (user provided it during climate selection)
    const zipCode = body.zip_code as string | undefined;

    // ============================
    // 1. Fetch weather data
    // ============================
    let weatherData: WeatherData | undefined;
    let weatherLive = false;
    let locationName: string | undefined;

    if (zipCode) {
      const weatherClient = getWeatherClient();
      if (weatherClient) {
        const result = await weatherClient.getWeatherByZip(zipCode, "US");
        if (result.success) {
          weatherData = result.data;
          weatherLive = true;
          locationName = result.data?.location_used;
        }
      }
    }
    // Fallback to inference if API failed or no ZIP
    if (!weatherData) {
      weatherData = inferWeatherFallback(routine.climate, zipCode);
    }

    // ============================
    // 2. Search nearby chargers (public charging only)
    // ============================
    let chargerCount = 0;
    let chargersLive = false;

    if (routine.charging_access === "public" && zipCode) {
      const chargerClient = getChargerClient();
      if (chargerClient) {
        try {
          const chargers = await chargerClient.searchByZip(zipCode, {
            radius_miles: 10,
            connector_types: ["J1772", "CCS", "CHAdeMO", "NACS"],
          });
          if (chargers.success && chargers.data) {
            chargerCount = chargers.data.length;
            chargersLive = true;
          }
        } catch (err) {
          console.warn("[recommendations] Charger search failed:", err);
          // Gracefully degrade
        }
      }
    }

    // ============================
    // 3. Score all vehicles (with V2 scoring if real-time data available)
    // ============================
    const rangeData = loadRangeDeltaData();
    const scored = batchScoreVehicles(
      routine,
      rangeData,
      weatherData || chargerCount > 0
        ? { weather: weatherData, chargerCount }
        : undefined
    );

    // 4. Query dealer inventory (optional — gracefully degrades)
    const dealerMap = await fetchDealerInventoryMatches(scored);

    // 5. Merge dealer listings + ownership cost into recommendations
    const withDealers: VehicleRecommendation[] = scored.map((v) => ({
      ...v,
      dealer_listings: dealerMap.get(normalizeModelKey(v.make, v.model_short)) ?? [],
      ownership_cost_5y: computeOwnershipCost(v, routine),
    }));

    // 6. Randomize within score tiers to avoid brand bias
    const recommendations = randomizeWithinScoreTiers(withDealers);

    // 6b. Attach matching curated deals for top recommendations (fit_score >= 70)
    const supabaseForDeals = getSupabaseAdmin();
    if (supabaseForDeals) {
      const topMakes = [...new Set(
        recommendations.filter((r) => r.fit_score >= 70).map((r) => r.make)
      )];
      if (topMakes.length > 0) {
        const { data: dealRows } = await supabaseForDeals
          .from("curated_deals")
          .select("id, listing_url, vehicle_label, make, model, year, price, mileage, verdict, risk_flags, deal_quality_score, receipt_id, photo_url, url_domain, last_analyzed_at")
          .in("make", topMakes)
          .eq("is_active", true)
          .neq("verdict", "RED")
          .order("deal_quality_score", { ascending: false })
          .limit(topMakes.length * 3);

        if (dealRows && dealRows.length > 0) {
          const dealsByMake = new Map<string, typeof dealRows>();
          for (const deal of dealRows) {
            const m = (deal.make ?? "").toLowerCase();
            if (!dealsByMake.has(m)) dealsByMake.set(m, []);
            dealsByMake.get(m)!.push(deal);
          }
          for (const rec of recommendations) {
            if (rec.fit_score >= 70) {
              rec.matched_deals = dealsByMake.get(rec.make.toLowerCase())?.slice(0, 2) ?? [];
            }
          }
        }
      }
    }

    // Emit evfit_completed — list-level completion event (server source of truth)
    const topScore = recommendations[0]?.fit_score ?? null;
    const tieClusterCount = topScore !== null
      ? recommendations.filter((r) => r.fit_score === topScore).length
      : 0;
    trackServerEvent({
      event_name: "evfit_completed",
      source: "evfit",
      anon_id: (body.anon_id as string | undefined) ?? null,
      session_id: (body.session_id as string | undefined) ?? null,
      page_path: "/api/recommendations",
      payload: {
        recommendations_count: recommendations.length,
        top_score: topScore,
        tie_cluster_count: tieClusterCount,
        weather_live: weatherLive,
        chargers_live: chargersLive,
      },
    });

    // 7. Build dealer questions (use no-vehicle ownership risk for generic questions)
    const ownershipRisk = computeOwnershipRisk();
    const dealerQuestions = buildDealerQuestionsV2(routine, ownershipRisk);

    // 8. Build routine summary
    const weeklyMiles = routine.weekly_miles
      ?? (routine.commute_miles_roundtrip ? routine.commute_miles_roundtrip * 5 : 100);

    // 9. Build data sources metadata
    const dataSources: DataSources = {
      weather_live: weatherLive,
      chargers_live: chargersLive,
      weather_temp_f: weatherData?.current_temp_f,
      weather_condition: weatherData?.current_conditions,
      charger_count: chargerCount,
      location_name: locationName,
    };

    return NextResponse.json({
      success: true,
      recommendations,
      dealer_questions: dealerQuestions,
      routine_summary: {
        charging_access: routine.charging_access,
        weekly_miles: weeklyMiles,
        climate: routine.climate,
      },
      data_sources: dataSources,
      user_zip_code: zipCode ?? null,
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
