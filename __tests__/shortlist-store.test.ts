/**
 * Shortlist Store — Unit Tests
 *
 * Tests the localStorage CRUD operations used by the Compare EVs feature.
 * Runs in jsdom so localStorage is available.
 */

import {
  getShortlist,
  addToShortlist,
  removeFromShortlist,
  clearShortlist,
  shortlistCount,
} from "@/lib/shortlist-store";
import type { ShortlistCandidate } from "@/lib/shortlist-coach";

// ---------------------------------------------------------------------------
// Minimal ShortlistCandidate factory
// ---------------------------------------------------------------------------

function makeCandidate(overrides: Partial<ShortlistCandidate> = {}): ShortlistCandidate {
  return {
    run_id: `run_${Math.random().toString(36).slice(2, 8)}`,
    vehicle_label: "2022 Tesla Model 3",
    fit_score: {
      score_0_100: 85,
      label: "Great Fit",
      mental_load: "low",
      stress_flags: [],
      breakpoints_ranked: [],
      confidence: {
        level: "high",
        note: "Full data",
        has_vehicle_data: true,
        has_battery_data: true,
      },
      dimensions: {
        charging: 90,
        range: 88,
        recovery: 80,
        climate: 75,
      },
      failure_probability: 0.05,
      top_risk_dimension: "climate",
      confidence_adjusted_score: 83,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// getShortlist
// ---------------------------------------------------------------------------

describe("getShortlist", () => {
  it("returns empty array when localStorage has no shortlist key", () => {
    expect(getShortlist()).toEqual([]);
  });

  it("returns stored candidates", () => {
    const c = makeCandidate({ vehicle_label: "2023 Chevy Bolt" });
    localStorage.setItem("offo_shortlist", JSON.stringify([c]));
    expect(getShortlist()).toHaveLength(1);
    expect(getShortlist()[0].vehicle_label).toBe("2023 Chevy Bolt");
  });

  it("returns empty array when localStorage value is malformed JSON", () => {
    localStorage.setItem("offo_shortlist", "not-json{{");
    expect(getShortlist()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// addToShortlist
// ---------------------------------------------------------------------------

describe("addToShortlist", () => {
  it("adds a new candidate and returns success: true", () => {
    const c = makeCandidate();
    const result = addToShortlist(c);
    expect(result.success).toBe(true);
    expect(getShortlist()).toHaveLength(1);
  });

  it("returns success: false with reason 'duplicate' when run_id already exists", () => {
    const c = makeCandidate({ run_id: "dup_run_1" });
    addToShortlist(c);
    const result = addToShortlist(c);
    expect(result.success).toBe(false);
    expect(result.reason).toBe("duplicate");
    expect(getShortlist()).toHaveLength(1);
  });

  it("allows up to 4 candidates", () => {
    for (let i = 0; i < 4; i++) {
      const r = addToShortlist(makeCandidate());
      expect(r.success).toBe(true);
    }
    expect(getShortlist()).toHaveLength(4);
  });

  it("returns success: false with reason 'full' when shortlist already has 4 entries", () => {
    for (let i = 0; i < 4; i++) addToShortlist(makeCandidate());
    const result = addToShortlist(makeCandidate());
    expect(result.success).toBe(false);
    expect(result.reason).toBe("full");
    expect(getShortlist()).toHaveLength(4);
  });

  it("preserves insertion order", () => {
    const c1 = makeCandidate({ vehicle_label: "First" });
    const c2 = makeCandidate({ vehicle_label: "Second" });
    addToShortlist(c1);
    addToShortlist(c2);
    const list = getShortlist();
    expect(list[0].vehicle_label).toBe("First");
    expect(list[1].vehicle_label).toBe("Second");
  });
});

// ---------------------------------------------------------------------------
// removeFromShortlist
// ---------------------------------------------------------------------------

describe("removeFromShortlist", () => {
  it("removes the candidate with the matching run_id", () => {
    const c1 = makeCandidate({ run_id: "keep_me" });
    const c2 = makeCandidate({ run_id: "remove_me" });
    addToShortlist(c1);
    addToShortlist(c2);
    removeFromShortlist("remove_me");
    const list = getShortlist();
    expect(list).toHaveLength(1);
    expect(list[0].run_id).toBe("keep_me");
  });

  it("is a no-op when run_id does not exist", () => {
    const c = makeCandidate({ run_id: "existing" });
    addToShortlist(c);
    removeFromShortlist("nonexistent");
    expect(getShortlist()).toHaveLength(1);
  });

  it("results in an empty shortlist when the last candidate is removed", () => {
    const c = makeCandidate({ run_id: "only_one" });
    addToShortlist(c);
    removeFromShortlist("only_one");
    expect(getShortlist()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// clearShortlist
// ---------------------------------------------------------------------------

describe("clearShortlist", () => {
  it("removes all candidates", () => {
    addToShortlist(makeCandidate());
    addToShortlist(makeCandidate());
    clearShortlist();
    expect(getShortlist()).toEqual([]);
  });

  it("is safe to call on an already-empty shortlist", () => {
    expect(() => clearShortlist()).not.toThrow();
    expect(getShortlist()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// shortlistCount
// ---------------------------------------------------------------------------

describe("shortlistCount", () => {
  it("returns 0 when empty", () => {
    expect(shortlistCount()).toBe(0);
  });

  it("returns correct count after adds", () => {
    addToShortlist(makeCandidate());
    addToShortlist(makeCandidate());
    expect(shortlistCount()).toBe(2);
  });

  it("returns correct count after remove", () => {
    const c = makeCandidate({ run_id: "to_remove" });
    addToShortlist(c);
    addToShortlist(makeCandidate());
    removeFromShortlist("to_remove");
    expect(shortlistCount()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("shortlist-store — edge cases", () => {
  it("two candidates with different run_ids but same vehicle_label are both accepted", () => {
    const c1 = makeCandidate({ run_id: "run_a", vehicle_label: "2022 Tesla Model 3" });
    const c2 = makeCandidate({ run_id: "run_b", vehicle_label: "2022 Tesla Model 3" });
    addToShortlist(c1);
    const result = addToShortlist(c2);
    expect(result.success).toBe(true);
    expect(getShortlist()).toHaveLength(2);
  });

  it("shortlist persists across multiple getShortlist calls", () => {
    const c = makeCandidate({ vehicle_label: "Persistent EV" });
    addToShortlist(c);
    getShortlist(); // read once
    const second = getShortlist(); // read again
    expect(second[0].vehicle_label).toBe("Persistent EV");
  });
});
