/**
 * QA — data-policy regression suite (Buying Agent MVP)
 *
 * Encodes the confidence policy in Team/02_Projects/buying-agent/specs/data-audit.md §3:
 *   - An absent field is never zero / false
 *   - A provider "not found" is never "clean"
 *   - A wrong-spelling recall lookup must not read as "0 recalls"
 *
 * `it.failing` = a known open bug (ID in the test name, tracked in
 * Team/02_Projects/buying-agent/qa/baseline-report.md). Jest reports it as
 * passing while the bug exists and FAILS once the bug is fixed — when that happens,
 * change `it.failing` to `it` so the fix stays locked in.
 *
 * Plain `it` = behavior that is correct today and must not regress.
 * No network: fetch and the VehicleDatabases client are mocked.
 */

import { getVinHistory, type VinHistoryResult, type VinHistoryError } from "@/lib/vin-history-client";
import { titleCheck } from "@/lib/vehicledatabases-client";
import { getNhtsaRecalls, _clearModelListCacheForTests } from "@/lib/nhtsa-recalls";
import { computeRoutineFit } from "@/lib/compute-routine-fit";
import { computeRoutineFitV2 } from "@/lib/compute-routine-fit-v2";
import type { MinimumViableRoutine } from "@/types/v2";

jest.mock("@/lib/vehicledatabases-client", () => ({
  titleCheck: jest.fn(),
  auctionHistory: jest.fn(),
}));

const VIN = "5YJ3E1EA1JF037924"; // test-set row 1
const mockTitleCheck = titleCheck as jest.Mock;

/** Fails the test if the lookup failed, so a test can never pass with zero assertions */
function assertSuccess(r: VinHistoryResult | VinHistoryError): asserts r is VinHistoryResult {
  expect(r.success).toBe(true);
  if (!r.success) throw new Error(`expected a history result, got: ${r.error}`);
}

