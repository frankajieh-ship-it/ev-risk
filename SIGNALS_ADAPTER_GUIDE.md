# Signals Adapter & Confidence Guards Guide

**Date**: 2025-12-28
**Status**: ✅ Complete
**Philosophy**: Type-safe signals + confidence-appropriate messaging

---

## Overview

The Signals Adapter provides:

1. **Type-Safe Signal Keys** - No more typos, autocomplete everywhere
2. **Central Signal Extraction** - One place to map raw data → signals
3. **Confidence Guards** - Automatic enforcement of confidence-appropriate messaging
4. **Signal Groups** - Pre-defined groups for common patterns

---

## Part 1: Signals Adapter

### Problem

Before, blocks accessed data inconsistently:

```typescript
// ❌ BAD: Direct access, no type safety
if (vehicle?.batteryData) { ... }
if (inputs?.annualMileage) { ... }
if (vehicle?.recalls?.length > 0) { ... }
```

**Issues**:
- Typos not caught (`anualMileage` vs `annualMileage`)
- Inconsistent null checks
- Duplicate signal extraction logic

### Solution: Typed Signal Keys + Adapter

**Location**: [core/signals.ts](core/signals.ts)

```typescript
import { buildSignals, getSignal, hasAllSignals, type SignalKey } from "@/core/signals";

// Type-safe signal keys
type SignalKey =
  | "has_battery_data"
  | "battery_degradation_pct"
  | "annual_mileage"
  | "has_recalls"
  // ... 20 total signals

// Build signals from raw data
const signals = buildSignals(vehicle, inputs);

// Access with type safety
const hasBattery = signals.has_battery_data;  // ✅ Typed
const mileage = getSignal(signals, "annual_mileage", 0); // ✅ With fallback
```

---

### Signal Categories

**Battery Signals**:
- `has_battery_data`
- `battery_degradation_pct`
- `battery_health_report`

**Usage Signals**:
- `annual_mileage`
- `daily_commute_miles`
- `vehicle_mileage`

**Recall Signals**:
- `has_recalls`
- `recall_critical_count`

**Charging Signals**:
- `home_charging`
- `charging_compatibility`

**Location/Climate Signals**:
- `climate_zone`
- `zip_code`

**Cost/Warranty Signals**:
- `warranty_remaining_months`
- `risk_tolerance`

**...and 10 more** (see [core/signals.ts](core/signals.ts) for full list)

---

### Core Adapter Functions

#### 1. `buildSignals(vehicle, inputs)`

Extracts all signals from raw data:

```typescript
import { buildSignals } from "@/core/signals";
import type { VehicleData, UserInputs } from "@/types";

const vehicle: VehicleData = {
  batteryData: { degradation: 12, confidence: "medium" },
  recalls: [{ id: "R1", priority: "high" }],
  odometer: 45000,
};

const inputs: UserInputs = {
  annualMileage: 12000,
  hasHomeCharging: true,
};

const signals = buildSignals(vehicle, inputs);
// {
//   has_battery_data: true,
//   battery_degradation_pct: 12,
//   annual_mileage: 12000,
//   has_recalls: true,
//   recall_critical_count: 1,
//   home_charging: true,
//   // ... all other signals
// }
```

---

#### 2. `getSignal(signals, key, fallback?)`

Get signal with type-safe fallback:

```typescript
import { getSignal } from "@/core/signals";

// With fallback
const mileage = getSignal(signals, "annual_mileage", 0);
// Type: number (fallback ensures non-null)

// Without fallback
const climate = getSignal(signals, "climate_zone");
// Type: string | undefined
```

---

#### 3. `hasAllSignals(signals, required)`

Check if all required signals present:

```typescript
import { hasAllSignals } from "@/core/signals";

const required: SignalKey[] = ["has_battery_data", "annual_mileage"];

if (hasAllSignals(signals, required)) {
  // Safe to access both signals
  const degradation = signals.battery_degradation_pct;
  const mileage = signals.annual_mileage;
}
```

---

#### 4. `missingSignals(signals, required)`

Get list of missing signals:

