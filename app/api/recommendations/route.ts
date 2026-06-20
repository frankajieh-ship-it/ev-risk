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

  // Group by 3-point band (floor to nearest 3) so vehicles within ±2 points
  // of each other are shuffled together. Prevents the same cluster (e.g. Ioniq 5
  // at 83, EV6 at 82) from always appearing in the same order even when other
  // vehicles are statistically tied with them.
  const scoreGroups = new Map<number, VehicleRecommendation[]>();

  for (const vehicle of vehicles) {
    const band = Math.floor(vehicle.fit_score / 3) * 3;
    if (!scoreGroups.has(band)) {
      scoreGroups.set(band, []);
    }
    scoreGroups.get(band)!.push(vehicle);
  }

  // Fisher-Yates shuffle within each band
  for (const group of scoreGroups.values()) {
    if (group.length > 1) {
      for (let i = group.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [group[i], group[j]] = [group[j], group[i]];
      }
    }
  }

  // Recombine in descending band order
  const sortedBands = Array.from(scoreGroups.keys()).sort((a, b) => b - a);
  const result: VehicleRecommendation[] = [];

  for (const band of sortedBands) {
    result.push(...scoreGroups.get(band)!);
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
    // 3. Score only deal-backed vehicles
    // ============================
    const supabase = getSupabaseAdmin();
    const csvData = loadRangeDeltaData();

    // Fetch active curated deals — these become the scoring universe
    const activeDeals = supabase ? await fetchActiveCuratedDeals(supabase) : [];

    let scored: Awaited<ReturnType<typeof batchScoreVehicles>>;
    let dealsByKey: Map<string, typeof activeDeals>;

    if (activeDeals.length > 0) {
      // Build synthetic RangeDeltaRows from deals, enriched with CSV specs
      const { rangeRows, dealsByKey: dbk } = buildRangeRowsFromDeals(activeDeals, csvData);
      dealsByKey = dbk;
      scored = batchScoreVehicles(
        routine,
        rangeRows,
        weatherData || chargerCount > 0
          ? { weather: weatherData, chargerCount }
          : undefined
      );
      // Wire matched deals back to each scored recommendation
      attachDealsToRecommendations(scored, dealsByKey);
      // Phase 2a: Prune matched_deals by max mileage before the deal-count filter below
      if (routine.max_mileage && routine.max_mileage > 0) {
        for (const v of scored) {
          if (v.matched_deals) {
            v.matched_deals = v.matched_deals.filter(
              (d) => !d.mileage || d.mileage <= routine.max_mileage!
            );
          }
        }
      }
      // Keep only vehicles that have at least one matched deal
      scored = scored.filter((v) => v.matched_deals && v.matched_deals.length > 0);
    } else {
      // No deals in DB — fall back to full CSV catalog (graceful degradation)
      dealsByKey = new Map();
      scored = batchScoreVehicles(
        routine,
        csvData,
        weatherData || chargerCount > 0
          ? { weather: weatherData, chargerCount }
          : undefined
      );
    }

    // 3b. Apply Phase 1 preference hard filters (post-scoring exclusions)
    let filteredScored = scored;
    if (routine.min_seating && routine.min_seating > 2) {
      filteredScored = filteredScored.filter((v) => (v.seating_capacity ?? 5) >= routine.min_seating!);
    }
    if (routine.preferred_body_type && routine.preferred_body_type !== "any") {
      filteredScored = filteredScored.filter((v) => v.body_type === routine.preferred_body_type);
    }
    if (routine.require_heat_pump) {
      filteredScored = filteredScored.filter((v) => v.has_heat_pump === true);
    }
    if (routine.require_awd) {
      // sub_category gives us body style; use tow_capacity_lbs / model name as AWD proxy
      // Fall back to unfiltered if no AWD-capable vehicles survive (prevent empty results)
      const awdFiltered = filteredScored.filter((v) => {
        const model = v.model.toLowerCase();
        return model.includes("awd") || model.includes("4wd") || model.includes("all-wheel") ||
          (v.sub_category === "truck") || model.includes("quattro") || model.includes("xdrive") ||
          model.includes("e-tron") || model.includes("r1t") || model.includes("r1s") ||
          model.includes("rivian") || model.includes("cybertruck");
      });
      if (awdFiltered.length > 0) filteredScored = awdFiltered;
    }
    // Replace scored with filtered for downstream steps
    scored = filteredScored;

    // 3c. Apply Phase 2a preference hard filters
    // Budget max — vehicles with no MSRP data (msrp_usd=0/undefined) pass through
    if (routine.budget_max_usd && routine.budget_max_usd > 0) {
      const budgetFiltered = scored.filter(
        (v) => !v.msrp_usd || v.msrp_usd <= routine.budget_max_usd!
      );
      if (budgetFiltered.length > 0) scored = budgetFiltered;
    }
    // Explicit drivetrain filter (runs after require_awd for backward compat)
    // TODO(2b): replace pattern match with build.drivetrain from VIN decode
    if (routine.preferred_drivetrain && routine.preferred_drivetrain !== "any") {
      const dtFiltered = scored.filter((v) => {
        const m = v.model.toLowerCase();
        if (routine.preferred_drivetrain === "awd") {
          return m.includes("awd") || m.includes("4wd") || m.includes("all-wheel") ||
            m.includes("quattro") || m.includes("xdrive") || m.includes("e-tron") ||
            m.includes("rivian") || m.includes("cybertruck") || v.sub_category === "truck";
        }
        if (routine.preferred_drivetrain === "rwd") {
          return m.includes("rwd") ||
            (m.includes("model 3") && !m.includes("awd")) ||
            (m.includes("model s") && !m.includes("awd")) ||
            (m.includes("polestar") && !m.includes("awd"));
        }
        if (routine.preferred_drivetrain === "fwd") {
          return m.includes("fwd") || m.includes("front-wheel");
        }
        return true;
      });
      if (dtFiltered.length > 0) scored = dtFiltered;
    }

    // Phase 2 DB-backed spec filters
    if (routine.preferred_drivetrain_explicit && routine.preferred_drivetrain_explicit !== "any") {
      const dtExact = scored.filter((v) => v.drivetrain === routine.preferred_drivetrain_explicit);
      if (dtExact.length > 0) scored = dtExact;
    }
    if (routine.max_cargo_size) {
      const cargoFiltered = scored.filter((v) => {
        const c = v.cargo_volume_cuft ?? 20;
        if (routine.max_cargo_size === "compact") return c < 15;
        if (routine.max_cargo_size === "mid")     return c >= 15 && c <= 25;
        if (routine.max_cargo_size === "large")   return c > 25;
        return true;
      });
      if (cargoFiltered.length > 0) scored = cargoFiltered;
    }
    if (routine.max_charge_time_l2 && routine.max_charge_time_l2 > 0) {
      const chargeFiltered = scored.filter(
        (v) => !v.charge_time_l2_hours || v.charge_time_l2_hours <= routine.max_charge_time_l2!
      );
      if (chargeFiltered.length > 0) scored = chargeFiltered;
    }
    if (routine.require_carplay) {
      const cpFiltered = scored.filter((v) => v.has_carplay === true);
      if (cpFiltered.length > 0) scored = cpFiltered;
    }
    if (routine.require_android_auto) {
      const aaFiltered = scored.filter((v) => v.has_android_auto === true);
      if (aaFiltered.length > 0) scored = aaFiltered;
    }
    if (routine.require_keyless_entry) {
      const keFiltered = scored.filter((v) => v.has_keyless_entry !== false);
      if (keFiltered.length > 0) scored = keFiltered;
    }
    if (routine.require_satellite_radio) {
      const srFiltered = scored.filter((v) => v.has_satellite_radio === true);
      if (srFiltered.length > 0) scored = srFiltered;
    }

    // Phase 2b: safety/comfort boolean require-flags (loop to avoid repetition)
    const boolRequireFilters: Array<[keyof typeof routine, keyof (typeof scored)[0]]> = [
      ["require_ac",               "has_ac"],
      ["require_power_windows",    "has_power_windows"],
      ["require_power_locks",      "has_power_locks"],
      ["require_power_steering",   "has_power_steering"],
      ["require_tilt_wheel",       "has_tilt_wheel"],
      ["require_am_fm_radio",      "has_am_fm_radio"],
      ["require_immobilizer",      "has_immobilizer"],
      ["require_alarm",            "has_alarm"],
      ["require_dual_airbags",     "has_dual_airbags"],
      ["require_side_airbags",     "has_side_airbags"],
      ["require_abs",              "has_abs"],
      ["require_active_seatbelts", "has_active_seatbelts"],
      ["require_passenger_airbag", "has_passenger_airbag"],
    ];
    for (const [rk, vk] of boolRequireFilters) {
      if (routine[rk]) {
        const f = scored.filter((v) => (v as Record<string, unknown>)[vk] !== false);
        if (f.length > 0) scored = f;
      }
    }

    // Color filters (partial match against exterior_colors[]/interior_colors[] arrays)
    if (routine.preferred_exterior_color) {
      const c = routine.preferred_exterior_color.toLowerCase();
      const f = scored.filter((v) => v.exterior_colors?.some((ec) => ec.toLowerCase().includes(c)));
      if (f.length > 0) scored = f;
    }
    if (routine.preferred_interior_color) {
      const c = routine.preferred_interior_color.toLowerCase();
      const f = scored.filter((v) => v.interior_colors?.some((ic) => ic.toLowerCase().includes(c)));
      if (f.length > 0) scored = f;
    }

    // Doors filter
    if (routine.preferred_doors) {
      const f = scored.filter((v) => !v.doors || v.doors === routine.preferred_doors);
      if (f.length > 0) scored = f;
    }

    // Legroom filters
    if (routine.min_front_legroom_in) {
      const f = scored.filter((v) => !v.front_legroom_in || v.front_legroom_in >= routine.min_front_legroom_in!);
      if (f.length > 0) scored = f;
    }
    if (routine.min_rear_legroom_in) {
      const f = scored.filter((v) => !v.rear_legroom_in || v.rear_legroom_in >= routine.min_rear_legroom_in!);
      if (f.length > 0) scored = f;
    }

    // 4. Query dealer inventory (gracefully degrades)
    const [dealerMap] = await Promise.all([
      fetchDealerInventoryMatches(scored),
    ]);
    const liveListingsMap = new Map();

    // 5. Merge dealer listings + ownership cost + fit_reason + live listings into recommendations
    const weeklyMilesForReason = routine.weekly_miles
      ?? (routine.commute_miles_roundtrip ? routine.commute_miles_roundtrip * 5 : 100);
    const withDealers: VehicleRecommendation[] = scored.map((v) => ({
      ...v,
      dealer_listings: dealerMap.get(normalizeModelKey(v.make, v.model_short)) ?? [],
      ownership_cost_5y: computeOwnershipCost(v, routine),
      fit_reason: buildFitReason(v, routine, weeklyMilesForReason),
    }));

    // 6. Randomize within score tiers to avoid brand bias
    const recommendations = randomizeWithinScoreTiers(withDealers);

    // Emit evfit_completed — list-level completion event (server source of truth)
    const topScore = recommendations[0]?.fit_score ?? null;
    const tieClusterCount = topScore !== null
      ? recommendations.filter((r) => r.fit_score === topScore).length
      : 0;
    const topVehicles = recommendations.slice(0, 3).map((r) => ({
      make: r.make,
      model: r.model_short,
      year: r.year,
      fit_score: r.fit_score,
      fit_label: r.fit_label,
    }));
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
        top_vehicles: topVehicles,
        charging_access: routine.charging_access,
        climate: routine.climate,
        weekly_miles: routine.weekly_miles ?? null,
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
// Curated Deal Sourcing Helpers
// ============================================

type CuratedDealRow = {
  id: string;
  listing_url: string;
  vehicle_label: string;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number | null;
  mileage: number | null;
  receipt_id: string | null;
  photo_url: string | null;
  url_domain: string | null;
};

/** Conservative defaults used when a deal has no matching CSV spec row. */
const DEAL_SPEC_DEFAULTS = {
  epa_range_mi: 220,
  real_world_range_mi: 195,
  delta_percent: 0.11,
  chemistry: "NMC",
  battery_kwh: 75,
  dc_fast_kw: 80,
  msrp_usd: 0,
  incentive_new: false,
} as const;

/**
 * Fetch all active curated deals that have a receipt_id (fully analyzed).
 */
async function fetchActiveCuratedDeals(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>
): Promise<CuratedDealRow[]> {
  const { data, error } = await supabase
    .from("curated_deals")
    .select("id, listing_url, vehicle_label, make, model, year, price, mileage, receipt_id, photo_url, url_domain")
    .eq("is_active", true)
    .order("price", { ascending: true, nullsFirst: false });

  if (error || !data) {
    console.warn("[recommendations] fetchActiveCuratedDeals failed:", error?.message);
    return [];
  }
  return data as CuratedDealRow[];
}

/**
 * Build RangeDeltaRow[] from curated deals, enriching each with CSV specs via make+model match.
 * Returns one RangeDeltaRow per unique make+model+year, plus a map of that key → all deals.
 */
function buildRangeRowsFromDeals(
  deals: CuratedDealRow[],
  csvData: import("@/lib/data").RangeDeltaRow[]
): {
  rangeRows: import("@/lib/data").RangeDeltaRow[];
  dealsByKey: Map<string, CuratedDealRow[]>;
} {
  const dealsByKey = new Map<string, CuratedDealRow[]>();

  // Group deals by normalized make|model|year key
  for (const deal of deals) {
    if (!deal.make || !deal.model) continue;
    const key = `${deal.make.toLowerCase()}|${deal.model.toLowerCase().replace(/\s+/g, " ")}|${deal.year ?? 0}`;
    if (!dealsByKey.has(key)) dealsByKey.set(key, []);
    dealsByKey.get(key)!.push(deal);
  }

  const rangeRows: import("@/lib/data").RangeDeltaRow[] = [];

  for (const [, groupDeals] of dealsByKey) {
    const representative = groupDeals[0];
    const make = representative.make!;
    const model = representative.model!;
    const year = representative.year ?? new Date().getFullYear();

    // Try to find a CSV row for this make+model+year
    const csvRow = findCsvMatch(make, model, year, csvData);

    if (csvRow) {
      // Use real specs, override the model name to match the deal listing
      rangeRows.push({
        ...csvRow,
        model: `${make} ${model}`,
        year,
      });
    } else {
      // Conservative defaults — won't inflate scores
      rangeRows.push({
        model: `${make} ${model}`,
        year,
        ...DEAL_SPEC_DEFAULTS,
      });
    }
  }

  return { rangeRows, dealsByKey };
}

/**
 * Find the best-matching CSV row for a given make+model+year.
 * Tries exact year match first, then falls back to any year (closest year wins).
 */
function findCsvMatch(
  make: string,
  model: string,
  year: number,
  csvData: import("@/lib/data").RangeDeltaRow[]
): import("@/lib/data").RangeDeltaRow | null {
  const makeLower = make.toLowerCase().trim();
  const modelLower = model.toLowerCase().trim();

  // Candidates: rows where model string contains the make and the model fragment
  const candidates = csvData.filter((row) => {
    const rowModel = row.model.toLowerCase();
    return rowModel.includes(makeLower) && (
      rowModel.includes(modelLower) || modelLower.includes(
        // Extract model portion after make (e.g. "model 3" from "tesla model 3 long range")
        rowModel.replace(makeLower, "").trim().split(" ").slice(0, 2).join(" ")
      )
    );
  });

  if (candidates.length === 0) return null;

  // Prefer exact year, then closest year
  const exact = candidates.find((r) => r.year === year);
  if (exact) return exact;

  return candidates.sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year))[0];
}

