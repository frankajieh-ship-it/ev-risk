import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { MinimumViableRoutine } from "@/types/v2";
import type { CuratedDealMatch, DealsMatchResponse, MarketCheckFallback } from "@/types/recommendations";
import { parseChargeTimeHours } from "@/lib/parse-charge-time";
import { computeRoutineFit } from "@/lib/compute-routine-fit";
import { searchByMakeModel } from "@/lib/marketcheck-client";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CARGO_MIN: Record<string, number> = { mid: 15, large: 25 };
const TOWING_MIN: Record<string, number> = { light: 2000, heavy: 5000 };

// Body type + drivetrain → EV candidates for MarketCheck fallback
function fallbackCandidates(routine: MinimumViableRoutine): Array<{ make: string; model: string }> {
  const body = routine.preferred_body_type;
  const dt = routine.preferred_drivetrain_explicit;
  const isAwd = dt === "awd";

  if (body === "truck") {
    return [
      { make: "Ford", model: "F-150 Lightning" },
      { make: "Chevrolet", model: "Silverado EV" },
      { make: "Rivian", model: "R1T" },
    ];
  }
  if (body === "hatchback") {
    return [
      { make: "Chevrolet", model: "Bolt EV" },
      { make: "Nissan", model: "LEAF" },
      { make: "Mini", model: "Cooper SE" },
    ];
  }
  if (body === "sedan") {
    return [
      { make: "Tesla", model: "Model 3" },
      { make: "Hyundai", model: "IONIQ 6" },
      { make: "BMW", model: "i4" },
    ];
  }
  // SUV / crossover / default
  if (isAwd) {
    return [
      { make: "Tesla", model: "Model Y" },
      { make: "Hyundai", model: "IONIQ 5" },
      { make: "Kia", model: "EV6" },
    ];
  }
  return [
    { make: "Tesla", model: "Model Y" },
    { make: "Hyundai", model: "IONIQ 5" },
    { make: "Chevrolet", model: "Equinox EV" },
  ];
}

interface DealRow {
  id: string;
  listing_url: string;
  vehicle_label: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  price: number | null;
  mileage: number | null;
  location: string | null;
  photo_url: string | null;
  receipt_id: string | null;
  url_domain: string | null;
  body_type: string | null;
  drivetrain: string | null;
  epa_range_mi: number | null;
  exterior_color: string | null;
  interior_color: string | null;
  additional_notes: string | null;
  charge_time_notes: string | null;
  cargo_volume_cuft: number | null;
  towing_capacity_lbs: number | null;
  front_legroom_in: number | null;
  rear_legroom_in: number | null;
  doors: number | null;
  deal_quality_score: number | null;
}

