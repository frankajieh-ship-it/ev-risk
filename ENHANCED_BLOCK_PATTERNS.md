# Enhanced Block Patterns Guide

**Date**: 2025-12-28
**Status**: ✅ Complete
**Philosophy**: Production-ready patterns with registry + confidence presets + personalization integration

---

## Overview

This guide documents the enhanced Block system patterns that make development faster and more consistent:

1. **Confidence Frame Factory** - Standardized confidence explanations
2. **Block Registry** - Central discovery and documentation
3. **Personalization Integration** - Connect `ask()` to existing UI

---

## Part 1: Confidence Frame Factory

### Problem

Every block needs a `confidenceFrame`, but writing them manually is:
- Verbose and repetitive
- Inconsistent across blocks
- Error-prone (forgetting fields)

### Solution: `createConfidenceFrame` + Presets

**Location**: [core/templates.ts](core/templates.ts)

```typescript
import { createConfidenceFrame, confidencePresets } from "@/core/templates";

// ✅ GOOD: Use factory
confidenceFrame: (ctx) => {
  const hasMileage = Boolean(ctx.inputs?.annualMileage);
  return confidencePresets.batteryHealth(hasMileage);
},

// ❌ BAD: Manual creation (verbose)
confidenceFrame: (ctx) => ({
  label: "medium",
  practical: "our estimate is directionally useful...",
  basedOn: ["vehicle battery data", "population averages"],
  missing: ["your annual mileage"],
  affects: ["battery replacement timing", "long-term cost exposure"],
  notAffects: ["immediate safety"],
}),
```

---

### Factory API

```typescript
export function createConfidenceFrame(config: {
  label: ConfidenceLabel;
  hasPersonalization: boolean;
  specificData: string[];      // What personalization provides
  genericData: string[];        // What we have without personalization
  affects: string[];
  notAffects: string[];
}): ConfidenceFrame
```

**How it works**:
1. Determines `practical` meaning based on label + personalization
2. Computes `basedOn` = specificData (if personalized) + genericData
3. Computes `missing` = specificData (if NOT personalized)

**Example**:

```typescript
const frame = createConfidenceFrame({
  label: "medium",
  hasPersonalization: false,
  specificData: ["your annual mileage"],
  genericData: ["vehicle battery data", "population averages"],
  affects: ["battery replacement timing"],
  notAffects: ["immediate safety"],
});

// Result:
// {
//   label: "medium",
//   practical: "our estimate is directionally useful but still based on population averages, not your specific context",
//   basedOn: ["vehicle battery data", "population averages"],
//   missing: ["your annual mileage"],
//   affects: ["battery replacement timing"],
//   notAffects: ["immediate safety"]
// }
```

---

### Confidence Presets

**Location**: [core/templates.ts](core/templates.ts) - `confidencePresets` object

Pre-built confidence frames for common patterns:

#### 1. Battery Health

```typescript
confidencePresets.batteryHealth(hasAnnualMileage: boolean): ConfidenceFrame
```

**Usage**:

```typescript
confidenceFrame: (ctx) => {
  const hasMileage = Boolean(ctx.inputs?.annualMileage);
  return confidencePresets.batteryHealth(hasMileage);
},
```

**Output** (without mileage):
- **Label**: medium
- **Practical**: "directionally useful but still based on population averages"
- **Based On**: vehicle battery data, model-level degradation curves, population averages
- **Missing**: your annual mileage, your typical driving patterns
- **Affects**: battery replacement timing, long-term cost exposure, resale value projection
- **Not Affects**: immediate safety, current drivability, warranty coverage

---

#### 2. Recalls

```typescript
confidencePresets.recalls(hasDealerVerification: boolean): ConfidenceFrame
```

**Usage**:

```typescript
confidenceFrame: (ctx) => {
  const hasVerification = Boolean(ctx.inputs?.dealerVerification);
  return confidencePresets.recalls(hasVerification);
},
```

**Output** (always high):
- **Label**: high
- **Practical**: "reliable based on verifiable data, though not personalized to your usage" (without verification)
- **Based On**: reported recall listings, NHTSA recall database
- **Missing**: dealer verification of completion status (if not verified)
- **Affects**: purchase readiness, safety and reliability risk, registration timing
- **Not Affects**: battery degradation estimates, range fit, charging compatibility

