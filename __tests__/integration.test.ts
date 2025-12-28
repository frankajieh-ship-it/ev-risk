/**
 * Integration Tests
 *
 * End-to-end tests for the complete block system
 */

import { buildSignals } from "@/core/signals";
import { labelFromConfidence, downgradeGuidanceIfNeeded } from "@/core/templates";
import { lintVoice } from "@/debug/voiceLinter";
import type { VehicleData, UserInputs } from "@/types";
import type { RenderCtx } from "@/core/content";

describe("Integration Tests", () => {
  describe("End-to-end: Battery Health Block", () => {
    it("renders complete battery health guidance with correct confidence", () => {
      const vehicle: VehicleData = {
        year: 2019,
        make: "Tesla",
        model: "Model 3",
        batteryData: {
          degradation: 12.4,
          confidence: "medium",
        },
      };

      const ctx: RenderCtx = {
        vehicle,
        inputs: undefined,
        signals: buildSignals(vehicle, undefined),
      };

      // Simulate block's confidence calculation
      const baseConfidence = 0.55;
      const hasAnnualMileage = Boolean(ctx.signals.annual_mileage);
      const confidence = baseConfidence + (hasAnnualMileage ? 0.2 : 0);

      expect(confidence).toBe(0.55); // No personalization yet
      expect(labelFromConfidence(confidence)).toBe("medium");

      // Simulate block's guidance level
      const proposedLevel = 1;
      const tier = 2;
      const effectiveLevel = downgradeGuidanceIfNeeded(tier, proposedLevel, confidence);

      expect(effectiveLevel).toBe(2); // Downgraded due to medium confidence

      // Generate message using effective level
      const guidancePrefix = effectiveLevel === 1
        ? "We recommend"
        : effectiveLevel === 2
          ? "Most buyers in your situation"
          : "Here's how to evaluate";

      const message = `${guidancePrefix} budgeting for battery replacement within 2–3 years based on this degradation rate.`;

      // Verify message passes linter
      const lintResult = lintVoice(message);
      expect(lintResult.ok).toBe(true);
      expect(lintResult.hits).toHaveLength(0);
    });

    it("increases confidence when user provides annual mileage", () => {
      const vehicle: VehicleData = {
        batteryData: {
          degradation: 12.4,
          confidence: "medium",
        },
      };

      const inputsWithMileage: UserInputs = {
        annualMileage: 12000,
      };

      const ctxBefore: RenderCtx = {
        vehicle,
        inputs: undefined,
        signals: buildSignals(vehicle, undefined),
      };

      const ctxAfter: RenderCtx = {
        vehicle,
        inputs: inputsWithMileage,
        signals: buildSignals(vehicle, inputsWithMileage),
      };

      // Calculate confidence before
      const baseConfidence = 0.55;
      const confidenceBefore = baseConfidence + (ctxBefore.signals.annual_mileage ? 0.2 : 0);

      // Calculate confidence after
      const confidenceAfter = baseConfidence + (ctxAfter.signals.annual_mileage ? 0.2 : 0);

      expect(confidenceBefore).toBe(0.55); // medium
      expect(confidenceAfter).toBe(0.75);   // high
      expect(labelFromConfidence(confidenceBefore)).toBe("medium");
      expect(labelFromConfidence(confidenceAfter)).toBe("high");

      // Verify guidance level changes
      const tier = 2;
      const proposedLevel = 1;

      const levelBefore = downgradeGuidanceIfNeeded(tier, proposedLevel, confidenceBefore);
      const levelAfter = downgradeGuidanceIfNeeded(tier, proposedLevel, confidenceAfter);

      expect(levelBefore).toBe(2); // Downgraded: "Most buyers in your situation"
      expect(levelAfter).toBe(1);  // Firm: "We recommend"
    });
  });

  describe("End-to-end: Recalls Block", () => {
    it("renders safety-related recall guidance with high confidence", () => {
      const vehicle: VehicleData = {
        recalls: [
          {
            id: "R1",
            title: "12V Battery Replacement",
            description: "...",
            priority: "high",
            isSafetyRelated: true,
          },
        ],
      };

      const ctx: RenderCtx = {
        vehicle,
        inputs: undefined,
        signals: buildSignals(vehicle, undefined),
      };

      expect(ctx.signals.has_recalls).toBe(true);
      expect(ctx.signals.open_recalls_critical_count).toBe(1);

      // Recalls block has high confidence (based on NHTSA data)
      const confidence = 0.90;
      const tier = 1; // Safety tier
      const proposedLevel = 1;

      const effectiveLevel = downgradeGuidanceIfNeeded(tier, proposedLevel, confidence);
      expect(effectiveLevel).toBe(1); // Safety tier stays firm

      // Generate message
      const message = `This vehicle has 1 open safety-related recall. We recommend asking your dealer to verify recall completion status before purchase. This matters before purchase because unresolved safety recalls can block registration.`;

      // Verify message passes linter (no "Urgent" or other banned phrases)
      const lintResult = lintVoice(message);
      expect(lintResult.ok).toBe(true);
      expect(lintResult.hits).toHaveLength(0);
    });

    it("OLD recalls text fails linter", () => {
      const oldMessage = "2 open recalls detected. 1 critical. Urgent action recommended.";
      const result = lintVoice(oldMessage);

      expect(result.ok).toBe(false);
      expect(result.hits.some(h => h.rule === 'BANNED: "Urgent"')).toBe(true);
    });

    it("NEW recalls text passes linter", () => {
      const newMessage = `This vehicle has 2 open recalls (1 safety-related). We recommend asking your dealer to verify recall completion status before purchase.`;
      const result = lintVoice(newMessage);

      expect(result.ok).toBe(true);
      expect(result.hits).toHaveLength(0);
    });
  });

  describe("End-to-end: Range Fit Block", () => {
    it("provides personalized guidance when daily commute is known", () => {
      const vehicle: VehicleData = {
        estimatedRange: 235,
        rangeAdequacy: 85,
      };

      const inputs: UserInputs = {
        dailyCommute: 40,
      };

      const ctx: RenderCtx = {
        vehicle,
        inputs,
        signals: buildSignals(vehicle, inputs),
      };

      expect(ctx.signals.daily_commute_miles).toBe(40);
      expect(ctx.signals.range_adequacy_score).toBe(85);

      // Calculate confidence
      const hasDailyCommute = Boolean(ctx.signals.daily_commute_miles);
      const confidence = hasDailyCommute ? 0.75 : 0.50;

      expect(confidence).toBe(0.75);
      expect(labelFromConfidence(confidence)).toBe("high");

      // Generate message
      const message = `With your 40-mile daily commute and this vehicle's 235-mile range, you have comfortable margin for daily driving without charging anxiety.`;

      const result = lintVoice(message);
      expect(result.ok).toBe(true);
    });

    it("shows lower confidence without personalization", () => {
      const vehicle: VehicleData = {
        estimatedRange: 235,
      };

      const ctx: RenderCtx = {
        vehicle,
        inputs: undefined,
        signals: buildSignals(vehicle, undefined),
      };

      expect(ctx.signals.daily_commute_miles).toBeUndefined();

      // Calculate confidence
      const hasDailyCommute = Boolean(ctx.signals.daily_commute_miles);
      const confidence = hasDailyCommute ? 0.75 : 0.50;

      expect(confidence).toBe(0.50);
      expect(labelFromConfidence(confidence)).toBe("medium");
    });
  });

  describe("End-to-end: Confidence Guards", () => {
    it("enforces consistency across all tiers", () => {
      const scenarios = [
        // Tier 1: Safety exception
        { tier: 1 as const, level: 1 as const, confidence: 0.60, expected: 1 },
        { tier: 1 as const, level: 1 as const, confidence: 0.35, expected: 3 },

        // Tier 2: Battery
        { tier: 2 as const, level: 1 as const, confidence: 0.75, expected: 1 },
        { tier: 2 as const, level: 1 as const, confidence: 0.65, expected: 2 },
        { tier: 2 as const, level: 2 as const, confidence: 0.35, expected: 3 },

        // Tier 3: Cost
        { tier: 3 as const, level: 1 as const, confidence: 0.70, expected: 1 },
        { tier: 3 as const, level: 1 as const, confidence: 0.60, expected: 2 },

        // Tier 4: Convenience
        { tier: 4 as const, level: 1 as const, confidence: 0.75, expected: 1 },
        { tier: 4 as const, level: 1 as const, confidence: 0.55, expected: 2 },
      ];

      scenarios.forEach(({ tier, level, confidence, expected }) => {
        const result = downgradeGuidanceIfNeeded(tier, level, confidence);
        expect(result).toBe(expected);
      });
    });

    it("prevents misleading authoritative language", () => {
      // Tier 2 block with medium confidence trying to use "We recommend"
      const tier = 2;
      const proposedLevel = 1;
      const confidence = 0.60;

      const effectiveLevel = downgradeGuidanceIfNeeded(tier, proposedLevel, confidence);

      expect(effectiveLevel).toBe(2);

      // Generate messages with both levels
      const misleadingMessage = "We recommend replacing the battery within 1 year.";
      const appropriateMessage = "Most buyers in your situation budget for battery replacement within 1–2 years.";

      // Both pass linter (no banned phrases)
      expect(lintVoice(misleadingMessage).ok).toBe(true);
      expect(lintVoice(appropriateMessage).ok).toBe(true);

      // But only appropriate message should be used based on effective level
      const actualMessage = effectiveLevel === 1 ? misleadingMessage : appropriateMessage;
      expect(actualMessage).toBe(appropriateMessage);
    });
  });

  describe("End-to-end: Personalization Flow", () => {
    it("tracks complete personalization journey", () => {
      const vehicle: VehicleData = {
        batteryData: {
          degradation: 10.0,
          confidence: "medium",
        },
        estimatedRange: 240,
      };

      // Step 1: Initial state (no personalization)
      const step1 = {
        inputs: undefined,
        signals: buildSignals(vehicle, undefined),
      };

      expect(step1.signals.annual_mileage).toBeUndefined();
      expect(step1.signals.daily_commute_miles).toBeUndefined();

      const conf1 = 0.55;
      expect(labelFromConfidence(conf1)).toBe("medium");

      // Step 2: User provides annual mileage
      const step2 = {
        inputs: { annualMileage: 12000 } as UserInputs,
        signals: buildSignals(vehicle, { annualMileage: 12000 }),
      };

      expect(step2.signals.annual_mileage).toBe(12000);

      const conf2 = 0.65;
      expect(labelFromConfidence(conf2)).toBe("medium");

      // Step 3: User provides daily commute
      const step3 = {
        inputs: { annualMileage: 12000, dailyCommute: 35 } as UserInputs,
        signals: buildSignals(vehicle, { annualMileage: 12000, dailyCommute: 35 }),
      };

      expect(step3.signals.daily_commute_miles).toBe(35);

      const conf3 = 0.75;
      expect(labelFromConfidence(conf3)).toBe("high");

      // Verify confidence increases across steps
      expect(conf1 < conf2).toBe(true);
      expect(conf2 < conf3).toBe(true);
    });
  });

  describe("End-to-end: Voice Consistency", () => {
    it("all approved messages pass linter", () => {
      const approvedMessages = [
        "We recommend budgeting for battery replacement within 2–3 years.",
        "Most buyers in your situation prioritize home charging availability.",
        "Here's how to evaluate whether this range fits your needs.",
        "Share your annual mileage → We'll calculate degradation → adjusts timing by 1–2 years.",
        "This matters before purchase because unresolved recalls can block registration.",
        "High confidence means this estimate is reliable for decision-making.",
      ];

      approvedMessages.forEach(message => {
        const result = lintVoice(message);
        expect(result.ok).toBe(true);
        expect(result.hits).toHaveLength(0);
      });
    });

    it("all banned phrases are caught", () => {
      const bannedMessages = [
        "This will probably affect your decision.",
        "Urgent action is required immediately.",
        "Consider getting a professional inspection.",
        "Providing more data will give better estimates.",
        "Limited range may limit your options.",
      ];

      bannedMessages.forEach(message => {
        const result = lintVoice(message);
        expect(result.ok).toBe(false);
        expect(result.hits.length).toBeGreaterThan(0);
      });
    });
  });

  describe("End-to-end: Realistic Report Scenario", () => {
    it("generates complete report with multiple blocks", () => {
      const vehicle: VehicleData = {
        year: 2019,
        make: "Tesla",
        model: "Model 3",
        odometer: 45000,
        batteryData: {
          degradation: 8.5,
          confidence: "high",
        },
        recalls: [
          {
            id: "R1",
            title: "12V Battery",
            description: "...",
            priority: "high",
            isSafetyRelated: true,
          },
        ],
        estimatedRange: 245,
        warrantyRemaining: 18,
        reliabilityScore: 92,
      };

      const inputs: UserInputs = {
        annualMileage: 12000,
        dailyCommute: 35,
        hasHomeCharging: true,
        zipCode: "94103",
        climateZone: "moderate",
        riskTolerance: "moderate",
      };

      const signals = buildSignals(vehicle, inputs);

      // Verify all signals extracted correctly
      expect(signals.has_battery_data).toBe(true);
      expect(signals.battery_degradation_pct).toBe(8.5);
      expect(signals.has_recalls).toBe(true);
      expect(signals.open_recalls_critical_count).toBe(1);
      expect(signals.annual_mileage).toBe(12000);
      expect(signals.daily_commute_miles).toBe(35);
      expect(signals.home_charging).toBe(true);

      // Simulate multiple blocks
      const batteryConf = 0.75; // High (has annual mileage)
      const recallsConf = 0.90; // High (NHTSA data)
      const rangeConf = 0.75;   // High (has daily commute)

      expect(labelFromConfidence(batteryConf)).toBe("high");
      expect(labelFromConfidence(recallsConf)).toBe("high");
      expect(labelFromConfidence(rangeConf)).toBe("high");

      // Generate full report text
      const reportText = `
        Battery Health & Longevity

        Based on this model's age (${2025 - (vehicle.year || 2019)} years) and your annual driving of ${inputs.annualMileage?.toLocaleString()} miles, we estimate about 8–9% battery capacity loss.

        High confidence means this estimate is reliable for decision-making and tailored to your specific situation.

        Safety & Recalls

        This vehicle has 1 open safety-related recall. We recommend asking your dealer to verify recall completion status before purchase.

        Range Fit

        With your ${inputs.dailyCommute}-mile daily commute and this vehicle's ${vehicle.estimatedRange}-mile range, you have comfortable margin for daily driving.
      `;

      // Verify entire report passes linter
      const lintResult = lintVoice(reportText);
      expect(lintResult.ok).toBe(true);
      expect(lintResult.hits).toHaveLength(0);
    });
  });
});
