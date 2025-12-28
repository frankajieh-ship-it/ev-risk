/**
 * Signals Adapter Tests
 *
 * Tests for signal extraction and type safety
 */

import {
  buildSignals,
  hasAllSignals,
  missingSignals,
  getSignal,
  hasAnySignal,
  missingFromGroup,
  isGroupComplete,
  signalGroups,
  type SignalMap,
  type SignalKey,
} from "@/core/signals";
import type { VehicleData, UserInputs } from "@/types";

describe("Signals Adapter", () => {
  describe("buildSignals", () => {
    it("extracts battery signals from vehicle data", () => {
      const vehicle: VehicleData = {
        batteryData: {
          degradation: 12.4,
          confidence: "medium",
        },
        batteryHealthReport: true,
      };

      const signals = buildSignals(vehicle);

      expect(signals.has_battery_data).toBe(true);
      expect(signals.battery_degradation_pct).toBe(12.4);
      expect(signals.has_battery_health_report).toBe(true);
    });

    it("extracts recall signals from vehicle data", () => {
      const vehicle: VehicleData = {
        recalls: [
          { id: "R1", title: "Airbag", description: "...", priority: "high", isSafetyRelated: true },
          { id: "R2", title: "Software", description: "...", priority: "low" },
        ],
      };

      const signals = buildSignals(vehicle);

      expect(signals.has_recalls).toBe(true);
      expect(signals.open_recalls_critical_count).toBe(1);
    });

    it("extracts usage signals from user inputs", () => {
      const vehicle: VehicleData = { odometer: 45000 };
      const inputs: UserInputs = {
        annualMileage: 12000,
        dailyCommute: 30,
      };

      const signals = buildSignals(vehicle, inputs);

      expect(signals.annual_mileage).toBe(12000);
      expect(signals.daily_commute_miles).toBe(30);
      expect(signals.vehicle_mileage).toBe(45000);
    });

    it("extracts charging signals from user inputs", () => {
      const vehicle: VehicleData = {
        chargingCompatibility: "CCS",
      };
      const inputs: UserInputs = {
        hasHomeCharging: true,
      };

      const signals = buildSignals(vehicle, inputs);

      expect(signals.home_charging).toBe(true);
      expect(signals.charging_compatibility).toBe("CCS");
    });

    it("extracts location signals from user inputs", () => {
      const vehicle: VehicleData = {};
      const inputs: UserInputs = {
        zipCode: "94103",
        climateZone: "moderate",
      };

      const signals = buildSignals(vehicle, inputs);

      expect(signals.zip_code).toBe("94103");
      expect(signals.climate_zone).toBe("moderate");
    });

    it("extracts cost/warranty signals", () => {
      const vehicle: VehicleData = {
        warrantyRemaining: 24,
      };
      const inputs: UserInputs = {
        riskTolerance: "conservative",
      };

      const signals = buildSignals(vehicle, inputs);

      expect(signals.warranty_remaining_months).toBe(24);
      expect(signals.risk_tolerance).toBe("conservative");
    });

    it("handles missing data gracefully", () => {
      const vehicle: VehicleData = {};
      const signals = buildSignals(vehicle);

      expect(signals.has_battery_data).toBe(false);
      expect(signals.battery_degradation_pct).toBeUndefined();
      expect(signals.has_recalls).toBe(false);
      expect(signals.open_recalls_critical_count).toBe(0);
    });

    it("handles missing user inputs gracefully", () => {
      const vehicle: VehicleData = {};
      const signals = buildSignals(vehicle, undefined);

      expect(signals.annual_mileage).toBeUndefined();
      expect(signals.daily_commute_miles).toBeUndefined();
      expect(signals.home_charging).toBeUndefined();
    });

    it("calculates stranded risk score from reliability score", () => {
      const vehicle: VehicleData = {
        reliabilityScore: 85,
      };

      const signals = buildSignals(vehicle);

      expect(signals.stranded_risk_score).toBe(15); // 100 - 85
    });

    it("handles known failure modes", () => {
      const vehicle: VehicleData = {
        knownIssues: [
          { title: "12V battery", severity: "high", description: "..." },
          { title: "Door handles", severity: "medium", description: "..." },
          { title: "Paint chips", severity: "low", description: "..." },
        ],
      };

      const signals = buildSignals(vehicle);

      expect(signals.known_failure_modes_count).toBe(1); // Only high severity
    });
  });

  describe("hasAllSignals", () => {
    it("returns true when all required signals are present", () => {
      const signals: SignalMap = {
        has_battery_data: true,
        battery_degradation_pct: 12.4,
      } as SignalMap;

      const required: SignalKey[] = ["has_battery_data", "battery_degradation_pct"];

      expect(hasAllSignals(signals, required)).toBe(true);
    });

    it("returns false when any required signal is missing", () => {
      const signals: SignalMap = {
        has_battery_data: true,
      } as SignalMap;

      const required: SignalKey[] = ["has_battery_data", "battery_degradation_pct"];

      expect(hasAllSignals(signals, required)).toBe(false);
    });

    it("returns false when signal is null", () => {
      const signals: SignalMap = {
        has_battery_data: true,
        battery_degradation_pct: null,
      } as SignalMap;

      const required: SignalKey[] = ["has_battery_data", "battery_degradation_pct"];

      expect(hasAllSignals(signals, required)).toBe(false);
    });

    it("returns true for empty required list", () => {
      const signals: SignalMap = {} as SignalMap;
      expect(hasAllSignals(signals, [])).toBe(true);
    });
  });

  describe("missingSignals", () => {
    it("returns empty array when all signals present", () => {
      const signals: SignalMap = {
        has_battery_data: true,
        battery_degradation_pct: 12.4,
      } as SignalMap;

      const required: SignalKey[] = ["has_battery_data", "battery_degradation_pct"];

      expect(missingSignals(signals, required)).toEqual([]);
    });

    it("returns missing signal keys", () => {
      const signals: SignalMap = {
        has_battery_data: true,
      } as SignalMap;

      const required: SignalKey[] = [
        "has_battery_data",
        "battery_degradation_pct",
        "annual_mileage",
      ];

      const missing = missingSignals(signals, required);

      expect(missing).toEqual(["battery_degradation_pct", "annual_mileage"]);
    });

    it("treats null/undefined as missing", () => {
      const signals: SignalMap = {
        has_battery_data: true,
        battery_degradation_pct: null,
        annual_mileage: undefined,
      } as SignalMap;

      const required: SignalKey[] = [
        "has_battery_data",
        "battery_degradation_pct",
        "annual_mileage",
      ];

      const missing = missingSignals(signals, required);

      expect(missing).toEqual(["battery_degradation_pct", "annual_mileage"]);
    });
  });

  describe("getSignal", () => {
    it("returns signal value when present", () => {
      const signals: SignalMap = {
        battery_degradation_pct: 12.4,
      } as SignalMap;

      expect(getSignal(signals, "battery_degradation_pct")).toBe(12.4);
    });

    it("returns fallback when signal missing", () => {
      const signals: SignalMap = {} as SignalMap;

      expect(getSignal(signals, "battery_degradation_pct", 10.0)).toBe(10.0);
    });

    it("returns fallback when signal is null", () => {
      const signals: SignalMap = {
        battery_degradation_pct: null,
      } as SignalMap;

      expect(getSignal(signals, "battery_degradation_pct", 10.0)).toBe(10.0);
    });

    it("returns undefined when no fallback and signal missing", () => {
      const signals: SignalMap = {} as SignalMap;

      expect(getSignal(signals, "battery_degradation_pct")).toBeUndefined();
    });

    it("preserves boolean false values", () => {
      const signals: SignalMap = {
        home_charging: false,
      } as SignalMap;

      expect(getSignal(signals, "home_charging", true)).toBe(false);
    });

    it("preserves zero values", () => {
      const signals: SignalMap = {
        open_recalls_critical_count: 0,
      } as SignalMap;

      expect(getSignal(signals, "open_recalls_critical_count", 5)).toBe(0);
    });
  });

  describe("hasAnySignal", () => {
    it("returns true when at least one signal is present", () => {
      const signals: SignalMap = {
        annual_mileage: 12000,
      } as SignalMap;

      const keys: SignalKey[] = ["annual_mileage", "daily_commute_miles"];

      expect(hasAnySignal(signals, keys)).toBe(true);
    });

    it("returns false when all signals are missing", () => {
      const signals: SignalMap = {} as SignalMap;

      const keys: SignalKey[] = ["annual_mileage", "daily_commute_miles"];

      expect(hasAnySignal(signals, keys)).toBe(false);
    });

    it("returns false for empty key list", () => {
      const signals: SignalMap = {
        annual_mileage: 12000,
      } as SignalMap;

      expect(hasAnySignal(signals, [])).toBe(false);
    });
  });

  describe("Signal groups", () => {
    it("defines battery signal group", () => {
      expect(signalGroups.battery).toEqual([
        "has_battery_data",
        "has_battery_health_report",
        "battery_degradation_pct",
        "battery_confidence_source",
      ]);
    });

    it("defines personalization signal group", () => {
      expect(signalGroups.personalization).toContain("annual_mileage");
      expect(signalGroups.personalization).toContain("daily_commute_miles");
      expect(signalGroups.personalization).toContain("home_charging");
    });

    it("defines safety signal group", () => {
      expect(signalGroups.safety).toEqual([
        "has_recalls",
        "open_recalls_count",
        "open_recalls_critical_count",
        "recall_completion_verified",
        "known_failure_modes_count",
      ]);
    });

    it("defines reliability signal group", () => {
      expect(signalGroups.reliability).toContain("has_service_history");
      expect(signalGroups.reliability).toContain("stranded_risk_score");
    });

    it("defines cost signal group", () => {
      expect(signalGroups.cost).toContain("warranty_remaining_months");
      expect(signalGroups.cost).toContain("risk_tolerance");
    });

    it("defines convenience signal group", () => {
      expect(signalGroups.convenience).toContain("home_charging");
      expect(signalGroups.convenience).toContain("range_adequacy_score");
    });
  });

  describe("missingFromGroup", () => {
    it("returns missing signals from battery group", () => {
      const signals: SignalMap = {
        has_battery_data: true,
      } as SignalMap;

      const missing = missingFromGroup(signals, "battery");

      expect(missing).toEqual([
        "has_battery_health_report",
        "battery_degradation_pct",
        "battery_confidence_source",
      ]);
    });

    it("returns empty array when group is complete", () => {
      const signals: SignalMap = {
        has_battery_data: true,
        has_battery_health_report: true,
        battery_degradation_pct: 12.4,
        battery_confidence_source: "high",
      } as SignalMap;

      const missing = missingFromGroup(signals, "battery");

      expect(missing).toEqual([]);
    });
  });

  describe("isGroupComplete", () => {
    it("returns true when all group signals present", () => {
      const signals: SignalMap = {
        has_battery_data: true,
        has_battery_health_report: true,
        battery_degradation_pct: 12.4,
        battery_confidence_source: "high",
      } as SignalMap;

      expect(isGroupComplete(signals, "battery")).toBe(true);
    });

    it("returns false when any group signal missing", () => {
      const signals: SignalMap = {
        has_battery_data: true,
        battery_degradation_pct: 12.4,
      } as SignalMap;

      expect(isGroupComplete(signals, "battery")).toBe(false);
    });
  });

  describe("Real-world integration", () => {
    it("builds complete signal map from realistic data", () => {
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
          { id: "R1", title: "12V battery", description: "...", priority: "high" },
        ],
        reliabilityScore: 92,
        warrantyRemaining: 18,
        chargingCompatibility: "CCS",
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

      // Battery signals
      expect(signals.has_battery_data).toBe(true);
      expect(signals.battery_degradation_pct).toBe(8.5);

      // Usage signals
      expect(signals.annual_mileage).toBe(12000);
      expect(signals.daily_commute_miles).toBe(35);
      expect(signals.vehicle_mileage).toBe(45000);

      // Recall signals
      expect(signals.has_recalls).toBe(true);
      expect(signals.open_recalls_critical_count).toBe(1);

      // Charging signals
      expect(signals.home_charging).toBe(true);
      expect(signals.charging_compatibility).toBe("CCS");

      // Location signals
      expect(signals.zip_code).toBe("94103");
      expect(signals.climate_zone).toBe("moderate");

      // Cost/warranty signals
      expect(signals.warranty_remaining_months).toBe(18);
      expect(signals.risk_tolerance).toBe("moderate");

      // Calculated signals
      expect(signals.stranded_risk_score).toBe(8); // 100 - 92
    });

    it("identifies missing personalization signals", () => {
      const vehicle: VehicleData = {
        batteryData: { degradation: 10.0 },
      };

      const inputs: UserInputs = {
        annualMileage: 12000,
        // Missing: dailyCommute, hasHomeCharging, climateZone, zipCode, riskTolerance
      };

      const signals = buildSignals(vehicle, inputs);
      const missing = missingFromGroup(signals, "personalization");

      expect(missing).toContain("daily_commute_miles");
      expect(missing).toContain("home_charging");
      expect(missing).toContain("climate_zone");
      expect(missing).toContain("zip_code");
      expect(missing).toContain("risk_tolerance");
    });
  });
});
