/**
 * Voice Compliance Tests (CMO Phase 1)
 *
 * Enforces:
 * 1. Banned phrases (range anxiety, EV vs ICE, etc.)
 * 2. Approved phrases (mental overhead, routine friction, etc.)
 * 3. Block-specific language requirements
 */

import { lintVoice, hasApprovedLanguage } from "@/debug/voiceLinter";
import { createChargingFitBlock } from "@/core/blocks/chargingFitBlock";
import { createAssumptionDriftBlock } from "@/core/blocks/assumptionDriftBlock";
import { createOutcomePathsBlock } from "@/core/blocks/outcomePathsBlock";
import { createBatteryHealthBlock } from "@/core/blocks/batteryHealthBlock";
import type { RenderCtx } from "@/core/content";
import { buildSignals } from "@/core/signals";

describe("Voice Linter - Banned Phrases", () => {
  it("should flag 'range anxiety'", () => {
    const text = "This vehicle may cause range anxiety in cold weather.";
    const result = lintVoice(text);
    expect(result.ok).toBe(false);
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].rule).toContain("Range anxiety");
  });

  it("should flag 'EV vs ICE' debates", () => {
    const text = "When comparing EV vs ICE, there are trade-offs.";
    const result = lintVoice(text);
    expect(result.ok).toBe(false);
    expect(result.hits[0].rule).toContain("EV vs ICE");
  });

  it("should flag 'game changer'", () => {
    const text = "This battery technology is a game-changer for EVs.";
    const result = lintVoice(text);
    expect(result.ok).toBe(false);
    expect(result.hits[0].rule).toContain("game changer");
  });

  it("should flag 'charger count' arguments", () => {
    const text = "The charger count in this area is growing rapidly.";
    const result = lintVoice(text);
    expect(result.ok).toBe(false);
    expect(result.hits[0].rule).toContain("charger count");
  });

  it("should flag 'better than gas'", () => {
    const text = "EVs are better than gas cars in terms of maintenance.";
    const result = lintVoice(text);
    expect(result.ok).toBe(false);
    expect(result.hits[0].rule).toContain("better than gas");
  });

  it("should allow clean text", () => {
    const text = "This assessment focuses on charging fit and routine friction.";
    const result = lintVoice(text);
    expect(result.ok).toBe(true);
    expect(result.hits).toHaveLength(0);
  });
});

describe("Voice Linter - Approved Phrases", () => {
  it("should detect 'mental overhead'", () => {
    const text = "DC fast charging creates high mental overhead.";
    const result = hasApprovedLanguage(text);
    expect(result.mentalOverhead).toBe(true);
  });

  it("should detect 'routine friction'", () => {
    const text = "This setup adds routine friction to daily charging.";
    const result = hasApprovedLanguage(text);
    expect(result.routineFriction).toBe(true);
  });

  it("should detect 'predictability'", () => {
    const text = "Success depends on predictability, not availability.";
    const result = hasApprovedLanguage(text);
    expect(result.predictability).toBe(true);
  });

  it("should detect 'behavioral risk'", () => {
    const text = "This is behavioral risk, not technical risk.";
    const result = hasApprovedLanguage(text);
    expect(result.behavioralRisk).toBe(true);
  });

  it("should detect 'fit mismatch'", () => {
    const text = "The issue is a fit mismatch, not vehicle quality.";
    const result = hasApprovedLanguage(text);
    expect(result.fitMismatch).toBe(true);
  });
});

describe("Block Voice Compliance - Charging Fit", () => {
  const mockCtx: RenderCtx = {
    vehicle: { year: 2020, make: "Tesla", model: "Model 3" },
    inputs: {
      chargingAccess: "dc_fast_primary",
      chargingReliability: "unpredictable",
    },
    signals: buildSignals(
      { year: 2020, make: "Tesla", model: "Model 3" },
      {
        chargingAccess: "dc_fast_primary",
        chargingReliability: "unpredictable",
      }
    ),
  };

  it("should use 'mental overhead' for DC fast primary + unpredictable", () => {
    const block = createChargingFitBlock();
    const output = block.render(mockCtx);
    expect(output).toContain("mental overhead");
  });

  it("should use 'routine friction' language", () => {
    const block = createChargingFitBlock();
    const output = block.render(mockCtx);
    const lintResult = lintVoice(output);
    expect(lintResult.ok).toBe(true); // No banned phrases
  });

  it("should not use banned EV debate language", () => {
    const block = createChargingFitBlock();
    const output = block.render(mockCtx);
    expect(output).not.toMatch(/range anxiety/i);
    expect(output).not.toMatch(/ev vs ice/i);
    expect(output).not.toMatch(/charger count/i);
  });

  it("should explicitly name DC fast charging pattern", () => {
    const block = createChargingFitBlock();
    const output = block.render(mockCtx);
    expect(output).toContain("DC fast charging");
    expect(output).toContain("unpredictable");
  });

  it("should include backup plan proximity framing", () => {
    const block = createChargingFitBlock();
    const output = block.render(mockCtx);
    expect(output).toMatch(/10[-–]15 minutes/);
  });

  it("should use calm, factual language (no alarmism)", () => {
    const block = createChargingFitBlock();
    const output = block.render(mockCtx);
    expect(output).not.toMatch(/urgent/i);
    expect(output).not.toMatch(/critical/i);
    expect(output).not.toMatch(/dangerous/i);
  });
});