---

#### 3. Range Fit

```typescript
confidencePresets.rangeFit(hasDailyCommute: boolean): ConfidenceFrame
```

**Usage**:

```typescript
confidenceFrame: (ctx) => {
  const hasCommute = Boolean(ctx.inputs?.dailyCommute);
  return confidencePresets.rangeFit(hasCommute);
},
```

**Output** (with commute):
- **Label**: high
- **Practical**: "reliable for decision-making and tailored to your specific situation"
- **Based On**: your daily commute distance, your typical weekly mileage, vehicle range specifications
- **Missing**: (none)
- **Affects**: daily usability, charging frequency, range anxiety risk
- **Not Affects**: battery replacement timing, safety, recall status

---

#### 4. Charging Infrastructure

```typescript
confidencePresets.chargingInfra(hasHomeCharging: boolean, hasZipCode: boolean): ConfidenceFrame
```

**Usage**:

```typescript
confidenceFrame: (ctx) => {
  const hasHome = Boolean(ctx.inputs?.homeCharging);
  const hasZip = Boolean(ctx.inputs?.zipCode);
  return confidencePresets.chargingInfra(hasHome, hasZip);
},
```

**Output** (both provided):
- **Label**: high
- **Practical**: "reliable for decision-making and tailored to your specific situation"
- **Based On**: your home charging setup, your location, national charging network coverage
- **Missing**: (none)
- **Affects**: daily convenience, per-mile costs, trip planning requirements
- **Not Affects**: battery health, safety, immediate reliability

---

#### 5. Cost Exposure

```typescript
confidencePresets.costExposure(hasRiskTolerance: boolean): ConfidenceFrame
```

**Usage**:

```typescript
confidenceFrame: (ctx) => {
  const hasRisk = Boolean(ctx.inputs?.riskTolerance);
  return confidencePresets.costExposure(hasRisk);
},
```

**Output** (without risk tolerance):
- **Label**: low
- **Practical**: "uses broad averages and should be validated before making decisions"
- **Based On**: typical maintenance costs, battery replacement probability, warranty coverage
- **Missing**: your budget constraints, your risk tolerance
- **Affects**: financial planning, emergency fund requirements, total cost of ownership
- **Not Affects**: immediate safety, daily drivability

---

### When to Create Custom vs Use Preset

**Use preset when**:
- Block fits one of the 5 common patterns
- Confidence logic is straightforward (binary yes/no personalization)

**Create custom when**:
- Block has unique confidence logic
- Multiple personalization signals with different weights
- Special edge cases

**Example of custom**:

```typescript
confidenceFrame: (ctx) => {
  const hasBatteryReport = Boolean(ctx.vehicle?.batterySOH);
  const hasAnnualMileage = Boolean(ctx.inputs?.annualMileage);
  const hasClimateZone = Boolean(ctx.inputs?.climateZone);

  // Custom logic: needs battery report + at least one personalization
  const label =
    hasBatteryReport && hasAnnualMileage && hasClimateZone ? "high" :
    hasBatteryReport && (hasAnnualMileage || hasClimateZone) ? "medium" : "low";

  return createConfidenceFrame({
    label,
    hasPersonalization: hasAnnualMileage || hasClimateZone,
    specificData: ["your annual mileage", "your climate zone"],
    genericData: ["battery SOH report", "model degradation curves"],
    affects: ["replacement timeline", "warranty coverage"],
    notAffects: ["immediate safety"],
  });
},
```

---

## Part 2: Block Registry

### Problem

As blocks multiply, we need:
- **Discovery**: What blocks exist? What tier?
- **Documentation**: Auto-generate block docs
- **Testing**: Track test coverage
- **Migration**: Track conversion status

### Solution: Central Registry

**Location**: [core/blocks/registry.ts](core/blocks/registry.ts)