```typescript
import { missingSignals } from "@/core/signals";

const required: SignalKey[] = ["has_battery_data", "annual_mileage", "climate_zone"];
const missing = missingSignals(signals, required);
// ["climate_zone"] (if only climate_zone is missing)
```

---

### Signal Groups

Pre-defined groups for common patterns:

```typescript
import { signalGroups, isGroupComplete, missingFromGroup } from "@/core/signals";

// Check if entire group is complete
const hasBatteryGroup = isGroupComplete(signals, "battery");
// Checks: has_battery_data, battery_degradation_pct, battery_health_report

// Get missing signals from group
const missingBattery = missingFromGroup(signals, "battery");
// ["battery_health_report"] (if only that is missing)
```

**Available groups**:
- `battery` - Battery-related signals
- `personalization` - User input signals
- `safety` - Safety-related signals
- `reliability` - Reliability signals
- `cost` - Cost exposure signals
- `convenience` - Convenience/fit signals

---

### Usage in Blocks

**Before** (untyped):

```typescript
{
  confidence: (ctx) => {
    const base = 0.6;
    const bonus = ctx.inputs?.annualMileage ? 0.1 : 0; // ❌ Untyped, can typo
    return clamp01(base + bonus);
  },
}
```

**After** (typed):

```typescript
{
  requiredSignals: ["has_battery_data"] as SignalKey[], // ✅ Type-checked

  confidence: (ctx) => {
    const base = 0.6;
    const bonus = getSignal(ctx.signals, "annual_mileage") ? 0.1 : 0; // ✅ Type-safe
    return clamp01(base + bonus);
  },

  confidenceFrame: (ctx) => {
    const hasMileage = Boolean(getSignal(ctx.signals, "annual_mileage")); // ✅ Typed
    return confidencePresets.batteryHealth(hasMileage);
  },
}
```

---

## Part 2: Confidence Guards

### Problem

Blocks could claim high confidence but use vague language:

```typescript
// ❌ BAD: Mismatch
{
  confidence: () => 0.45, // Low-medium confidence
  guidanceLevel: 1,       // "We recommend" (authoritative)
  // This is misleading!
}
```

### Solution: Automatic Guards

**Location**: [core/templates.ts](core/templates.ts)

---

### Guard 1: `labelFromConfidence(score)`

Ensures consistent labeling:

```typescript
import { labelFromConfidence } from "@/core/templates";

const label = labelFromConfidence(0.75); // "high"
const label = labelFromConfidence(0.55); // "medium"
const label = labelFromConfidence(0.30); // "low"
```

**Thresholds**:
- **≥ 0.70**: "high"
- **0.40 - 0.69**: "medium"
- **< 0.40**: "low"

**Usage**:

```typescript
confidenceFrame: (ctx) => {
  const score = ctx.confidence(ctx);
  const label = labelFromConfidence(score); // ✅ Consistent

  return createConfidenceFrame({
    label,
    // ...
  });
},
```

---

### Guard 2: `downgradeGuidanceIfNeeded(tier, proposedLevel, confidence)`

Prevents misleading authoritative language:

```typescript
import { downgradeGuidanceIfNeeded } from "@/core/templates";

// Example: Battery block (Tier 2) with 55% confidence
const proposedLevel = 1; // "We recommend"
const confidence = 0.55;

const actualLevel = downgradeGuidanceIfNeeded(2, proposedLevel, confidence);
// Returns: 2 ("Most buyers in your situation...")
// Reason: Tier 2+ with < 0.70 confidence cannot use level 1
```

**Rules**:

1. **Non-Tier 1 blocks cannot use authoritative language (level 1) with < 0.70 confidence**
   ```typescript
   // ❌ BAD: Tier 2 block with medium confidence claiming authority
   tier: 2,
   guidanceLevel: 1, // "We recommend"
   confidence: () => 0.55,

   // ✅ GOOD: Automatically downgraded to level 2
   const level = downgradeGuidanceIfNeeded(2, 1, 0.55);
   // Returns: 2 ("Most buyers in your situation...")
   ```