export async function POST(req: NextRequest): Promise<NextResponse<DealsMatchResponse | { success: false; error: string }>> {
  let routine: MinimumViableRoutine;
  try {
    const body = await req.json();
    routine = body.routine;
    if (!routine) throw new Error("missing routine");
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const filtersApplied: string[] = [];

  const SELECT_COLUMNS =
    "id, listing_url, vehicle_label, year, make, model, trim, price, mileage, location, " +
    "photo_url, receipt_id, url_domain, body_type, drivetrain, epa_range_mi, " +
    "exterior_color, interior_color, additional_notes, charge_time_notes, " +
    "cargo_volume_cuft, towing_capacity_lbs, front_legroom_in, rear_legroom_in, " +
    "doors, deal_quality_score";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("curated_deals")
    .select(SELECT_COLUMNS)
    .eq("is_active", true);

  const drivetrain = routine.preferred_drivetrain_explicit;
  if (drivetrain && drivetrain !== "any") {
    query = query.ilike("drivetrain", drivetrain);
    filtersApplied.push(drivetrain.toUpperCase());
  }

  const budget = routine.budget_max_usd;
  if (budget) {
    query = query.lte("price", budget);
    filtersApplied.push(`Under $${(budget / 1000).toFixed(0)}k`);
  }

  const bodyType = routine.preferred_body_type;
  if (bodyType && bodyType !== "any") {
    query = query.ilike("body_type", `%${bodyType}%`);
    filtersApplied.push(bodyType.charAt(0).toUpperCase() + bodyType.slice(1));
  }

  const doorsFilter = routine.preferred_doors;
  if (doorsFilter) {
    query = query.eq("doors", doorsFilter);
    filtersApplied.push(`${doorsFilter}-door`);
  }

  if (routine.min_front_legroom_in) {
    query = query.gte("front_legroom_in", routine.min_front_legroom_in);
    filtersApplied.push(`Front legroom ≥${routine.min_front_legroom_in}"`);
  }
  if (routine.min_rear_legroom_in) {
    query = query.gte("rear_legroom_in", routine.min_rear_legroom_in);
    filtersApplied.push(`Rear legroom ≥${routine.min_rear_legroom_in}"`);
  }

  const { data, error } = await query
    .order("deal_quality_score", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[deals/match] Supabase error:", error.message);
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }

  const rows = (data ?? []) as DealRow[];

  // JS-side threshold filtering
  const cargoPreference = routine.max_cargo_size;
  const towingPreference = routine.towing_needs;
  const maxChargeTime = routine.max_charge_time_l2;
  const extColor = routine.preferred_exterior_color?.toLowerCase();
  const intColor = routine.preferred_interior_color?.toLowerCase();

  const filtered = rows.filter((deal) => {
    if (cargoPreference && cargoPreference !== "compact" && CARGO_MIN[cargoPreference]) {
      if (deal.cargo_volume_cuft != null && deal.cargo_volume_cuft < CARGO_MIN[cargoPreference]) return false;
    }
    if (towingPreference && towingPreference !== "none" && TOWING_MIN[towingPreference]) {
      if (deal.towing_capacity_lbs != null && deal.towing_capacity_lbs < TOWING_MIN[towingPreference]) return false;
    }
    return true;
  });

  // Score each deal using computeRoutineFit + soft preference bonuses
  const scored: CuratedDealMatch[] = filtered.map((deal) => {
    // Real routine fit score
    const fitResult = computeRoutineFit(
      routine,
      {
        model: deal.model ?? undefined,
        year: deal.year ?? undefined,
        real_world_range_mi: deal.epa_range_mi ?? undefined,
        msrp_usd: deal.price ?? undefined,
        cargo_volume_cuft: deal.cargo_volume_cuft ?? undefined,
        purchase_type: "used",
      },
      {}
    );

    const fitScore = fitResult.score_0_100;
    const fitLabel = fitResult.label;

    // Preference-match reasons (displayed as badges)
    const reasons: string[] = [];
    if (drivetrain && drivetrain !== "any") reasons.push(drivetrain.toUpperCase());
    if (budget && deal.price) reasons.push(`Under $${(budget / 1000).toFixed(0)}k`);

    if (extColor && extColor !== "any" && deal.exterior_color?.toLowerCase().includes(extColor)) {
      reasons.push(`${deal.exterior_color} exterior`);
    }
    if (intColor && intColor !== "any" && deal.interior_color?.toLowerCase().includes(intColor)) {
      reasons.push(`${deal.interior_color} interior`);
    }

    const notes = deal.additional_notes?.toLowerCase() ?? "";
    if (routine.require_carplay && notes.includes("carplay")) reasons.push("CarPlay");
    if (routine.require_android_auto && notes.includes("android auto")) reasons.push("Android Auto");
    if (routine.require_keyless_entry && notes.includes("keyless")) reasons.push("Keyless Entry");

    if (maxChargeTime) {
      const dealHours = parseChargeTimeHours(deal.charge_time_notes);
      if (dealHours != null && dealHours <= maxChargeTime) reasons.push(`≤${maxChargeTime}h charge`);
    }

    return {
      id: deal.id,
      listing_url: deal.listing_url,
      vehicle_label: deal.vehicle_label,
      year: deal.year,
      make: deal.make,
      model: deal.model,
      trim: deal.trim ?? null,
      price: deal.price ?? null,
      mileage: deal.mileage ?? null,
      location: deal.location ?? null,
      photo_url: deal.photo_url ?? null,
      receipt_id: deal.receipt_id ?? null,
      url_domain: deal.url_domain ?? null,
      body_type: deal.body_type ?? null,
      drivetrain: deal.drivetrain ?? null,
      epa_range_mi: deal.epa_range_mi ?? null,
      exterior_color: deal.exterior_color ?? null,
      interior_color: deal.interior_color ?? null,
      match_score: fitScore,
      fit_label: fitLabel,
      match_reasons: [...new Set(reasons)],
    };
  });

  // Sort: fit_score DESC, then deal_quality_score as tiebreaker
  const dealQuality = new Map(filtered.map((d) => [d.id, d.deal_quality_score ?? 50]));
  scored.sort((a, b) => {
    if (b.match_score !== a.match_score) return b.match_score - a.match_score;
    return (dealQuality.get(b.id) ?? 50) - (dealQuality.get(a.id) ?? 50);
  });

  // MarketCheck fallback — only when no curated deals matched
  let fallbackListings: MarketCheckFallback[] | undefined;
  if (filtered.length === 0) {
    const candidates = fallbackCandidates(routine);
    const results = await Promise.allSettled(
      candidates.map((c) => searchByMakeModel({ make: c.make, model: c.model }))
    );

    const raw: MarketCheckFallback[] = [];
    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value.success) continue;
      for (const listing of result.value.listings) {
        if (listing.inventory_type && listing.inventory_type !== "used") continue;
        if (budget && listing.price && listing.price > budget) continue;
        if (listing.miles && listing.miles > 100000) continue;
        raw.push({
          id: listing.id,
          vin: listing.vin,
          heading: listing.heading ?? `${listing.build?.year ?? ""} ${listing.build?.make ?? ""} ${listing.build?.model ?? ""}`.trim(),
          price: listing.price ?? null,
          miles: listing.miles ?? null,
          vdp_url: listing.vdp_url ?? null,
          exterior_color: listing.exterior_color ?? null,
          photo_url: listing.media?.photo_links?.[0] ?? null,
          dealer_name: listing.dealer?.name ?? null,
          dealer_city: listing.dealer?.city ?? null,
          dealer_state: listing.dealer?.state ?? null,
        });
        if (raw.length >= 6) break;
      }
      if (raw.length >= 6) break;
    }
    if (raw.length > 0) fallbackListings = raw;
  }

  return NextResponse.json({
    success: true,
    matches: scored.slice(0, 6),
    total_matched: filtered.length,
    filters_applied: filtersApplied,
    ...(fallbackListings ? { fallback_listings: fallbackListings } : {}),
  });
}