```typescript
import { blockRegistry, getImplementedBlocks, getMigrationStatus } from "@/core/blocks/registry";

// Get all implemented blocks
const blocks = getImplementedBlocks();

// Get migration status
const status = getMigrationStatus();
// { total: 8, implemented: 2, planned: 6, percentComplete: 25 }

// Get blocks missing tests
const untested = getBlocksMissingTests();

// Generate markdown docs
const docs = generateRegistryDocs();
```

---

### Registry Structure

Each block has metadata:

```typescript
interface BlockMetadata {
  id: string;
  tier: Tier;
  description: string;
  signalsRequired: string[];
  personalizationSignals?: string[];
  lastUpdated: string;            // ISO date
  status: "implemented" | "planned" | "deprecated";
  version: number;
  migratedFrom?: string;          // Legacy section name
  examples?: string[];
  testCoverage?: boolean;
}
```

**Example**:

```typescript
"battery.health.metric.v1": {
  id: "battery.health.metric.v1",
  tier: 2,
  description: "Battery degradation estimation with replacement timeline",
  signalsRequired: ["batteryData"],
  personalizationSignals: ["annualMileage", "chargingPatterns"],
  lastUpdated: "2025-12-28",
  status: "implemented",
  version: 1,
  migratedFrom: "Battery Health Section (legacy)",
  examples: [
    "12% degradation, medium confidence (no annual mileage)",
    "12% degradation, high confidence (with annual mileage)",
    "No battery data (withheld)",
  ],
  testCoverage: true,
},
```

---

### Registry Utilities

**Get blocks by tier**:

```typescript
import { getBlocksByTier } from "@/core/blocks/registry";

const tier1Blocks = getBlocksByTier(1); // Safety & Reliability
const tier2Blocks = getBlocksByTier(2); // Battery Health
```

**Get blocks by status**:

```typescript
import { getBlocksByStatus } from "@/core/blocks/registry";

const implemented = getBlocksByStatus("implemented");
const planned = getBlocksByStatus("planned");
const deprecated = getBlocksByStatus("deprecated");
```

**Get blocks requiring signal**:

```typescript
import { getBlocksRequiringSignal } from "@/core/blocks/registry";

const batteryBlocks = getBlocksRequiringSignal("batteryData");
const recallBlocks = getBlocksRequiringSignal("recalls");
```

**Migration status**:

```typescript
import { getMigrationStatus } from "@/core/blocks/registry";

const status = getMigrationStatus();
console.log(`Progress: ${status.percentComplete}%`);
console.log(`Remaining: ${status.planned} blocks`);
```

**Test coverage**:

```typescript
import { getTestCoverageStatus, getBlocksMissingTests } from "@/core/blocks/registry";

const coverage = getTestCoverageStatus();
console.log(`Coverage: ${coverage.percentCovered}%`);

const untested = getBlocksMissingTests();
// Returns blocks with status="implemented" but testCoverage=false
```

**Validate block**:

```typescript
import { validateBlock } from "@/core/blocks/registry";

const block: Block = { id: "battery.health.metric.v1", tier: 2, ... };
const { valid, errors } = validateBlock(block);

if (!valid) {
  console.error("Block validation failed:", errors);
}
```

**Generate docs**:

```typescript
import { generateRegistryDocs } from "@/core/blocks/registry";

const markdown = generateRegistryDocs();
// Auto-generated markdown documentation
```

---

### Current Registry Status

**As of 2025-12-28**:

| Status | Count | Percentage |
|--------|-------|------------|
| **Implemented** | 2 | 25% |
| **Planned** | 6 | 75% |
| **Total** | 8 | 100% |

**Implemented**:
- ✅ [recalls.safety.text.v1](core/blocks/sampleBlocks.ts)
- ✅ [battery.health.metric.v1](core/blocks/sampleBlocks.ts)

**Planned** (Tier order):
1. known.failures.text.v1 (Tier 1)
2. battery.trajectory.metric.v1 (Tier 2)
3. warranty.gaps.text.v1 (Tier 3)
4. maintenance.probability.metric.v1 (Tier 3)
5. range.fit.metric.v1 (Tier 4)
6. charging.infra.text.v1 (Tier 4)

---

## Part 3: Personalization Integration

### Problem