2. **Very low confidence (< 0.40) forces evaluation framing (level 3)**
   ```typescript
   // ❌ BAD: Low confidence with recommendation language
   guidanceLevel: 1, // "We recommend"
   confidence: () => 0.35,

   // ✅ GOOD: Automatically downgraded to level 3
   const level = downgradeGuidanceIfNeeded(2, 1, 0.35);
   // Returns: 3 ("Here's how to evaluate...")
   ```

3. **Tier 1 safety issues can remain firm even with medium confidence**
   ```typescript
   // ✅ ALLOWED: Safety (Tier 1) can use level 1 with medium confidence
   tier: 1,
   guidanceLevel: 1, // "We recommend"
   confidence: () => 0.60,

   const level = downgradeGuidanceIfNeeded(1, 1, 0.60);
   // Returns: 1 (unchanged - safety exception)
   ```

---

### Automatic Enforcement

**In BlockRenderer** (future enhancement):

```typescript
// BlockRenderer.tsx (enhanced)
const confidence = block.confidence(ctx);
const effectiveGuidance = downgradeGuidanceIfNeeded(
  block.tier,
  block.guidanceLevel,
  confidence
);

const prefix = guidancePrefix(effectiveGuidance);
// Automatically uses downgraded level if needed
```

---

## Part 3: Integration Examples

### Example 1: Battery Block with Guards

```typescript
{
  id: "battery.health.metric.v1",
  tier: 2,
  priority: 10,
  guidanceLevel: 2, // Proposed level

  // ✅ Type-safe signals
  requiredSignals: ["has_battery_data", "battery_degradation_pct"] as SignalKey[],

  // ✅ Dynamic confidence
  confidence: (ctx) => {
    const base = 0.55; // Medium
    const bonus = getSignal(ctx.signals, "annual_mileage") ? 0.15 : 0;
    return clamp01(base + bonus);
    // Without mileage: 0.55 (medium)
    // With mileage: 0.70 (high)
  },

  // ✅ Consistent labeling
  confidenceFrame: (ctx) => {
    const score = ctx.confidence(ctx);
    const label = labelFromConfidence(score); // "medium" or "high"
    const hasMileage = Boolean(getSignal(ctx.signals, "annual_mileage"));

    return createConfidenceFrame({
      label, // ✅ Consistent with score
      hasPersonalization: hasMileage,
      specificData: ["your annual mileage"],
      genericData: ["vehicle battery data"],
      affects: ["replacement timing"],
      notAffects: ["immediate safety"],
    });
  },

  // ✅ Guidance automatically downgraded if confidence < 0.70
  // proposedLevel: 2 → actualLevel: 2 (if conf ≥ 0.40)
  // proposedLevel: 2 → actualLevel: 3 (if conf < 0.40)
}
```

---

### Example 2: Recalls Block (Tier 1 Exception)

```typescript
{
  id: "recalls.safety.text.v1",
  tier: 1, // ✅ Safety tier
  priority: 5,
  guidanceLevel: 1, // "We recommend"

  requiredSignals: ["has_recalls"] as SignalKey[],

  confidence: () => 0.90, // High

  confidenceFrame: (ctx) => {
    const hasVerification = Boolean(getSignal(ctx.signals, "dealer_verification"));
    return confidencePresets.recalls(hasVerification);
  },

  // ✅ Tier 1 can use level 1 even with medium confidence (safety exception)
  // If confidence were 0.60, downgradeGuidanceIfNeeded(1, 1, 0.60) → 1 (unchanged)
}
```

---

### Example 3: Low Confidence Block