/**
 * Wire matched curated deals back to each scored recommendation.
 * Matches by normalized make|model key (ignores year for flexibility).
 */
function attachDealsToRecommendations(
  scored: Omit<VehicleRecommendation, "dealer_listings">[],
  dealsByKey: Map<string, CuratedDealRow[]>
): void {
  for (const rec of scored) {
    // Find deal groups whose key starts with make|model (year may differ)
    const makeLower = rec.make.toLowerCase();
    const modelShortLower = rec.model_short.toLowerCase();

    const matched: CuratedDealRow[] = [];
    for (const [key, deals] of dealsByKey) {
      const [keyMake, keyModel] = key.split("|");
      if (keyMake === makeLower && (keyModel.includes(modelShortLower) || modelShortLower.includes(keyModel))) {
        matched.push(...deals);
      }
    }

    if (matched.length > 0) {
      rec.matched_deals = matched.slice(0, 3).map((d) => ({
        id: d.id,
        listing_url: d.listing_url,
        vehicle_label: d.vehicle_label,
        make: d.make,
        model: d.model,
        year: d.year,
        price: d.price,
        mileage: d.mileage,
        receipt_id: d.receipt_id,
        photo_url: d.photo_url,
        url_domain: d.url_domain,
      }));
    }
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

// ============================================
// Fit Reason Builder
// ============================================

function buildFitReason(
  v: Omit<VehicleRecommendation, "dealer_listings">,
  routine: MinimumViableRoutine,
  weeklyMiles: number
): string {
  const dims = v.dimensions;
  if (!dims) return `Scores well across range, charging, and climate for your routine`;

  // Find the strongest dimension to lead with
  if (dims.range >= 80) {
    return `${v.real_world_range_mi}mi real-world range comfortably covers your ${weeklyMiles}mi weekly drive`;
  }
  if (dims.charging >= 80) {
    if (routine.charging_access === "home") return `Charges fully overnight on home L2 — zero charging stops needed`;
    return `Low charging burden for your ${routine.charging_access} setup`;
  }
  if (dims.climate >= 80 && v.has_heat_pump) {
    return `Heat pump handles cold winters without significant range loss`;
  }
  if (dims.budget !== undefined && dims.budget >= 80) {
    return `Fits within your budget with strong per-mile efficiency`;
  }
  if (routine.towing_needs === "heavy" && v.tow_capacity_lbs && v.tow_capacity_lbs >= 5000) {
    return `${(v.tow_capacity_lbs / 1000).toFixed(0)}k lb tow rating fits your towing needs`;
  }
  if (v.seating_capacity && v.seating_capacity >= 7) {
    return `${v.seating_capacity}-seat capacity fits your passengers with strong range`;
  }
  // Default: mention the two strongest dimensions
  const sorted = Object.entries(dims).sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));
  const top = sorted[0]?.[0];
  const labelMap: Record<string, string> = {
    range: "range buffer", charging: "charging setup", recovery: "recovery plan",
    climate: "climate resilience", budget: "budget fit", utility: "utility match",
  };
  return `Strong ${labelMap[top] ?? top} for your routine — a reliable everyday match`;
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