The Block `ask()` pattern returns `PersonalizationAsk`, but we need to:
- Connect to existing PersonalizationOpportunityCard
- Show value proposition prominently
- Map block keys to form fields
- Prioritize asks by impact

### Solution: PersonalizationPrompt Component

**Location**: [components/PersonalizationPrompt.tsx](components/PersonalizationPrompt.tsx)

---

### Usage in BlockRenderer

**Already integrated** - BlockRenderer automatically shows asks:

```typescript
// components/BlockRenderer.tsx
const ask = block.ask?.(ctx);

{ask ? (
  <PersonalizationPrompt ask={ask} onProvide={onProvide} variant="inline" />
) : null}
```

**Output**:

```
┌────────────────────────────────────────────┐
│ 💡 Personalization Available               │
│                                            │
│ Share your annual mileage → We'll separate │
│ gentle vs. taxing usage patterns → which  │
│ adjusts the battery replacement timeline  │
│ by roughly ±2 years.                      │
│                                            │
│ [Add your annual mileage]                  │
└────────────────────────────────────────────┘
```

---

### Personalization Key Mapping

Maps block `ask.key` to existing form fields:

```typescript
import { personalizationKeyMapping } from "@/components/PersonalizationPrompt";

const mapping = personalizationKeyMapping["annualMileage"];
// {
//   formField: "annualMileage",
//   inputType: "number",
//   placeholder: "e.g., 12,000 miles/year"
// }
```

**Available mappings**:

| Block Key | Form Field | Input Type | Placeholder |
|-----------|------------|------------|-------------|
| annualMileage | annualMileage | number | "e.g., 12,000 miles/year" |
| dailyCommute | dailyMiles | number | "e.g., 45 miles/day" |
| homeCharging | homeCharging | boolean | - |
| zipCode | zipCode | text | "e.g., 94105" |
| chargingPatterns | chargingPatterns | select | ["Daily overnight", "Opportunistic", "DC fast"] |
| riskTolerance | riskTolerance | select | ["Conservative", "Moderate", "Aggressive"] |
| weeklyMileage | weeklyMileage | number | "e.g., 300 miles/week" |

---

### Collecting Asks from Multiple Blocks

```typescript
import { collectPersonalizationAsks } from "@/components/PersonalizationPrompt";

const blocks = getBlocks(ctx);
const asks = collectPersonalizationAsks(blocks, ctx);

// Returns deduplicated asks across all blocks
// If multiple blocks ask for "annualMileage", only one ask returned
```

---

### Prioritizing Asks by Impact

```typescript
import { prioritizePersonalizationAsks } from "@/components/PersonalizationPrompt";

const asks = [
  { key: "annualMileage", message: "...", tier: 2, confidenceBonus: 0.1 },
  { key: "dailyCommute", message: "...", tier: 4, confidenceBonus: 0.05 },
  { key: "recalls", message: "...", tier: 1, confidenceBonus: 0.02 },
];

const prioritized = prioritizePersonalizationAsks(asks);
// Sorted by: tier (lower first), then confidenceBonus (higher first)
// Result: [recalls (tier 1), annualMileage (tier 2), dailyCommute (tier 4)]
```

---

### Aggregator Component

Shows top personalization opportunities across all blocks:

```typescript
import { PersonalizationAggregator } from "@/components/PersonalizationPrompt";

<PersonalizationAggregator
  asks={asks}
  onProvide={(key, value) => {
    // Handle personalization input
  }}
/>
```

**Output**:

```
Personalize Your Assessment

Adding these details will increase confidence and tailor
recommendations to your situation:

┌────────────────────────────────────────────┐
│ 💡 Personalization Available               │
│ Share your annual mileage → ...            │
│ [Add your annual mileage]                  │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ 💡 Personalization Available               │
│ Share your daily commute → ...             │
│ [Add your daily commute]                   │
└────────────────────────────────────────────┘

+ 3 more personalizations available
```

---

## Part 4: Integration Examples

### Example 1: Simple Block with Preset