```typescript
{
  id: "cost.exposure.metric.v1",
  tier: 3,
  priority: 10,
  guidanceLevel: 1, // Proposed: "We recommend"

  requiredSignals: [] as SignalKey[], // No hard requirements

  confidence: (ctx) => {
    // Low confidence (no personalization)
    const base = 0.30;
    const bonus = getSignal(ctx.signals, "risk_tolerance") ? 0.15 : 0;
    return clamp01(base + bonus);
    // Without risk tolerance: 0.30 (low)
    // With risk tolerance: 0.45 (medium)
  },

  confidenceFrame: (ctx) => {
    const score = ctx.confidence(ctx);
    const label = labelFromConfidence(score); // "low" or "medium"

    return createConfidenceFrame({
      label,
      hasPersonalization: Boolean(getSignal(ctx.signals, "risk_tolerance")),
      specificData: ["your risk tolerance", "your budget"],
      genericData: ["typical costs", "warranty coverage"],
      affects: ["financial planning"],
      notAffects: ["safety"],
    });
  },

  // ✅ Automatic downgrade:
  // If conf = 0.30: downgradeGuidanceIfNeeded(3, 1, 0.30) → 3 ("Here's how to evaluate...")
  // If conf = 0.45: downgradeGuidanceIfNeeded(3, 1, 0.45) → 2 ("Most buyers...")
}
```

---

## Part 4: Migration from Old System

### Before: Untyped, Inconsistent

```typescript
// ❌ OLD
{
  confidence: (ctx) => {
    const base = 0.6;
    if (ctx.inputs?.annualMileage) base += 0.1; // Typo risk
    return base;
  },

  confidenceFrame: (ctx) => ({
    label: "medium", // Manual, might not match score
    practical: "...",
    basedOn: ctx.inputs?.annualMileage
      ? ["vehicle data", "your mileage"]
      : ["vehicle data"],
    missing: ["your mileage"], // Might be wrong
    affects: ["timing"],
    notAffects: ["safety"],
  }),

  render: (ctx) => {
    if (ctx.vehicle?.batteryData) {
      return "We recommend..."; // Might be too authoritative
    }
  },
}
```

---

### After: Typed, Consistent, Guarded

```typescript
// ✅ NEW
{
  requiredSignals: ["has_battery_data"] as SignalKey[], // Type-checked

  confidence: (ctx) => {
    const base = 0.6;
    const bonus = getSignal(ctx.signals, "annual_mileage") ? 0.1 : 0; // Type-safe
    return clamp01(base + bonus);
  },

  confidenceFrame: (ctx) => {
    const score = ctx.confidence(ctx);
    const label = labelFromConfidence(score); // ✅ Consistent
    const hasMileage = Boolean(getSignal(ctx.signals, "annual_mileage"));

    return confidencePresets.batteryHealth(hasMileage); // ✅ Pre-built
  },

  render: (ctx) => {
    const conf = ctx.confidence(ctx);
    const effectiveLevel = downgradeGuidanceIfNeeded(2, 1, conf); // ✅ Guarded
    const prefix = guidancePrefix(effectiveLevel);

    return `${prefix} confirming battery health before purchase.`;
    // "We recommend" if conf ≥ 0.70
    // "Most buyers in your situation" if 0.40 ≤ conf < 0.70
    // "Here's how to evaluate" if conf < 0.40
  },
}
```

---

## Part 5: Best Practices

### DO: Use Signal Types Everywhere

```typescript
// ✅ GOOD
requiredSignals: ["has_battery_data", "annual_mileage"] as SignalKey[],

// ❌ BAD
requiredSignals: ["batteryData", "annualMileage"], // No type checking
```

### DO: Use getSignal() with Fallbacks

```typescript
// ✅ GOOD: Safe with fallback
const mileage = getSignal(signals, "annual_mileage", 0);

// ❌ BAD: Might be undefined
const mileage = signals.annual_mileage || 0;
```

### DO: Use labelFromConfidence()

```typescript
// ✅ GOOD: Consistent thresholds
const label = labelFromConfidence(score);

// ❌ BAD: Inconsistent manual logic
const label = score > 0.7 ? "high" : score > 0.5 ? "medium" : "low";
```

### DO: Apply Guidance Guards

```typescript
// ✅ GOOD: Auto-downgrade
const level = downgradeGuidanceIfNeeded(tier, proposedLevel, confidence);

// ❌ BAD: Manually checking
if (confidence < 0.70 && tier >= 2) {
  // Manual downgrade logic (error-prone)
}
```