function mockFetchJson(body: unknown, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.VEHICLEDATABASES_API_KEY = "test-key";
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  // getNhtsaRecalls caches NHTSA's model list per make/year at module scope —
  // correct for production, but it makes cross-test results order-dependent
  // unless each test starts from a clean cache.
  _clearModelListCacheForTests();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// lookup_vin — history (lib/vin-history-client.ts)
// ---------------------------------------------------------------------------

describe("lookup_vin history: absent fields are never facts", () => {
  it("keeps a provider-reported accident count", async () => {
    mockFetchJson({ status: "success", data: { title: { status: "Clean" }, accidents: { count: 2 } } });
    const r = await getVinHistory(VIN);
    expect(r.success).toBe(true);
    assertSuccess(r);
    expect(r.accident_count).toBe(2);
  });

  it("reports theft when the provider returns theft records", async () => {
    mockFetchJson({ status: "success", data: { title: { status: "Clean" }, theft: { records: [{ date: "2022-01-01" }] } } });
    const r = await getVinHistory(VIN);
    assertSuccess(r);
    expect(r.theft_reported).toBe(true);
  });

  it("reads a salvage title from the provider", async () => {
    mockFetchJson({ status: "success", data: { title: { status: "SALVAGE" } } });
    const r = await getVinHistory(VIN);
    assertSuccess(r);
    expect(r.title_status).toBe("salvage");
  });

  it("returns success:false when both endpoints fail (no silent result)", async () => {
    mockFetchJson({}, 500);
    mockTitleCheck.mockResolvedValue({ success: false, error: "down" });
    const r = await getVinHistory(VIN);
    expect(r.success).toBe(false);
  });

  it("F-1: accident_count is null when the provider omitted the accidents section", async () => {
    mockFetchJson({ status: "success", data: { title: { status: "Clean" } } });
    const r = await getVinHistory(VIN);
    assertSuccess(r);
    expect(r.accident_count).toBeNull();
  });

  it("F-1: theft_reported is null when the provider omitted the theft section", async () => {
    mockFetchJson({ status: "success", data: { title: { status: "Clean" } } });
    const r = await getVinHistory(VIN);
    assertSuccess(r);
    expect(r.theft_reported).toBeNull();
  });

  it("F-2: title-check fallback (salvage-only) never reports title 'clean'", async () => {
    mockFetchJson({}, 500);
    mockTitleCheck.mockResolvedValue({ success: true, vin: VIN, salvage: false, salvage_details: null });
    const r = await getVinHistory(VIN);
    assertSuccess(r);
    expect(r.title_status).not.toBe("clean");
  });

  it("F-2: title-check fallback leaves accidents and theft unknown (null)", async () => {
    mockFetchJson({}, 500);
    mockTitleCheck.mockResolvedValue({ success: true, vin: VIN, salvage: false, salvage_details: null });
    const r = await getVinHistory(VIN);
    assertSuccess(r);
    {
      expect(r.accident_count).toBeNull();
      expect(r.theft_reported).toBeNull();
    }
  });

  it("F-2 guard: title-check fallback still reports salvage when found", async () => {
    mockFetchJson({}, 500);
    mockTitleCheck.mockResolvedValue({ success: true, vin: VIN, salvage: true, salvage_details: {} });
    const r = await getVinHistory(VIN);
    assertSuccess(r);
    expect(r.title_status).toBe("salvage");
  });
});

// ---------------------------------------------------------------------------
// lookup_vin — recalls (lib/nhtsa-recalls.ts)
// ---------------------------------------------------------------------------

describe("lookup_vin recalls: model-name spelling", () => {
  // F-3 fix resolves the model name dynamically against NHTSA's own
  // vehicle/models list (1st fetch), then queries recallsByVehicle with
  // hyphens turned to spaces (2nd fetch) — confirmed live that the model
  // list and recallsByVehicle disagree on punctuation (model list says
  // "MUSTANG MACH-E", recallsByVehicle only matches "MUSTANG MACH E": 0
  // vs 13 results). Each test now mocks both calls in sequence.
  function mockModelListThenRecalls(modelListNames: string[], recallResults: unknown[]) {
    (global.fetch as jest.Mock) = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: modelListNames.map((m) => ({ model: m })) }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ results: recallResults }),
      });
  }

  function requestedModel(): string {
    const url = (global.fetch as jest.Mock).mock.calls[1][0] as string;
    return decodeURIComponent(new URL(url).searchParams.get("model") ?? "");
  }

  it("maps 'Bolt EV' to NHTSA's 'Bolt EV'", async () => {
    mockModelListThenRecalls(["Bolt EV"], []);
    await getNhtsaRecalls("Chevrolet", "Bolt EV", 2019);
    expect(requestedModel()).toBe("Bolt EV");
  });

  it("F-3: Mustang Mach-E is sent as NHTSA's 'MUSTANG MACH E' (test-set row 8)", async () => {
    mockModelListThenRecalls(["MUSTANG MACH-E"], []);
    await getNhtsaRecalls("Ford", "Mustang Mach-E", 2021);
    expect(requestedModel()).toBe("MUSTANG MACH E");
  });

  it("F-3: vPIC's 'Ariya Hatchback' is sent as 'ARIYA' (test-set row 15)", async () => {
    mockModelListThenRecalls(["ARIYA"], []);
    await getNhtsaRecalls("Nissan", "Ariya Hatchback", 2023);
    expect(requestedModel().toUpperCase()).toBe("ARIYA");
  });

  it("F-3: a bare 'Bolt' is sent as 'Bolt EV' (test-set row 7)", async () => {
    mockModelListThenRecalls(["BOLT EV"], []);
    await getNhtsaRecalls("Chevrolet", "Bolt", 2020);
    expect(requestedModel().toUpperCase()).toBe("BOLT EV");
  });

  it("F-3: Kia 'Niro' (EV VIN) is sent as 'NIRO EV' (test-set row 11)", async () => {
    mockModelListThenRecalls(["NIRO", "NIRO PLUG-IN HYBRID", "NIRO EV"], []);
    await getNhtsaRecalls("Kia", "Niro", 2023);
    expect(requestedModel().toUpperCase()).toBe("NIRO EV");
  });

  it("returns null (unavailable) when the model list has no match", async () => {
    mockModelListThenRecalls(["COMPLETELY UNRELATED MODEL"], []);
    expect(await getNhtsaRecalls("Ford", "Mustang Mach-E", 2022)).toBeNull();
  });

  it("returns null (unavailable) when NHTSA errors", async () => {
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    expect(await getNhtsaRecalls("Ford", "Mustang Mach-E", 2021)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// match_fit — missing charger data (lib/compute-routine-fit-v2.ts)
// ---------------------------------------------------------------------------

describe("match_fit: missing charger data is not 'zero chargers'", () => {
  const PUBLIC: MinimumViableRoutine = {
    charging_access: "public",
    weekly_miles: 350,
    climate: "winter",
    longest_day_pattern: "once_a_week",
  };
  const WORK: MinimumViableRoutine = { ...PUBLIC, charging_access: "work", weekly_miles: 200, climate: "mild", longest_day_pattern: "rare_road_trip" };
  const HOME: MinimumViableRoutine = { ...PUBLIC, charging_access: "home", weekly_miles: 100, climate: "mild", longest_day_pattern: "rare_road_trip" };

  it("home-charging buyers are unaffected by charger data", () => {
    const base = computeRoutineFit(HOME).score_0_100;
    expect(computeRoutineFitV2({ routine: HOME }).score_0_100).toBe(base);
    expect(computeRoutineFitV2({ routine: HOME, chargerCount: 0 }).score_0_100).toBe(base);
  });

  it("a real count of 0 nearby chargers scores lower than 5", () => {
    const zero = computeRoutineFitV2({ routine: PUBLIC, chargerCount: 0 }).score_0_100;
    const five = computeRoutineFitV2({ routine: PUBLIC, chargerCount: 5 }).score_0_100;
    expect(zero).toBeLessThan(five);
  });

  // QA-1 originally asserted unknown === baseline. Data-Intel's threshold ruling
  // (verdict-rules.md, D-010) is "Unknown = Moderate", so the durable rule is:
  // unknown is never scored as a confirmed 0 (QA-1), and never better than Moderate (F-7).
  it("QA-1: public-charging buyer with no charger data is not scored as 0 chargers", () => {
    // Before the fix: 49 "Mixed Fit" → 32 "High Friction" purely because the count was unknown
    const unknown = computeRoutineFitV2({ routine: PUBLIC }).score_0_100;
    const zero = computeRoutineFitV2({ routine: PUBLIC, chargerCount: 0 }).score_0_100;
    expect(unknown).toBeGreaterThan(zero);
  });

  it("QA-1: work-charging buyer with no charger data is not scored as 0 chargers", () => {
    const unknown = computeRoutineFitV2({ routine: WORK }).score_0_100;
    const zero = computeRoutineFitV2({ routine: WORK, chargerCount: 0 }).score_0_100;
    expect(unknown).toBeGreaterThan(zero);
  });

  it.failing("F-7: unknown charger data never scores better than 'Moderate' (2 known chargers), public", () => {
    // Today: unknown 58 > 1 charger 53 / 2 chargers 56 (Data-Intel 10-20), so unknown acts as a bonus
    const unknown = computeRoutineFitV2({ routine: PUBLIC }).score_0_100;
    const moderate = computeRoutineFitV2({ routine: PUBLIC, chargerCount: 2 }).score_0_100;
    expect(unknown).toBeLessThanOrEqual(moderate);
  });

  it("F-7 guard: unknown charger data never scores better than 'Moderate' (2 known chargers), work", () => {
    const unknown = computeRoutineFitV2({ routine: WORK }).score_0_100;
    const moderate = computeRoutineFitV2({ routine: WORK, chargerCount: 2 }).score_0_100;
    expect(unknown).toBeLessThanOrEqual(moderate);
  });

  it("baseline engine without charger context still runs (no ZIP / NREL down)", () => {
    expect(computeRoutineFit(PUBLIC).score_0_100).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Chain A2 — targeted failure cases (timeout, empty, partial, unknown name)
// ---------------------------------------------------------------------------

describe("A2 lookup_vin history: provider failure modes", () => {
  it("timeout on /vehicle-history falls back to the salvage-only check, marked partial", async () => {
    global.fetch = jest.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")) as unknown as typeof fetch;
    mockTitleCheck.mockResolvedValue({ success: true, vin: VIN, salvage: false, salvage_details: null });
    const r = await getVinHistory(VIN);
    expect(r.success).toBe(true);
    assertSuccess(r);
    {
      expect(r.partial).toBe(true);
      expect(r.title_status).toBe("unknown");
      expect(r.accident_count).toBeNull();
    }
  });

  it("timeout on both endpoints → success:false", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("timeout")) as unknown as typeof fetch;
    mockTitleCheck.mockRejectedValue(new Error("timeout"));
    expect((await getVinHistory(VIN)).success).toBe(false);
  });

  it("empty data object → title unknown, accidents/theft/owners/lien null", async () => {
    mockFetchJson({ status: "success", data: {} });
    const r = await getVinHistory(VIN);
    assertSuccess(r);
    expect(r.title_status).toBe("unknown");
    expect(r.accident_count).toBeNull();
    expect(r.theft_reported).toBeNull();
    expect(r.ownership_count).toBeNull();
    expect(r.open_lien).toBeNull();
    expect(r.partial).toBe(false);
  });

  it("partial record: accidents returned, theft omitted → keeps 1 accident, theft null", async () => {
    mockFetchJson({ status: "success", data: { title: { status: "Clean" }, accidents: { records: [{ date: "2021-05-01" }] } } });
    const r = await getVinHistory(VIN);
    assertSuccess(r);
    expect(r.accident_count).toBe(1);
    expect(r.theft_reported).toBeNull();
  });

  it("an explicit empty accidents section is a real 0 (provider checked)", async () => {
    mockFetchJson({ status: "success", data: { title: { status: "Clean" }, accidents: { records: [] } } });
    const r = await getVinHistory(VIN);
    assertSuccess(r);
    expect(r.accident_count).toBe(0);
  });

  it("non-success provider status → never a clean title", async () => {
    mockFetchJson({ status: "error", message: "VIN not found" });
    mockTitleCheck.mockResolvedValue({ success: false, error: "not found" });
    const r = await getVinHistory(VIN);
    expect(r.success).toBe(false);
  });

  it("no API key → no fetch, falls through honestly", async () => {
    delete process.env.VEHICLEDATABASES_API_KEY;
    global.fetch = jest.fn() as unknown as typeof fetch;
    mockTitleCheck.mockResolvedValue({ success: false, error: "VehicleDatabases not configured", code: "not_configured" });
    const r = await getVinHistory(VIN);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(r.success).toBe(false);
  });

  it.failing("F-5: salvage_reported is null when the provider omitted the salvage section", async () => {
    mockFetchJson({ status: "success", data: { title: { status: "Clean" } } });
    const r = await getVinHistory(VIN);
    assertSuccess(r);
    expect(r.salvage_reported).toBeNull();
  });

  it.failing("F-6: 'records: null' from the provider is read as unknown, not dropped to the partial fallback", async () => {
    mockFetchJson({ status: "success", data: { title: { status: "Clean" }, accidents: { records: null }, theft: { records: null } } });
    mockTitleCheck.mockResolvedValue({ success: true, vin: VIN, salvage: false, salvage_details: null });
    const r = await getVinHistory(VIN);
    assertSuccess(r);
    expect(r.partial).toBe(false);
    expect(r.title_status).toBe("clean");
    expect(r.accident_count).toBeNull();
  });
});

describe("A2 lookup_vin recalls: NHTSA failure modes", () => {
  /** Route fetch by endpoint so each test states what NHTSA returns for each call */
  function mockNhtsa(opts: {
    models?: string[] | "error" | "timeout";
    recalls?: (model: string) => { status: number; results: unknown[] } | "timeout";
  }) {
    global.fetch = jest.fn(async (input: string) => {
      const url = new URL(input);
      if (url.pathname.includes("/products/vehicle/models")) {
        if (opts.models === "timeout") throw new DOMException("timeout", "TimeoutError");
        if (opts.models === "error" || !opts.models) return { ok: false, status: 400, json: async () => ({ Count: 0, results: [] }) };
        const list = opts.models;
        return { ok: true, status: 200, json: async () => ({ results: list.map((m) => ({ model: m })) }) };
      }
      const r = opts.recalls?.(url.searchParams.get("model") ?? "") ?? { status: 400, results: [] };
      if (r === "timeout") throw new DOMException("timeout", "TimeoutError");
      return { ok: r.status === 200, status: r.status, json: async () => ({ Count: r.results.length, results: r.results }) };
    }) as unknown as typeof fetch;
  }
  const RECALL = { NHTSACampaignNumber: "21V000", Component: "ELECTRICAL", Summary: "s", Consequence: "c", Remedy: "r", ReportReceivedDate: "2021-01-01" };

  it("recall search returns HTTP 400 (NHTSA's 'no match') → unavailable, not 0", async () => {
    mockNhtsa({ models: ["MODEL Y 5-SEAT"], recalls: () => ({ status: 400, results: [] }) });
    expect(await getNhtsaRecalls("Tesla", "Model Y", 2021)).toBeNull();
  });

  it("model-list endpoint returns 400 → unavailable", async () => {
    mockNhtsa({ models: "error" });
    expect(await getNhtsaRecalls("Hyundai", "Kona Electric", 2022)).toBeNull();
  });

  it("model-list timeout → unavailable", async () => {
    mockNhtsa({ models: "timeout" });
    expect(await getNhtsaRecalls("Ford", "Mustang Mach-E", 2021)).toBeNull();
  });

  it("recall-search timeout → unavailable", async () => {
    mockNhtsa({ models: ["MUSTANG MACH-E"], recalls: () => "timeout" });
    expect(await getNhtsaRecalls("Ford", "Mustang Mach-E", 2021)).toBeNull();
  });

  it("our DB typo 'Chevloret' → unavailable, never another car's recalls", async () => {
    mockNhtsa({ models: "error" });
    expect(await getNhtsaRecalls("Chevloret", "Bolt EUV", 2022)).toBeNull();
  });

  it.failing("QA-10: our DB's 'Model S Y' (a Model Y, test-set row 4) never resolves to Model S", async () => {
    // Live 10-20: 2021 Tesla "Model S Y" / "Model S 3" / "Model S X" → "MODEL S", 24 campaigns.
    // Cause: the reverse substring match (target.includes(listName)) in resolveNhtsaModel.
    mockNhtsa({ models: ["MODEL 3", "MODEL S", "MODEL X", "MODEL Y"], recalls: () => ({ status: 200, results: [RECALL] }) });
    const r = await getNhtsaRecalls("Tesla", "Model S Y", 2021);
    expect(r?.resolved_model ?? null).not.toBe("MODEL S");
  });

  it("a real 200 with results reports the count and the resolved name", async () => {
    mockNhtsa({ models: ["MUSTANG MACH-E"], recalls: (m) => ({ status: 200, results: m === "MUSTANG MACH E" ? [RECALL, RECALL] : [] }) });
    const r = await getNhtsaRecalls("Ford", "Mustang Mach-E", 2021);
    expect(r?.recall_count).toBe(2);
    expect(r?.resolved_model).toBe("MUSTANG MACH-E");
  });

  it.failing("F-4: F-150 Lightning recalls are found (search needs the hyphen kept)", async () => {
    // Live 10-20: "F-150 LIGHTNING" → 2 campaigns; "F 150 LIGHTNING" → HTTP 400
    mockNhtsa({ models: ["F-150 LIGHTNING"], recalls: (m) => (m === "F-150 LIGHTNING" ? { status: 200, results: [RECALL, RECALL] } : { status: 400, results: [] }) });
    expect((await getNhtsaRecalls("Ford", "F-150 Lightning", 2023))?.recall_count).toBe(2);
  });

  it.failing("F-4: Leaf recalls are found when NHTSA lists it as 'LEAF (40 KWH BATTERY)'", async () => {
    mockNhtsa({ models: ["LEAF (40 KWH BATTERY)", "LEAF (62 KWH BATTERY)"], recalls: (m) => (m.toUpperCase() === "LEAF" ? { status: 200, results: [RECALL, RECALL, RECALL] } : { status: 400, results: [] }) });
    expect((await getNhtsaRecalls("Nissan", "Leaf", 2023))?.recall_count).toBe(3);
  });
});