```typescript
{
  id: "range.fit.metric.v1",
  kind: "metric",
  tier: 4,
  priority: 10,
  guidanceLevel: 2,

  // ✅ Use preset
  confidenceFrame: (ctx) => {
    const hasCommute = Boolean(ctx.inputs?.dailyCommute);
    return confidencePresets.rangeFit(hasCommute);
  },

  confidence: (ctx) => {
    const base = 0.6;
    const bonus = ctx.inputs?.dailyCommute ? 0.2 : 0;
    return clamp01(base + bonus);
  },

  // ✅ Use personalization value prop
  ask: (ctx) => {
    if (ctx.inputs?.dailyCommute) return undefined;
    return {
      key: "dailyCommute",
      message: personalizationValueProp({
        dataPoint: "your daily commute distance",
        analysis: "calculate precise range buffer",
        outcome: "the daily usability assessment",
        range: "10–15% more accurate",
      }),
    };
  },

  metric: (ctx) => ({
    label: "Daily fit score",
    value: ctx.inputs?.dailyCommute
      ? `${calculateFitScore(ctx)}%`
      : "—",
  }),
}
```

---

### Example 2: Complex Block with Custom Confidence

```typescript
{
  id: "battery.trajectory.metric.v1",
  kind: "metric",
  tier: 2,
  priority: 20,
  guidanceLevel: 2,

  // ✅ Custom confidence logic
  confidenceFrame: (ctx) => {
    const hasBattery = Boolean(ctx.vehicle?.batteryData);
    const hasMileage = Boolean(ctx.inputs?.annualMileage);
    const hasClimate = Boolean(ctx.inputs?.climateZone);

    const label =
      hasBattery && hasMileage && hasClimate ? "high" :
      hasBattery && hasMileage ? "medium" : "low";

    return createConfidenceFrame({
      label,
      hasPersonalization: hasMileage || hasClimate,
      specificData: ["your annual mileage", "your climate zone"],
      genericData: ["battery SOH data", "model degradation curves"],
      affects: ["projected replacement timeline", "resale value"],
      notAffects: ["immediate safety", "current usability"],
    });
  },

  confidence: (ctx) => {
    let conf = 0.4; // base
    if (ctx.vehicle?.batteryData) conf += 0.2;
    if (ctx.inputs?.annualMileage) conf += 0.15;
    if (ctx.inputs?.climateZone) conf += 0.1;
    return clamp01(conf);
  },

  // ✅ Prioritize annualMileage (higher impact)
  ask: (ctx) => {
    if (!ctx.inputs?.annualMileage) {
      return {
        key: "annualMileage",
        message: personalizationValueProp({
          dataPoint: "your annual mileage",
          analysis: "project usage-specific degradation",
          outcome: "the replacement timeline",
          range: "±1–2 years",
        }),
      };
    }

    if (!ctx.inputs?.climateZone) {
      return {
        key: "climateZone",
        message: personalizationValueProp({
          dataPoint: "your climate zone",
          analysis: "account for temperature effects",
          outcome: "the degradation rate",
          range: "±5–10% accuracy",
        }),
      };
    }
  },

  metric: (ctx) => ({
    label: "Projected degradation (5 years)",
    value: `${calculateProjection(ctx)}%`,
  }),
}
```

---

## Part 5: Best Practices

### DO: Use Presets First

```typescript
// ✅ GOOD: Use preset when available
confidenceFrame: (ctx) => confidencePresets.batteryHealth(
  Boolean(ctx.inputs?.annualMileage)
),

// ❌ BAD: Manual when preset exists
confidenceFrame: (ctx) => ({
  label: "medium",
  practical: "...",
  // ... 50 lines of boilerplate
}),
```

### DO: Register All Blocks

```typescript
// ✅ GOOD: Add to registry immediately
export const blockRegistry: Record<string, BlockMetadata> = {
  "my.new.block.v1": {
    id: "my.new.block.v1",
    tier: 3,
    description: "...",
    signalsRequired: ["..."],
    lastUpdated: "2025-12-28",
    status: "implemented",
    version: 1,
    testCoverage: false, // TODO: Add tests
  },
};
```

### DO: Map Personalization Keys

