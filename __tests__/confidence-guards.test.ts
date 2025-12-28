/**
 * Confidence Guards Tests
 *
 * Tests for labelFromConfidence() and downgradeGuidanceIfNeeded()
 */

import { labelFromConfidence, downgradeGuidanceIfNeeded } from "@/core/templates";

describe("Confidence Guards", () => {
  describe("labelFromConfidence", () => {
    it("returns 'high' for confidence >= 0.70", () => {
      expect(labelFromConfidence(0.70)).toBe("high");
      expect(labelFromConfidence(0.75)).toBe("high");
      expect(labelFromConfidence(0.90)).toBe("high");
      expect(labelFromConfidence(1.0)).toBe("high");
    });

    it("returns 'medium' for confidence 0.40-0.69", () => {
      expect(labelFromConfidence(0.40)).toBe("medium");
      expect(labelFromConfidence(0.50)).toBe("medium");
      expect(labelFromConfidence(0.65)).toBe("medium");
      expect(labelFromConfidence(0.69)).toBe("medium");
    });

    it("returns 'low' for confidence < 0.40", () => {
      expect(labelFromConfidence(0.39)).toBe("low");
      expect(labelFromConfidence(0.30)).toBe("low");
      expect(labelFromConfidence(0.10)).toBe("low");
      expect(labelFromConfidence(0.0)).toBe("low");
    });

    it("handles boundary cases correctly", () => {
      // Boundary at 0.70
      expect(labelFromConfidence(0.70)).toBe("high");
      expect(labelFromConfidence(0.6999)).toBe("medium");

      // Boundary at 0.40
      expect(labelFromConfidence(0.40)).toBe("medium");
      expect(labelFromConfidence(0.3999)).toBe("low");
    });
  });

  describe("downgradeGuidanceIfNeeded", () => {
    describe("Rule 1: Non-Tier 1 blocks cannot use level 1 with < 0.70 confidence", () => {
      it("downgrades Tier 2 level 1 to level 2 when confidence < 0.70", () => {
        expect(downgradeGuidanceIfNeeded(2, 1, 0.65)).toBe(2);
        expect(downgradeGuidanceIfNeeded(2, 1, 0.50)).toBe(2);
        expect(downgradeGuidanceIfNeeded(2, 1, 0.40)).toBe(2);
      });

      it("allows Tier 2 level 1 when confidence >= 0.70", () => {
        expect(downgradeGuidanceIfNeeded(2, 1, 0.70)).toBe(1);
        expect(downgradeGuidanceIfNeeded(2, 1, 0.80)).toBe(1);
        expect(downgradeGuidanceIfNeeded(2, 1, 0.90)).toBe(1);
      });

      it("downgrades Tier 3 and Tier 4 level 1 when confidence < 0.70", () => {
        expect(downgradeGuidanceIfNeeded(3, 1, 0.65)).toBe(2);
        expect(downgradeGuidanceIfNeeded(4, 1, 0.65)).toBe(2);
      });

      it("does not affect level 2 or level 3 (only level 1 downgraded)", () => {
        expect(downgradeGuidanceIfNeeded(2, 2, 0.65)).toBe(2);
        expect(downgradeGuidanceIfNeeded(2, 3, 0.65)).toBe(3);
      });
    });

    describe("Rule 2: Very low confidence (< 0.40) forces level 3", () => {
      it("downgrades level 1 to level 3 when confidence < 0.40", () => {
        expect(downgradeGuidanceIfNeeded(2, 1, 0.35)).toBe(3);
        expect(downgradeGuidanceIfNeeded(2, 1, 0.30)).toBe(3);
        expect(downgradeGuidanceIfNeeded(2, 1, 0.10)).toBe(3);
      });

      it("downgrades level 2 to level 3 when confidence < 0.40", () => {
        expect(downgradeGuidanceIfNeeded(2, 2, 0.35)).toBe(3);
        expect(downgradeGuidanceIfNeeded(3, 2, 0.30)).toBe(3);
      });

      it("keeps level 3 unchanged", () => {
        expect(downgradeGuidanceIfNeeded(2, 3, 0.35)).toBe(3);
        expect(downgradeGuidanceIfNeeded(2, 3, 0.10)).toBe(3);
      });

      it("applies to all tiers when confidence < 0.40", () => {
        expect(downgradeGuidanceIfNeeded(1, 1, 0.35)).toBe(3);
        expect(downgradeGuidanceIfNeeded(2, 1, 0.35)).toBe(3);
        expect(downgradeGuidanceIfNeeded(3, 1, 0.35)).toBe(3);
        expect(downgradeGuidanceIfNeeded(4, 1, 0.35)).toBe(3);
      });
    });

    describe("Rule 3: Tier 1 safety exception", () => {
      it("allows Tier 1 level 1 even with medium confidence", () => {
        expect(downgradeGuidanceIfNeeded(1, 1, 0.60)).toBe(1);
        expect(downgradeGuidanceIfNeeded(1, 1, 0.50)).toBe(1);
        expect(downgradeGuidanceIfNeeded(1, 1, 0.40)).toBe(1);
      });

      it("still applies Rule 2 to Tier 1 (< 0.40 forces level 3)", () => {
        expect(downgradeGuidanceIfNeeded(1, 1, 0.35)).toBe(3);
        expect(downgradeGuidanceIfNeeded(1, 1, 0.30)).toBe(3);
      });

      it("only applies to Tier 1, not other tiers", () => {
        // Tier 1: Allowed with 0.60
        expect(downgradeGuidanceIfNeeded(1, 1, 0.60)).toBe(1);

        // Tier 2+: Downgraded with 0.60
        expect(downgradeGuidanceIfNeeded(2, 1, 0.60)).toBe(2);
        expect(downgradeGuidanceIfNeeded(3, 1, 0.60)).toBe(2);
        expect(downgradeGuidanceIfNeeded(4, 1, 0.60)).toBe(2);
      });
    });

    describe("Combined scenarios", () => {
      it("Tier 2 block with 0.65 confidence: level 1 → 2", () => {
        const proposedLevel = 1; // "We recommend"
        const effectiveLevel = downgradeGuidanceIfNeeded(2, proposedLevel, 0.65);
        expect(effectiveLevel).toBe(2); // "Most buyers in your situation..."
      });

      it("Tier 1 block with 0.65 confidence: level 1 stays 1 (safety exception)", () => {
        const proposedLevel = 1;
        const effectiveLevel = downgradeGuidanceIfNeeded(1, proposedLevel, 0.65);
        expect(effectiveLevel).toBe(1); // "We recommend" (unchanged)
      });

      it("Tier 3 block with 0.35 confidence: level 2 → 3", () => {
        const proposedLevel = 2; // "Most buyers..."
        const effectiveLevel = downgradeGuidanceIfNeeded(3, proposedLevel, 0.35);
        expect(effectiveLevel).toBe(3); // "Here's how to evaluate..."
      });

      it("Tier 2 block with 0.75 confidence: level 1 stays 1", () => {
        const proposedLevel = 1;
        const effectiveLevel = downgradeGuidanceIfNeeded(2, proposedLevel, 0.75);
        expect(effectiveLevel).toBe(1); // No downgrade
      });
    });

    describe("Edge cases", () => {
      it("handles exact threshold values", () => {
        // 0.70 boundary (Rule 1)
        expect(downgradeGuidanceIfNeeded(2, 1, 0.70)).toBe(1);
        expect(downgradeGuidanceIfNeeded(2, 1, 0.6999)).toBe(2);

        // 0.40 boundary (Rule 2)
        expect(downgradeGuidanceIfNeeded(2, 2, 0.40)).toBe(2);
        expect(downgradeGuidanceIfNeeded(2, 2, 0.3999)).toBe(3);
      });

      it("handles extreme confidence values", () => {
        expect(downgradeGuidanceIfNeeded(2, 1, 0.0)).toBe(3);
        expect(downgradeGuidanceIfNeeded(2, 1, 1.0)).toBe(1);
      });
    });
  });

  describe("Integration: labelFromConfidence + downgradeGuidanceIfNeeded", () => {
    it("label and guidance level are consistent", () => {
      // High confidence (≥ 0.70)
      const highScore = 0.75;
      expect(labelFromConfidence(highScore)).toBe("high");
      expect(downgradeGuidanceIfNeeded(2, 1, highScore)).toBe(1); // Can use level 1

      // Medium confidence (0.40-0.69)
      const medScore = 0.55;
      expect(labelFromConfidence(medScore)).toBe("medium");
      expect(downgradeGuidanceIfNeeded(2, 1, medScore)).toBe(2); // Downgraded to level 2

      // Low confidence (< 0.40)
      const lowScore = 0.30;
      expect(labelFromConfidence(lowScore)).toBe("low");
      expect(downgradeGuidanceIfNeeded(2, 1, lowScore)).toBe(3); // Downgraded to level 3
    });
  });
});