### DON'T: Access Raw Data Directly

```typescript
// ❌ BAD: Bypasses signal adapter
if (ctx.vehicle?.batteryData?.degradation) { ... }

// ✅ GOOD: Use signals
if (signals.has_battery_data) { ... }
```

---

## Part 6: Testing

### Test: Signal Extraction

```typescript
import { buildSignals } from "@/core/signals";

test("extracts battery signals", () => {
  const vehicle = {
    batteryData: { degradation: 12, confidence: "medium" },
  };

  const signals = buildSignals(vehicle, {});

  expect(signals.has_battery_data).toBe(true);
  expect(signals.battery_degradation_pct).toBe(12);
});

test("extracts recall signals", () => {
  const vehicle = {
    recalls: [
      { id: "R1", priority: "high" },
      { id: "R2", priority: "low" },
    ],
  };

  const signals = buildSignals(vehicle, {});

  expect(signals.has_recalls).toBe(true);
  expect(signals.recall_critical_count).toBe(1); // Only high priority
});
```

### Test: Confidence Guards

```typescript
import { labelFromConfidence, downgradeGuidanceIfNeeded } from "@/core/templates";

test("labelFromConfidence thresholds", () => {
  expect(labelFromConfidence(0.75)).toBe("high");
  expect(labelFromConfidence(0.55)).toBe("medium");
  expect(labelFromConfidence(0.30)).toBe("low");
  expect(labelFromConfidence(0.70)).toBe("high"); // Boundary
  expect(labelFromConfidence(0.40)).toBe("medium"); // Boundary
});

test("downgradeGuidanceIfNeeded rules", () => {
  // Rule 1: Tier 2+ with < 0.70 cannot use level 1
  expect(downgradeGuidanceIfNeeded(2, 1, 0.65)).toBe(2);
  expect(downgradeGuidanceIfNeeded(2, 1, 0.75)).toBe(1); // OK

  // Rule 2: < 0.40 forces level 3
  expect(downgradeGuidanceIfNeeded(2, 2, 0.35)).toBe(3);
  expect(downgradeGuidanceIfNeeded(2, 1, 0.30)).toBe(3);

  // Rule 3: Tier 1 exception
  expect(downgradeGuidanceIfNeeded(1, 1, 0.60)).toBe(1); // Unchanged
});
```

### Test: Signal Groups

```typescript
import { signalGroups, isGroupComplete, missingFromGroup } from "@/core/signals";

test("battery group completeness", () => {
  const signals = buildSignals({
    batteryData: { degradation: 12 },
    batteryHealthReport: true,
  }, {});

  expect(isGroupComplete(signals, "battery")).toBe(true);
  expect(missingFromGroup(signals, "battery")).toEqual([]);
});

test("personalization group missing", () => {
  const signals = buildSignals({}, {
    annualMileage: 12000,
  });

  const missing = missingFromGroup(signals, "personalization");
  expect(missing).toContain("daily_commute_miles");
  expect(missing).toContain("home_charging");
});
```

---

## Summary

**Files Created**:
- [types/index.ts](types/index.ts) - VehicleData + UserInputs types
- [core/signals.ts](core/signals.ts) - Signal adapter + utilities
- [SIGNALS_ADAPTER_GUIDE.md](SIGNALS_ADAPTER_GUIDE.md) - This guide

**Files Enhanced**:
- [core/content.ts](core/content.ts) - Updated RenderCtx to use SignalMap
- [core/templates.ts](core/templates.ts) - Added confidence guards
- [core/blocks/sampleBlocks.ts](core/blocks/sampleBlocks.ts) - Uses typed signals

**Benefits**:
- ✅ Type safety: No more typos in signal names
- ✅ Consistency: labelFromConfidence() ensures uniform thresholds
- ✅ Honesty: downgradeGuidanceIfNeeded() prevents misleading language
- ✅ Centralization: One place to map raw data → signals
- ✅ Testability: Signal groups make testing easier

---

**Implemented**: 2025-12-28
**Status**: ✅ Complete
**Impact**: Type-safe signals + confidence-appropriate messaging
