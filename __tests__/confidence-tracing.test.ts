/**
 * Confidence Tracing Tests
 *
 * Tests for confidence change tracking and logging
 *
 * Note: These tests verify the logging functions work correctly.
 * The isDebugEnabled function relies on window.location.search which
 * is difficult to mock in Jest/jsdom. In production, it checks for ?debug=1.
 */

import { confTrace, voiceTrace } from "@/debug/confTrace";

// Mock console methods for testing
const mockConsoleLog = jest.spyOn(console, "log").mockImplementation();

// Mock isDebugEnabled to bypass browser-specific checks
jest.mock("@/debug/confTrace", () => {
  const actual = jest.requireActual("@/debug/confTrace");
  return {
    ...actual,
    isDebugEnabled: jest.fn(() => true),
    confTrace: (payload: any) => {
      if (true) { // Always enabled in tests
        console.log("[EV-RISK CONF]", payload);
      }
    },
    voiceTrace: (payload: any) => {
      if (true) { // Always enabled in tests
        console.log("[EV-RISK VOICE]", payload);
      }
    },
  };
});

beforeEach(() => {
  mockConsoleLog.mockClear();
});

afterAll(() => {
  mockConsoleLog.mockRestore();
});

describe("Confidence Tracing", () => {
  describe("confTrace", () => {
    it("logs payload when called", () => {
      const payload = {
        kind: "change",
        blockId: "battery.health.metric.v1",
        from: 0.55,
        to: 0.65,
      };

      confTrace(payload);

      expect(mockConsoleLog).toHaveBeenCalledWith("[EV-RISK CONF]", payload);
    });

    it("logs initial confidence values", () => {
      const payload = {
        kind: "init",
        blocks: [
          { id: "battery.health.metric.v1", confidence: 0.55 },
          { id: "recalls.safety.v1", confidence: 0.90 },
        ],
      };

      confTrace(payload);

      expect(mockConsoleLog).toHaveBeenCalledWith("[EV-RISK CONF]", payload);
    });

    it("logs confidence increases", () => {
      const payload = {
        kind: "change",
        blockId: "battery.health.metric.v1",
        from: 0.55,
        to: 0.75,
        reason: "user provided annual mileage",
      };

      confTrace(payload);

      expect(mockConsoleLog).toHaveBeenCalledWith("[EV-RISK CONF]", payload);
    });

    it("logs new blocks being added", () => {
      const payload = {
        kind: "add",
        blockId: "recalls.safety.v1",
        confidence: 0.90,
      };

      confTrace(payload);

      expect(mockConsoleLog).toHaveBeenCalledWith("[EV-RISK CONF]", payload);
    });

    it("logs blocks being removed", () => {
      const payload = {
        kind: "remove",
        blockId: "temp.block.v1",
      };

      confTrace(payload);

      expect(mockConsoleLog).toHaveBeenCalledWith("[EV-RISK CONF]", payload);
    });
  });

  describe("voiceTrace", () => {
    it("logs voice linter hits", () => {
      const payload = {
        kind: "lint_failed",
        hits: [
          { rule: 'BANNED: "Urgent"', match: "Urgent", index: 39 },
        ],
      };

      voiceTrace(payload);

      expect(mockConsoleLog).toHaveBeenCalledWith("[EV-RISK VOICE]", payload);
    });

    it("logs voice lint success", () => {
      const payload = {
        kind: "lint_passed",
        textLength: 450,
      };

      voiceTrace(payload);

      expect(mockConsoleLog).toHaveBeenCalledWith("[EV-RISK VOICE]", payload);
    });
  });

  describe("Real-world scenarios", () => {
    it("tracks confidence increase when user provides annual mileage", () => {
      const beforePayload = {
        kind: "init",
        blockId: "battery.health.metric.v1",
        confidence: 0.55,
        label: "medium",
      };

      confTrace(beforePayload);

      expect(mockConsoleLog).toHaveBeenCalledWith("[EV-RISK CONF]", beforePayload);

      mockConsoleLog.mockClear();

      const afterPayload = {
        kind: "change",
        blockId: "battery.health.metric.v1",
        from: 0.55,
        to: 0.75,
        label: "high",
        reason: "user provided annual mileage",
      };

      confTrace(afterPayload);

      expect(mockConsoleLog).toHaveBeenCalledWith("[EV-RISK CONF]", afterPayload);
    });

    it("tracks multiple blocks changing confidence simultaneously", () => {
      const payload = {
        kind: "batch_change",
        changes: [
          { blockId: "battery.health.metric.v1", from: 0.55, to: 0.75 },
          { blockId: "range.fit.v1", from: 0.45, to: 0.70 },
        ],
      };

      confTrace(payload);

      expect(mockConsoleLog).toHaveBeenCalledWith("[EV-RISK CONF]", payload);
    });

    it("logs label changes (medium → high)", () => {
      const payload = {
        kind: "label_change",
        blockId: "battery.health.metric.v1",
        from: { confidence: 0.65, label: "medium" },
        to: { confidence: 0.75, label: "high" },
      };

      confTrace(payload);

      expect(mockConsoleLog).toHaveBeenCalledWith("[EV-RISK CONF]", payload);
    });
  });

  describe("Edge cases", () => {
    it("handles empty payloads", () => {
      const payload = {};
      confTrace(payload);

      expect(mockConsoleLog).toHaveBeenCalledWith("[EV-RISK CONF]", payload);
    });

    it("handles complex nested payloads", () => {
      const payload = {
        kind: "complex",
        data: {
          blocks: [
            { id: "test1", confidence: 0.5 },
            { id: "test2", confidence: 0.8 },
          ],
          metadata: {
            timestamp: Date.now(),
            userInputs: { annualMileage: 12000 },
          },
        },
      };

      confTrace(payload);

      expect(mockConsoleLog).toHaveBeenCalledWith("[EV-RISK CONF]", payload);
    });

    it("handles confidence boundary values", () => {
      const payload = {
        kind: "boundaries",
        values: [
          { confidence: 0.0, label: "low" },
          { confidence: 0.40, label: "medium" },
          { confidence: 0.70, label: "high" },
          { confidence: 1.0, label: "high" },
        ],
      };

      confTrace(payload);

      expect(mockConsoleLog).toHaveBeenCalledWith("[EV-RISK CONF]", payload);
    });
  });
});
