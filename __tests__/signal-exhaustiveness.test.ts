/**
 * Signal Exhaustiveness System Tests
 *
 * Tests for the single source of truth signal key system
 */

import {
  SIGNAL_KEYS,
  isValidSignalKey,
  buildSignals,
  type SignalKey,
} from "@/core/signals";
import type { VehicleData, UserInputs } from "@/types";

describe("Signal Exhaustiveness System", () => {
  describe("SIGNAL_KEYS constant", () => {
    it("exports a readonly array of signal keys", () => {
      expect(Array.isArray(SIGNAL_KEYS)).toBe(true);
      expect(SIGNAL_KEYS.length).toBeGreaterThan(0);
    });

    it("contains no duplicate keys", () => {
      const uniqueKeys = new Set(SIGNAL_KEYS);
      expect(uniqueKeys.size).toBe(SIGNAL_KEYS.length);
    });

    it("all keys are non-empty strings", () => {
      SIGNAL_KEYS.forEach((key) => {
        expect(typeof key).toBe("string");
        expect(key.length).toBeGreaterThan(0);
      });
    });

    it("follows naming conventions (snake_case)", () => {
      SIGNAL_KEYS.forEach((key) => {
        expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
      });
    });

    it("includes all expected categories", () => {
      const hasCategory = (prefix: string) =>
        SIGNAL_KEYS.some((key) => key.startsWith(prefix));

      expect(hasCategory("has_")).toBe(true); // Boolean presence flags
      expect(hasCategory("battery_")).toBe(true); // Battery signals
      expect(hasCategory("annual_")).toBe(true); // Usage signals
      expect(hasCategory("recall")).toBe(true); // Recall signals
      expect(hasCategory("service_")).toBe(true); // Service signals
      expect(hasCategory("warranty_")).toBe(true); // Warranty signals
      expect(hasCategory("charging_")).toBe(true); // Charging signals
    });
  });

  describe("isValidSignalKey", () => {
    it("returns true for all keys in SIGNAL_KEYS", () => {
      SIGNAL_KEYS.forEach((key) => {
        expect(isValidSignalKey(key)).toBe(true);
      });
    });

    it("returns false for invalid keys", () => {
      const invalidKeys = [
        "invalid_key",
        "foo",
        "bar_baz",
        "not_a_signal",
        "",
        "123",
        "has_",
      ];

      invalidKeys.forEach((key) => {
        expect(isValidSignalKey(key)).toBe(false);
      });
    });

    it("returns false for similar but incorrect keys", () => {
      // Test near-misses
      expect(isValidSignalKey("has_battery")).toBe(false); // Missing _data
      expect(isValidSignalKey("battery_data")).toBe(false); // Missing has_
      expect(isValidSignalKey("Annual_mileage")).toBe(false); // Wrong case
      expect(isValidSignalKey("annual-mileage")).toBe(false); // Wrong separator
    });

    it("type guard narrows string to SignalKey", () => {
      const testKey: string = "has_battery_data";

      if (isValidSignalKey(testKey)) {
        // TypeScript should recognize testKey as SignalKey here
        const signalKey: SignalKey = testKey;
        expect(signalKey).toBe("has_battery_data");
      }
    });
  });

  describe("buildSignals with exhaustive keys", () => {
    it("returns an object with all signal keys", () => {
      const vehicle: VehicleData = {};
      const signals = buildSignals(vehicle);

      // Check that all SIGNAL_KEYS are present
      SIGNAL_KEYS.forEach((key) => {
        expect(key in signals).toBe(true);
      });
    });

    it("no extra keys beyond SIGNAL_KEYS", () => {
      const vehicle: VehicleData = {
        batteryData: { degradation: 10.0 },
      };
      const signals = buildSignals(vehicle);

      const signalKeys = Object.keys(signals);
      signalKeys.forEach((key) => {
        expect(SIGNAL_KEYS).toContain(key as SignalKey);
      });
    });

    it("populates has_* flags correctly", () => {
      const vehicle: VehicleData = {
        batteryData: { degradation: 10.0 },
        recalls: [{ id: "R1", title: "Test", description: "", priority: "high" }],
        odometer: 45000,
      };

      const inputs: UserInputs = {
        annualMileage: 12000,
        dailyCommute: 30,
      };

      const signals = buildSignals(vehicle, inputs);

      // Battery
      expect(signals.has_battery_data).toBe(true);
      expect(signals.battery_degradation_pct).toBe(10.0);

      // Usage
      expect(signals.has_annual_mileage).toBe(true);
      expect(signals.annual_mileage).toBe(12000);
      expect(signals.has_daily_commute).toBe(true);
      expect(signals.daily_commute_miles).toBe(30);

      // Recalls
      expect(signals.has_recalls).toBe(true);
      expect(signals.open_recalls_count).toBe(1);
      expect(signals.open_recalls_critical_count).toBe(1);

      // Vehicle
      expect(signals.has_vehicle_mileage).toBe(true);
      expect(signals.vehicle_mileage).toBe(45000);
    });

    it("sets has_* flags to false when data missing", () => {
      const vehicle: VehicleData = {};
      const signals = buildSignals(vehicle, undefined);

      expect(signals.has_battery_data).toBe(false);
      expect(signals.has_annual_mileage).toBe(false);
      expect(signals.has_daily_commute).toBe(false);
      expect(signals.has_home_charging).toBe(false);
      expect(signals.has_climate_zone).toBe(false);
      expect(signals.has_service_history).toBe(false);
      expect(signals.has_vehicle_mileage).toBe(false);
      expect(signals.has_warranty_info).toBe(false);
      expect(signals.has_charging_compatibility).toBe(false);
      expect(signals.has_range_data).toBe(false);
    });

    it("extracts new signal keys not in original system", () => {
      const vehicle: VehicleData = {
        batteryData: { degradation: 10.0, confidence: "high" },
        serviceRecords: [
          { date: "2023-01-01", type: "Maintenance", mileage: 30000 },
          { date: "2023-06-01", type: "Repair", mileage: 35000 },
        ],
      };

      const signals = buildSignals(vehicle);

      // New keys
      expect(signals.battery_confidence_source).toBe("high");
      expect(signals.service_record_count).toBe(2);
      expect(signals.has_battery_health_report).toBeDefined();
    });
  });

  describe("Type safety", () => {
    it("SignalKey type includes all SIGNAL_KEYS", () => {
      // This is a compile-time test, but we can verify at runtime
      const testKeys: SignalKey[] = [
        "has_battery_data",
        "battery_degradation_pct",
        "annual_mileage",
        "has_recalls",
        "warranty_remaining_months",
      ];

      testKeys.forEach((key) => {
        expect(SIGNAL_KEYS).toContain(key);
      });
    });

    it("SignalMap requires all signal keys", () => {
      const vehicle: VehicleData = {};
      const signals = buildSignals(vehicle);

      // All SIGNAL_KEYS should be in the map
      SIGNAL_KEYS.forEach((key) => {
        expect(signals).toHaveProperty(key);
      });
    });
  });

  describe("Signal categorization", () => {
    it("battery signals are properly categorized", () => {
      const batterySignals = SIGNAL_KEYS.filter(
        (key) =>
          key.startsWith("battery_") ||
          key.startsWith("has_battery")
      );

      expect(batterySignals).toContain("has_battery_data");
      expect(batterySignals).toContain("has_battery_health_report");
      expect(batterySignals).toContain("battery_degradation_pct");
      expect(batterySignals).toContain("battery_confidence_source");
      expect(batterySignals.length).toBe(4);
    });

    it("recall signals are properly categorized", () => {
      const recallSignals = SIGNAL_KEYS.filter(
        (key) =>
          key.includes("recall") ||
          key.startsWith("open_recalls")
      );

      expect(recallSignals).toContain("has_recalls");
      expect(recallSignals).toContain("open_recalls_count");
      expect(recallSignals).toContain("open_recalls_critical_count");
      expect(recallSignals).toContain("recall_completion_verified");
      expect(recallSignals.length).toBe(4);
    });

    it("personalization signals are properly categorized", () => {
      const personalizationSignals = SIGNAL_KEYS.filter(
        (key) =>
          key.includes("annual") ||
          key.includes("daily") ||
          key.includes("climate") ||
          key.includes("home_charging")
      );

      expect(personalizationSignals.length).toBeGreaterThan(0);
      expect(personalizationSignals).toContain("has_annual_mileage");
      expect(personalizationSignals).toContain("annual_mileage");
      expect(personalizationSignals).toContain("has_daily_commute");
      expect(personalizationSignals).toContain("daily_commute_miles");
    });
  });

  describe("Backward compatibility", () => {
    it("maintains old signal keys for compatibility", () => {
      // Old keys that should still work
      const oldKeys: SignalKey[] = [
        "has_battery_data",
        "battery_degradation_pct",
        "annual_mileage",
        "daily_commute_miles",
        "has_recalls",
        "home_charging",
        "climate_zone",
        "zip_code",
        "warranty_remaining_months",
        "risk_tolerance",
        "range_adequacy_score",
        "dealer_verification",
      ];

      oldKeys.forEach((key) => {
        expect(SIGNAL_KEYS).toContain(key);
      });
    });

    it("old code using legacy keys still works", () => {
      const vehicle: VehicleData = {
        batteryData: { degradation: 10.0 },
      };

      const inputs: UserInputs = {
        annualMileage: 12000,
      };

      const signals = buildSignals(vehicle, inputs);

      // Old-style access still works
      expect(signals.battery_degradation_pct).toBe(10.0);
      expect(signals.annual_mileage).toBe(12000);
    });
  });

  describe("Edge cases", () => {
    it("handles empty vehicle and inputs", () => {
      const signals = buildSignals({}, undefined);

      // All keys should exist but be falsy/undefined
      SIGNAL_KEYS.forEach((key) => {
        expect(key in signals).toBe(true);
      });
    });

    it("handles partial data gracefully", () => {
      const vehicle: VehicleData = {
        batteryData: { degradation: 10.0 },
        // Missing: recalls, serviceRecords, etc.
      };

      const signals = buildSignals(vehicle);

      expect(signals.has_battery_data).toBe(true);
      expect(signals.has_recalls).toBe(false);
      expect(signals.has_service_history).toBe(false);
    });

    it("handles boolean false values correctly", () => {
      const inputs: UserInputs = {
        hasHomeCharging: false, // Explicitly false
      };

      const signals = buildSignals({}, inputs);

      expect(signals.has_home_charging).toBe(true); // Presence flag is true because value is explicitly set
      expect(signals.home_charging).toBe(false); // Actual value is false
    });

    it("distinguishes between undefined and explicitly set values", () => {
      const vehicle: VehicleData = {
        odometer: 0, // Explicitly 0
      };

      const signals = buildSignals(vehicle);

      expect(signals.has_vehicle_mileage).toBe(true); // Presence flag is true because value is explicitly set
      expect(signals.vehicle_mileage).toBe(0); // Actual value is 0
    });
  });

  describe("Documentation and discoverability", () => {
    it("SIGNAL_KEYS provides runtime introspection", () => {
      // Can iterate over all keys programmatically
      const keysByCategory = {
        battery: [] as string[],
        recall: [] as string[],
        usage: [] as string[],
        other: [] as string[],
      };

      SIGNAL_KEYS.forEach((key) => {
        if (key.includes("battery")) {
          keysByCategory.battery.push(key);
        } else if (key.includes("recall")) {
          keysByCategory.recall.push(key);
        } else if (key.includes("annual") || key.includes("daily")) {
          keysByCategory.usage.push(key);
        } else {
          keysByCategory.other.push(key);
        }
      });

      expect(keysByCategory.battery.length).toBeGreaterThan(0);
      expect(keysByCategory.recall.length).toBeGreaterThan(0);
      expect(keysByCategory.usage.length).toBeGreaterThan(0);
    });

    it("can generate signal documentation from SIGNAL_KEYS", () => {
      const docs = SIGNAL_KEYS.map((key) => ({
        key,
        category: key.split("_")[0],
        isPresenceFlag: key.startsWith("has_"),
      }));

      expect(docs.length).toBe(SIGNAL_KEYS.length);

      const presenceFlags = docs.filter((d) => d.isPresenceFlag);
      expect(presenceFlags.length).toBeGreaterThan(0);
    });
  });
});