```typescript
// ✅ GOOD: Add mapping for new key
export const personalizationKeyMapping = {
  myNewKey: {
    formField: "myFormField",
    inputType: "number",
    placeholder: "e.g., 1000",
  },
};
```

### DON'T: Duplicate Confidence Logic

```typescript
// ❌ BAD: Copy-paste confidence logic
confidenceFrame: (ctx) => ({
  label: "medium",
  practical: "directionally useful but based on proxies",
  basedOn: ["vehicle data", "averages"],
  missing: ["your input"],
  affects: ["outcome"],
  notAffects: ["safety"],
}),

// ✅ GOOD: Extract to preset or use factory
confidenceFrame: (ctx) => createConfidenceFrame({ ... }),
```

### DON'T: Skip Registry Updates

```typescript
// ❌ BAD: Implement block but don't register
export function getBlocks(ctx) {
  return [
    myNewBlock, // Not in registry!
  ];
}

// ✅ GOOD: Register first
blockRegistry["my.new.block.v1"] = { ... };
```

---

## Part 6: Testing with Enhanced Patterns

### Test: Confidence Preset Consistency

```typescript
import { confidencePresets } from "@/core/templates";

test("batteryHealth preset without personalization", () => {
  const frame = confidencePresets.batteryHealth(false);

  expect(frame.label).toBe("medium");
  expect(frame.missing).toContain("your annual mileage");
  expect(frame.affects).toContain("battery replacement timing");
  expect(frame.notAffects).toContain("immediate safety");
});

test("batteryHealth preset with personalization", () => {
  const frame = confidencePresets.batteryHealth(true);

  expect(frame.label).toBe("high");
  expect(frame.missing).toEqual([]);
  expect(frame.basedOn).toContain("your annual mileage");
});
```

### Test: Registry Utilities

```typescript
import { getImplementedBlocks, getMigrationStatus } from "@/core/blocks/registry";

test("migration status accuracy", () => {
  const status = getMigrationStatus();

  expect(status.total).toBe(8);
  expect(status.implemented).toBe(2);
  expect(status.percentComplete).toBe(25);
});

test("implemented blocks have metadata", () => {
  const blocks = getImplementedBlocks();

  for (const block of blocks) {
    expect(block.id).toBeDefined();
    expect(block.tier).toBeGreaterThanOrEqual(1);
    expect(block.tier).toBeLessThanOrEqual(4);
    expect(block.description).toBeTruthy();
  }
});
```

### Test: Personalization Integration

```typescript
import { collectPersonalizationAsks, prioritizePersonalizationAsks } from "@/components/PersonalizationPrompt";

test("deduplicates asks by key", () => {
  const blocks = [
    { ask: () => ({ key: "annualMileage", message: "..." }) },
    { ask: () => ({ key: "annualMileage", message: "..." }) }, // duplicate
  ];

  const asks = collectPersonalizationAsks(blocks, {});

  expect(asks).toHaveLength(1);
  expect(asks[0].key).toBe("annualMileage");
});

test("prioritizes by tier then confidence bonus", () => {
  const asks = [
    { key: "a", tier: 4, confidenceBonus: 0.1 },
    { key: "b", tier: 1, confidenceBonus: 0.05 },
    { key: "c", tier: 2, confidenceBonus: 0.15 },
  ];

  const prioritized = prioritizePersonalizationAsks(asks);

  expect(prioritized[0].key).toBe("b"); // tier 1
  expect(prioritized[1].key).toBe("c"); // tier 2
  expect(prioritized[2].key).toBe("a"); // tier 4
});
```

---

## Summary: Files Added

| File | Purpose | Lines |
|------|---------|-------|
| **[core/templates.ts](core/templates.ts)** | Confidence factory + presets (enhanced) | 186 |
| **[core/blocks/registry.ts](core/blocks/registry.ts)** | Block registry + utilities | 328 |
| **[components/PersonalizationPrompt.tsx](components/PersonalizationPrompt.tsx)** | Personalization integration | 234 |

**Total**: 3 files, 748 lines

---

**Implemented**: 2025-12-28
**Status**: ✅ Complete
**Impact**: Production-ready patterns with 3x less boilerplate
