/**
 * Confidence Label Consistency Tests
 *
 * Tests that confidence labels match the dynamic confidence scores
 * Prevents mismatches between confidence() and confidenceFrame.label
 */

import { labelFromConfidence, confidencePresets } from "@/core/templates";
import { buildSignals } from "@/core/signals";
import type { VehicleData, UserInputs } from "@/types";
import type { Block, RenderCtx } from "@/core/content";

describe("Confidence Label Consistency", () => {
  describe("Dynamic confidence matches label", () => {
    it("ensures label is derived from confidence score, not hardcoded", () => {
      // Create a mock block with dynamic confidence
      const mockBlock: Block = {
        id: "test.block.v1",
        tier: 2,
        priority: 100,
        guidanceLevel: 1,

        // Dynamic confidence that changes based on inputs
        confidence: (ctx: RenderCtx) => {
          const base = 0.55;
          const bonus = ctx.signals.annual_mileage ? 0.20 : 0;
          return base + bonus;
        },

        // Confidence frame MUST use labelFromConfidence(confidence(ctx))
        confidenceFrame: (ctx: RenderCtx) => {
          const conf = mockBlock.confidence(ctx);
          const label = labelFromConfidence(conf);

          return {
            label,
            practical: `Confidence is ${conf.toFixed(2)}`,
            basedOn: [],
            missing: [],
            affects: [],
            notAffects: [],
          };
        },
      } as unknown as Block;

      // Test WITHOUT personalization
      const vehicle1: VehicleData = {};
      const ctx1: RenderCtx = {
        vehicle: vehicle1,
        inputs: undefined,
        signals: buildSignals(vehicle1, undefined),
      };

      const conf1 = mockBlock.confidence(ctx1);
      const frame1 = mockBlock.confidenceFrame(ctx1);

      expect(conf1).toBe(0.55);
      expect(frame1.label).toBe("medium");
      expect(labelFromConfidence(conf1)).toBe(frame1.label);

      // Test WITH personalization
      const vehicle2: VehicleData = {};
      const inputs2: UserInputs = { annualMileage: 12000 };
      const ctx2: RenderCtx = {
        vehicle: vehicle2,
        inputs: inputs2,
        signals: buildSignals(vehicle2, inputs2),
      };

      const conf2 = mockBlock.confidence(ctx2);
      const frame2 = mockBlock.confidenceFrame(ctx2);

      expect(conf2).toBe(0.75);
      expect(frame2.label).toBe("high");
      expect(labelFromConfidence(conf2)).toBe(frame2.label);
    });

    it("detects mismatch when label is hardcoded", () => {
      // BAD EXAMPLE: Static label that doesn't match dynamic confidence
      const badBlock: Block = {
        id: "bad.block.v1",
        tier: 2,
        priority: 100,
        guidanceLevel: 1,

        confidence: (ctx: RenderCtx) => {
          return ctx.signals.annual_mileage ? 0.75 : 0.55;
        },

        // ❌ BAD: Label is hardcoded to "medium" even when confidence is 0.75
        confidenceFrame: () => ({
          label: "medium", // ← Hardcoded, doesn't change
          practical: "static",
          basedOn: [],
          missing: [],
          affects: [],
          notAffects: [],
        }),
      } as unknown as Block;

      const vehicle: VehicleData = {};
      const inputs: UserInputs = { annualMileage: 12000 };
      const ctx: RenderCtx = {
        vehicle,
        inputs,
        signals: buildSignals(vehicle, inputs),
      };

      const conf = badBlock.confidence(ctx);
      const frame = badBlock.confidenceFrame(ctx);
      const expectedLabel = labelFromConfidence(conf);

      expect(conf).toBe(0.75);
      expect(expectedLabel).toBe("high");
      expect(frame.label).toBe("medium"); // ❌ Mismatch!

      // This test demonstrates the mismatch
      expect(frame.label).not.toBe(expectedLabel);
    });

    it("all confidence thresholds produce correct labels", () => {
      const testCases = [
        { confidence: 0.0, expectedLabel: "low" },
        { confidence: 0.39, expectedLabel: "low" },
        { confidence: 0.40, expectedLabel: "medium" },
        { confidence: 0.55, expectedLabel: "medium" },
        { confidence: 0.69, expectedLabel: "medium" },
        { confidence: 0.70, expectedLabel: "high" },
        { confidence: 0.85, expectedLabel: "high" },
        { confidence: 1.0, expectedLabel: "high" },
      ];

      testCases.forEach(({ confidence, expectedLabel }) => {
        const mockBlock: Block = {
          id: "test.block.v1",
          tier: 2,
          priority: 100,
          guidanceLevel: 1,

          confidence: () => confidence,

          confidenceFrame: (ctx: RenderCtx) => {
            const conf = mockBlock.confidence(ctx);
            return {
              label: labelFromConfidence(conf),
              practical: "",
              basedOn: [],
              missing: [],
              affects: [],
              notAffects: [],
            };
          },
        } as unknown as Block;

        const ctx: RenderCtx = {
          vehicle: {},
          inputs: undefined,
          signals: buildSignals({}, undefined),
        };

        const frame = mockBlock.confidenceFrame(ctx);
        expect(frame.label).toBe(expectedLabel);
      });
    });
  });

  describe("Confidence preset usage", () => {
    it("uses confidencePresets correctly", () => {

      // Test battery health preset
      const batteryFrameWithoutMileage = confidencePresets.batteryHealth(false);
      expect(batteryFrameWithoutMileage.label).toBe("medium");

      const batteryFrameWithMileage = confidencePresets.batteryHealth(true);
      expect(batteryFrameWithMileage.label).toBe("high");

      // Test recalls preset
      const recallsFrame = confidencePresets.recalls(false);
      expect(recallsFrame.label).toBe("high");

      const recallsFrameVerified = confidencePresets.recalls(true);
      expect(recallsFrameVerified.label).toBe("high");

      // Test range fit preset
      const rangeWithoutCommute = confidencePresets.rangeFit(false);
      expect(rangeWithoutCommute.label).toBe("medium");

      const rangeWithCommute = confidencePresets.rangeFit(true);
      expect(rangeWithCommute.label).toBe("high");
    });

    it("preset labels match confidence calculations", () => {

      // Battery health: 0.55 without mileage, 0.75 with mileage
      const batteryWithout = confidencePresets.batteryHealth(false);
      expect(batteryWithout.label).toBe(labelFromConfidence(0.55));

      const batteryWith = confidencePresets.batteryHealth(true);
      expect(batteryWith.label).toBe(labelFromConfidence(0.75));

      // Range fit: 0.50 without commute, 0.75 with commute
      const rangeWithout = confidencePresets.rangeFit(false);
      expect(rangeWithout.label).toBe(labelFromConfidence(0.50));

      const rangeWith = confidencePresets.rangeFit(true);
      expect(rangeWith.label).toBe(labelFromConfidence(0.75));
    });
  });

  describe("Real-world block examples", () => {
    it("battery health block maintains label consistency", () => {
      const mockBatteryBlock: Block = {
        id: "battery.health.metric.v1",
        tier: 2,
        priority: 100,
        guidanceLevel: 1,

        confidence: (ctx: RenderCtx) => {
          const base = 0.55;
          const hasAnnualMileage = Boolean(ctx.signals.annual_mileage);
          return base + (hasAnnualMileage ? 0.20 : 0);
        },

        confidenceFrame: (ctx: RenderCtx) => {
              const hasAnnualMileage = Boolean(ctx.signals.annual_mileage);
          return confidencePresets.batteryHealth(hasAnnualMileage);
        },
      } as unknown as Block;

      // Without annual mileage
      const ctx1: RenderCtx = {
        vehicle: {},
        inputs: undefined,
        signals: buildSignals({}, undefined),
      };

      const conf1 = mockBatteryBlock.confidence(ctx1);
      const frame1 = mockBatteryBlock.confidenceFrame(ctx1);

      expect(conf1).toBe(0.55);
      expect(frame1.label).toBe("medium");
      expect(labelFromConfidence(conf1)).toBe(frame1.label);

      // With annual mileage
      const ctx2: RenderCtx = {
        vehicle: {},
        inputs: { annualMileage: 12000 },
        signals: buildSignals({}, { annualMileage: 12000 }),
      };

      const conf2 = mockBatteryBlock.confidence(ctx2);
      const frame2 = mockBatteryBlock.confidenceFrame(ctx2);

      expect(conf2).toBe(0.75);
      expect(frame2.label).toBe("high");
      expect(labelFromConfidence(conf2)).toBe(frame2.label);
    });

    it("recalls block maintains high confidence consistently", () => {
      const mockRecallsBlock: Block = {
        id: "recalls.safety.v1",
        tier: 1,
        priority: 200,
        guidanceLevel: 1,

        confidence: () => 0.90, // Always high

        confidenceFrame: (ctx: RenderCtx) => {
              const hasVerification = Boolean(ctx.signals.dealer_verification);
          return confidencePresets.recalls(hasVerification);
        },
      } as unknown as Block;

      const ctx: RenderCtx = {
        vehicle: { recalls: [{ id: "R1", title: "Test", description: "", priority: "high" }] },
        inputs: undefined,
        signals: buildSignals({ recalls: [{ id: "R1", title: "Test", description: "", priority: "high" }] }, undefined),
      };

      const conf = mockRecallsBlock.confidence(ctx);
      const frame = mockRecallsBlock.confidenceFrame(ctx);

      expect(conf).toBe(0.90);
      expect(frame.label).toBe("high");
      expect(labelFromConfidence(conf)).toBe(frame.label);
    });
  });

  describe("Edge cases", () => {
    it("handles confidence at exact boundaries", () => {
      const boundaries = [
        { conf: 0.3999, label: "low" },
        { conf: 0.40, label: "medium" },
        { conf: 0.6999, label: "medium" },
        { conf: 0.70, label: "high" },
      ];

      boundaries.forEach(({ conf, label }) => {
        const mockBlock: Block = {
          id: "test.v1",
          tier: 2,
          priority: 100,
          guidanceLevel: 1,
          confidence: () => conf,
          confidenceFrame: (ctx: RenderCtx) => ({
            label: labelFromConfidence(mockBlock.confidence(ctx)),
            practical: "",
            basedOn: [],
            missing: [],
            affects: [],
            notAffects: [],
          }),
        } as unknown as Block;

        const ctx: RenderCtx = {
          vehicle: {},
          inputs: undefined,
          signals: buildSignals({}, undefined),
        };

        const frame = mockBlock.confidenceFrame(ctx);
        expect(frame.label).toBe(label);
      });
    });

    it("handles floating point precision issues", () => {
      // Test that 0.69999999999 is treated as < 0.70
      const mockBlock: Block = {
        id: "test.v1",
        tier: 2,
        priority: 100,
        guidanceLevel: 1,
        confidence: () => 0.69999999999,
        confidenceFrame: (ctx: RenderCtx) => ({
          label: labelFromConfidence(mockBlock.confidence(ctx)),
          practical: "",
          basedOn: [],
          missing: [],
          affects: [],
          notAffects: [],
        }),
      } as unknown as Block;

      const ctx: RenderCtx = {
        vehicle: {},
        inputs: undefined,
        signals: buildSignals({}, undefined),
      };

      const frame = mockBlock.confidenceFrame(ctx);
      expect(frame.label).toBe("medium");
    });
  });
});