describe("Block Voice Compliance - Battery Health", () => {
  const mockCtxWithoutBattery: RenderCtx = {
    vehicle: { year: 2018, make: "Nissan", model: "Leaf" },
    inputs: {},
    signals: buildSignals(
      { year: 2018, make: "Nissan", model: "Leaf" },
      {}
    ),
  };

  it("should use ICE analog for missing battery data", () => {
    const block = createBatteryHealthBlock();
    const withhold = block.withhold?.(mockCtxWithoutBattery);
    expect(withhold).toBeDefined();
    expect(withhold?.why).toContain("like buying a used car without service records");
  });

  it("should de-emphasize mileage in favor of battery condition", () => {
    const block = createBatteryHealthBlock();
    const output = block.render(mockCtxWithoutBattery);
    expect(output).toContain("battery condition");
    // Should not focus on mileage as primary factor
    expect(output).not.toMatch(/based on mileage/i);
  });

  it("should emphasize battery condition vs expectations", () => {
    const mockCtxWithReport: RenderCtx = {
      ...mockCtxWithoutBattery,
      signals: {
        ...mockCtxWithoutBattery.signals,
        has_battery_health_report: true,
        has_battery_data: true,
      },
    };

    const block = createBatteryHealthBlock();
    const output = block.render(mockCtxWithReport);
    expect(output).toContain("battery condition");
    expect(output).toMatch(/testing|assessment/i);
  });

  it("should not use banned voice patterns", () => {
    const block = createBatteryHealthBlock();
    const output = block.render(mockCtxWithoutBattery);
    const lintResult = lintVoice(output);
    expect(lintResult.ok).toBe(true);
  });
});

describe("Block Voice Compliance - Outcome Paths", () => {
  const mockCtx: RenderCtx = {
    vehicle: { year: 2019, make: "Chevrolet", model: "Bolt" },
    inputs: {},
    signals: buildSignals(
      { year: 2019, make: "Chevrolet", model: "Bolt" },
      {}
    ),
  });

  it("should always include 'stay' options (anti-marketplace)", () => {
    const block = createOutcomePathsBlock();
    const output = block.render(mockCtx);
    expect(output).toContain("Stay and adjust");
  });

  it("should not use trade-in or marketplace language", () => {
    const block = createOutcomePathsBlock();
    const output = block.render(mockCtx);
    expect(output).not.toMatch(/trade[-\s]?in/i);
    expect(output).not.toMatch(/sell/i);
    expect(output).not.toMatch(/upgrade to/i);
  });

  it("should not use banned voice patterns", () => {
    const block = createOutcomePathsBlock();
    const output = block.render(mockCtx);
    const lintResult = lintVoice(output);
    expect(lintResult.ok).toBe(true);
  });
});

describe("Integration - All Blocks Voice Compliance", () => {
  const testCases = [
    {
      name: "Charging Fit Block",
      block: createChargingFitBlock(),
    },
    {
      name: "Assumption Drift Block",
      block: createAssumptionDriftBlock(),
    },
    {
      name: "Outcome Paths Block",
      block: createOutcomePathsBlock(),
    },
    {
      name: "Battery Health Block",
      block: createBatteryHealthBlock(),
    },
  ];

  const mockCtx: RenderCtx = {
    vehicle: { year: 2020, make: "Tesla", model: "Model 3" },
    inputs: {
      contextTrigger: "moved_home",
      chargingAccess: "apartment_shared_l2",
      chargingReliability: "sometimes_available",
    },
    signals: buildSignals(
      { year: 2020, make: "Tesla", model: "Model 3" },
      {
        contextTrigger: "moved_home",
        chargingAccess: "apartment_shared_l2",
        chargingReliability: "sometimes_available",
      }
    ),
  };

  testCases.forEach(({ name, block }) => {
    it(`${name} should pass voice linter`, () => {
      const output = block.render(mockCtx);
      const lintResult = lintVoice(output);

      if (!lintResult.ok) {
        console.error(`Voice violations in ${name}:`, lintResult.hits);
      }

      expect(lintResult.ok).toBe(true);
    });
  });
});
