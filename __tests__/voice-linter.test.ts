/**
 * Voice Linter Tests
 *
 * Tests for banned phrase detection in report text
 */

import { lintVoice } from "@/debug/voiceLinter";

describe("Voice Linter", () => {
  describe("Banned phrase detection", () => {
    it('detects "Urgent" in old recalls text', () => {
      const oldRecallsText = "2 open recalls detected. 1 critical. Urgent action recommended.";
      const result = lintVoice(oldRecallsText);

      expect(result.ok).toBe(false);
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0]).toMatchObject({
        rule: 'BANNED: "Urgent"',
        match: "Urgent",
      });
      expect(result.hits[0].index).toBeGreaterThan(0);
    });

    it('detects "Probably" in text', () => {
      const text = "This will probably affect your battery replacement timeline.";
      const result = lintVoice(text);

      expect(result.ok).toBe(false);
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0]).toMatchObject({
        rule: 'BANNED: "Probably"',
        match: "probably",
      });
    });

    it('detects "Consider" in text', () => {
      const text = "Consider asking the dealer for verification.";
      const result = lintVoice(text);

      expect(result.ok).toBe(false);
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0]).toMatchObject({
        rule: 'BANNED: "Consider"',
        match: "Consider",
      });
    });

    it('detects "Better estimates" in text', () => {
      const text = "Providing your mileage will give better estimates.";
      const result = lintVoice(text);

      expect(result.ok).toBe(false);
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0]).toMatchObject({
        rule: 'BANNED: "Better estimates"',
        match: "better estimates",
      });
    });

    it('detects "May limit" in text', () => {
      const text = "This may limit your options for long trips.";
      const result = lintVoice(text);

      expect(result.ok).toBe(false);
      expect(result.hits).toHaveLength(1);
      expect(result.hits[0]).toMatchObject({
        rule: 'BANNED: "May limit" (without calibration)',
        match: "may limit",
      });
    });

    it("detects multiple banned phrases in single text", () => {
      const text = "This will probably affect you. Consider checking urgently.";
      const result = lintVoice(text);

      expect(result.ok).toBe(false);
      expect(result.hits.length).toBeGreaterThanOrEqual(2);

      const rules = result.hits.map(h => h.rule);
      expect(rules).toContain('BANNED: "Probably"');
      expect(rules).toContain('BANNED: "Consider"');
    });

    it("is case-insensitive for single-word bans", () => {
      const variations = [
        "URGENT action needed",
        "urgent action needed",
        "Urgent action needed",
      ];

      variations.forEach(text => {
        const result = lintVoice(text);
        expect(result.ok).toBe(false);
        expect(result.hits[0].rule).toBe('BANNED: "Urgent"');
      });
    });
  });

  describe("Allowed text patterns", () => {
    it("passes clean report text", () => {
      const cleanText = `
        Based on this model's age and average use, we estimate about 12–13% battery capacity loss.
        This means your current range is roughly 230–235 miles (down from the original 263 miles).

        High confidence means this estimate is reliable based on verifiable data, though not personalized to your usage.
      `;

      const result = lintVoice(cleanText);
      expect(result.ok).toBe(true);
      expect(result.hits).toHaveLength(0);
    });

    it("passes text with action-oriented language", () => {
      const text = "We recommend asking your dealer to verify recall completion status before purchase.";
      const result = lintVoice(text);

      expect(result.ok).toBe(true);
      expect(result.hits).toHaveLength(0);
    });

    it("passes text with calibrated urgency", () => {
      const text = "This matters before purchase because unresolved recalls can block registration.";
      const result = lintVoice(text);

      expect(result.ok).toBe(true);
      expect(result.hits).toHaveLength(0);
    });

    it("passes personalization value props", () => {
      const text = "Share your annual mileage → We'll calculate your specific degradation → which adjusts replacement timing by roughly 1–2 years.";
      const result = lintVoice(text);

      expect(result.ok).toBe(true);
      expect(result.hits).toHaveLength(0);
    });
  });

  describe("Edge cases", () => {
    it("handles empty text", () => {
      const result = lintVoice("");
      expect(result.ok).toBe(true);
      expect(result.hits).toHaveLength(0);
    });

    it("handles text with partial matches that should not trigger", () => {
      // "urgency" contains "urgent" but is a different word
      const text = "The urgency of this situation requires calibration.";
      const result = lintVoice(text);

      // Should not match because of word boundary
      expect(result.ok).toBe(true);
    });

    it("handles text with numbers and special characters", () => {
      const text = "Battery: 87.6% SOH. Range: 230 mi. Cost: $25,000.";
      const result = lintVoice(text);

      expect(result.ok).toBe(true);
      expect(result.hits).toHaveLength(0);
    });
  });

  describe("Real-world examples", () => {
    it("OLD recalls text fails linter", () => {
      const oldText = "2 open recalls detected. 1 critical. Urgent action recommended.";
      const result = lintVoice(oldText);

      expect(result.ok).toBe(false);
      expect(result.hits.some(h => h.rule === 'BANNED: "Urgent"')).toBe(true);
    });

    it("NEW recalls text passes linter", () => {
      const newText = `
        This vehicle has 2 open recalls (1 safety-related).

        We recommend asking your dealer to verify recall completion status before purchase.
        This matters before purchase because unresolved safety recalls can block registration.
      `;

      const result = lintVoice(newText);
      expect(result.ok).toBe(true);
      expect(result.hits).toHaveLength(0);
    });

    it("OLD battery health text fails linter", () => {
      const oldText = "Battery degradation estimated at 12.4% based on mileage proxy. Confidence: Medium. Better estimates available with service records.";
      const result = lintVoice(oldText);

      expect(result.ok).toBe(false);
      expect(result.hits.some(h => h.rule === 'BANNED: "Better estimates"')).toBe(true);
    });

    it("NEW battery health text passes linter", () => {
      const newText = `
        Based on this model's age (5 years) and average use, we estimate about 12–13% battery capacity loss.
        This means your current range is roughly 230–235 miles (down from the original 263 miles).

        High confidence means this estimate is reliable based on verifiable data, though not personalized to your usage.

        Share your annual mileage → We'll calculate your specific degradation pattern → which adjusts replacement timing by roughly 1–2 years.
      `;

      const result = lintVoice(newText);
      expect(result.ok).toBe(true);
      expect(result.hits).toHaveLength(0);
    });
  });

  describe("Integration with block system", () => {
    it("detects violations in block rendering output", () => {
      // Simulate a block that accidentally uses banned language
      const blockOutput = {
        title: "Battery Health",
        body: "This will probably need replacement soon. Consider getting an inspection.",
      };

      const fullText = `${blockOutput.title}\n${blockOutput.body}`;
      const result = lintVoice(fullText);

      expect(result.ok).toBe(false);
      expect(result.hits.length).toBeGreaterThanOrEqual(2);

      const rules = result.hits.map(h => h.rule);
      expect(rules).toContain('BANNED: "Probably"');
      expect(rules).toContain('BANNED: "Consider"');
    });

    it("passes blocks using approved patterns", () => {
      const blockOutput = {
        title: "Battery Health & Longevity",
        body: "We recommend budgeting for battery replacement within 2–3 years. This estimate is based on vehicle age and model-level degradation curves.",
      };

      const fullText = `${blockOutput.title}\n${blockOutput.body}`;
      const result = lintVoice(fullText);

      expect(result.ok).toBe(true);
      expect(result.hits).toHaveLength(0);
    });
  });
});
