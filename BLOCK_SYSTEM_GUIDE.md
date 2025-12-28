# Block System Architecture Guide

**Date**: 2025-12-28
**Status**: ✅ Complete
**Philosophy**: Stable rendering + voice enforcement + dynamic confidence

---

## Overview

The Block system replaces ad-hoc section generation with a principled architecture that enforces:

1. **Stable block identity** - No `key={idx}` instability
2. **Voice consistency** - Linter blocks banned phrases
3. **Dynamic confidence** - Confidence changes tracked automatically
4. **Calibrated urgency** - No uncalibrated alarms
5. **Strategic honesty** - Explicit withholding when data insufficient

---

## Core Architecture

### Block Types

```typescript
type Block = TextBlock | MetricBlock;

type TextBlock = BlockBase & {
  kind: "text";
  title: string;
  render: (ctx: RenderCtx) => string;
};

type MetricBlock = BlockBase & {
  kind: "metric";
  title: string;
  metric: (ctx: RenderCtx) => MetricPayload;
  render?: (ctx: RenderCtx) => string; // optional supporting text
};
```

### Block Identity (Stable Keys)

**CRITICAL**: Every block has a **stable semantic ID**, never position-based.

```typescript
// ✅ GOOD: Stable semantic ID
{
  id: "battery.health.metric.v1",
  tier: 2,
  priority: 10,
  // ...
}

// ❌ BAD: Position-based key
blocks.map((block, idx) => <div key={idx}>...</div>)
```

**Why this matters**:
- React uses keys to track component identity
- Position-based keys cause blocks to swap when order changes
- Semantic IDs ensure stable rendering across re-renders

---

## Tier System

Blocks are organized into 4 tiers based on **decision impact**:

| Tier | Category | Examples | Priority Range |
|------|----------|----------|----------------|
| **1** | Safety & Reliability | Recalls, known failure modes | 0-19 |
| **2** | Battery Health | Degradation, replacement timing | 20-39 |
| **3** | Cost Exposure | Warranty gaps, maintenance probability | 40-59 |
| **4** | Convenience & Fit | Range fit, charging compatibility | 60-79 |

**Ordering**: Blocks sort by `(tier, priority)`, ensuring stable, predictable order.

```typescript
blocks.sort((a, b) => (a.tier - b.tier) || (a.priority - b.priority));
```

---

## Guidance Levels

Every block must specify a **guidanceLevel** (1-3):

```typescript
type GuidanceLevel = 1 | 2 | 3;
// 1: "We recommend"
// 2: "Most buyers in your situation..."
// 3: "Here's how to evaluate..."
```

**Examples**:

```typescript
// Level 1: Direct recommendation
guidanceLevel: 1,
render: () => "We recommend confirming recall completion before purchase."

// Level 2: Contextual guidance
guidanceLevel: 2,
render: () => "Most buyers in your situation prioritize battery health verification."

// Level 3: Evaluation framework
guidanceLevel: 3,
render: () => "Here's how to evaluate whether this range fits your needs: compare your daily commute to the estimated usable range."
```

---

## Dynamic Confidence

**CRITICAL**: Confidence must be a **function**, not a static value.

```typescript
// ✅ GOOD: Dynamic confidence
confidence: (ctx) => {
  const base = 0.65;
  const bonus = ctx.inputs?.annualMileage ? 0.1 : 0;
  return clamp01(base + bonus);
},

// ❌ BAD: Static confidence
confidence: 0.65,
```

**Why dynamic**:
- Confidence changes as user provides more data
- System must track confidence deltas (before/after inputs)
- Static values create "confidence label only" drift

### Confidence Frame (Required)

Every block must provide a **confidenceFrame** that explains:

```typescript
confidenceFrame: (ctx) => ({
  label: "medium",
  practical: "our estimate is directionally useful but still based on proxies",
  basedOn: ["vehicle battery data", "population averages"],
  missing: ["your annual mileage"],
  affects: ["battery replacement timing", "long-term cost exposure"],
  notAffects: ["immediate safety"],
}),
```

**Output example**:
> "Medium confidence means our estimate is directionally useful but still based on proxies. This estimate is based on vehicle battery data and population averages, not your annual mileage. This typically affects battery replacement timing and long-term cost exposure, but not immediate safety."

---

## Calibrated Urgency

**BANNED**: Uncalibrated alarms ("URGENT", "CRITICAL")

**REQUIRED**: Calibrated urgency levels

```typescript
type Urgency =
  | { level: "before_purchase"; whyNow: string; timeline?: string }
  | { level: "safety_related"; probability: string; consequence: string }
  | { level: "time_sensitive"; timeline: string; impact: string }
  | { level: "none" };
```

**Examples**:

```typescript
// ✅ GOOD: Calibrated urgency
urgency: () => ({
  level: "before_purchase",
  whyNow: "open recalls can affect registration, safety, and immediate reliability",
  timeline: "3–7 days",
}),

// ❌ BAD: Uncalibrated alarm
render: () => "⚠️ CRITICAL: URGENT ACTION REQUIRED"
```

---

## Strategic Honesty (Withholding)

When data is insufficient, **explicitly withhold** instead of speculating.

```typescript
withhold: (ctx) => {
  if (!ctx.vehicle?.batteryData) {
    return {
      kind: "true_unknown",
      missing: "battery health data",
      why: "battery lifespan varies widely between vehicles with similar mileage",
    };
  }
  return undefined;
},
```

**Withholding reasons**:

1. **true_unknown**: Critical data missing, speculation would be irresponsible
2. **risk_tolerance**: Depends on user's subjective risk tolerance
3. **legal_gray**: Requires information we cannot ethically advise on

**Output**:
> "We cannot advise here because battery lifespan varies widely between vehicles with similar mileage. Without battery health data, any recommendation would be speculative."

---

## Personalization Asks

Blocks can request user data using the **value prop formula**:

```typescript
ask: (ctx) => {
  if (ctx.inputs?.annualMileage) return undefined;
  return {
    key: "annualMileage",
    message: personalizationValueProp({
      dataPoint: "your annual mileage",
      analysis: "separate gentle vs. taxing usage patterns",
      outcome: "the battery replacement timeline",
      range: "±2 years",
    }),
  };
},
```

**Formula**: `Share [data] → We'll [analysis] → which adjusts [outcome] by roughly [range].`

**Output**:
> "Share your annual mileage → We'll separate gentle vs. taxing usage patterns → which adjusts the battery replacement timeline by roughly ±2 years."

---

## Voice Linter (Enforcement)

The voice linter **blocks banned phrases** in dev mode (`?debug=1`):

**Banned phrases**:
- "Probably"
- "Urgent" (use calibrated urgency)
- "Better estimates" (use value prop formula)
- "May limit" (without calibration)
- "Consider" (unless paired with evaluation framing)

**Example**:

```typescript
// ❌ BANNED: Will trigger linter
render: () => "This may limit your range. Consider upgrading."

// ✅ ALLOWED: Calibrated language
render: () => "This typically affects range by 10–15% in cold weather. Here's how to evaluate whether this matters for your usage: compare your typical winter commute to the adjusted range."
```

**Linter output** (`?debug=1`):
```
[EV-RISK VOICE] Lint failed: [
  { rule: 'BANNED: "Consider"', match: 'Consider', index: 28 }
]
```

---

## Confidence Tracing (Debug)

The system automatically logs confidence changes when `?debug=1`:

**Initial confidence**:
```
[EV-RISK CONF] {
  kind: "initial",
  overall: 0.625,
  dominantTier: 2,
  missingSignals: ["annualMileage"],
  blocks: [
    { id: "recalls.safety.text.v1", tier: 1, conf: 0.9 },
    { id: "battery.health.metric.v1", tier: 2, conf: 0.55 }
  ]
}
```

**After user input**:
```
[EV-RISK CONF] {
  kind: "change",
  from: 0.625,
  to: 0.675,
  dominantTier: 2,
  missingSignals: [],
  blocks: [
    { id: "recalls.safety.text.v1", tier: 1, conf: 0.9 },
    { id: "battery.health.metric.v1", tier: 2, conf: 0.65 } // ↑ increased
  ]
}
```

---

## Sample Block: Battery Health

**Full implementation**:

```typescript
{
  id: "battery.health.metric.v1",
  kind: "metric",
  title: "Battery Health",
  tier: 2,
  priority: 10,
  guidanceLevel: 2,
  requiredSignals: ["batteryData"],

  // Dynamic confidence (increases when annual mileage provided)
  confidence: (ctx) => {
    const base = ctx.vehicle?.batteryData?.confidence === "high" ? 0.75 :
                 ctx.vehicle?.batteryData?.confidence === "medium" ? 0.55 : 0.35;
    const bonus = ctx.inputs?.annualMileage ? 0.1 : 0;
    return clamp01(base + bonus);
  },

  // Confidence explanation
  confidenceFrame: (ctx) => {
    const hasMileage = Boolean(ctx.inputs?.annualMileage);
    return {
      label: hasMileage ? "high" : "medium",
      practical: hasMileage
        ? "our estimate is more tailored to your usage"
        : "our estimate is directionally useful but still based on proxies",
      basedOn: hasMileage
        ? ["vehicle battery data", "your annual mileage"]
        : ["vehicle battery data", "population averages"],
      missing: hasMileage ? [] : ["your annual mileage"],
      affects: ["battery replacement timing", "long-term cost exposure"],
      notAffects: ["immediate safety"],
    };
  },

  // Strategic withholding
  withhold: (ctx) => {
    if (!ctx.vehicle?.batteryData) {
      return {
        kind: "true_unknown",
        missing: "battery health data",
        why: "battery lifespan varies widely between vehicles with similar mileage",
      };
    }
    return undefined;
  },

  // No urgency (not time-sensitive)
  urgency: () => ({ level: "none" }),

  // Personalization ask
  ask: (ctx) => {
    if (ctx.inputs?.annualMileage) return undefined;
    return {
      key: "annualMileage",
      message: personalizationValueProp({
        dataPoint: "your annual mileage",
        analysis: "separate gentle vs. taxing usage patterns",
        outcome: "the battery replacement timeline",
        range: "±2 years",
      }),
    };
  },

  // Metric display
  metric: (ctx) => ({
    label: "Estimated degradation",
    value: `${ctx.vehicle?.batteryData?.degradation ?? "—"}%`,
  }),

  // Supporting text
  render: (ctx) => {
    return ctx.inputs?.annualMileage
      ? "This projection reflects your usage context, which makes the timeline estimate more reliable."
      : "Without your mileage context, we estimate using population averages, which mainly affects long-term replacement timing.";
  },
}
```

---

## Sample Block: Recalls

**Full implementation**:

```typescript
{
  id: "recalls.safety.text.v1",
  kind: "text",
  title: "Recalls & Safety",
  tier: 1,
  priority: 5,
  guidanceLevel: 1,

  // High confidence (recall presence is verifiable)
  confidence: () => 0.9,

  confidenceFrame: () => ({
    label: "high",
    practical: "this is a direct check against known recall records",
    basedOn: ["reported recall listings for this vehicle"],
    missing: ["dealer verification of completion status"],
    affects: ["purchase readiness", "safety and reliability risk"],
    notAffects: ["battery degradation estimates"],
  }),

  // Calibrated urgency (not alarm)
  urgency: () => ({
    level: "before_purchase",
    whyNow: "open recalls can affect registration, safety, and immediate reliability",
    timeline: "3–7 days",
  }),

  // Voice-compliant render
  render: (ctx) => {
    const recalls = ctx.vehicle?.recalls ?? [];
    const critical = recalls.filter((r: any) => r.priority === "high");
    const criticalText = critical.length
      ? ` ${critical.length} appear safety-critical.`
      : "";

    // ✅ No "urgent" - calibrated language
    return `We recommend confirming recall completion before purchase. ${recalls.length} open recalls detected.${criticalText}`;
  },
}
```

---

## Migration Path

### Phase 0: Parallel Engine (Current)

- ✅ Block system implemented
- ✅ Voice linter active
- ✅ Confidence tracing active
- ⏳ Existing `composeReportSections()` still runs production

**Validation** (`?debug=1`):
- Block ordering stable
- Linter catches banned phrases
- Confidence trace matches expectations

### Phase 1: Dual-Render Toggle (1-2 days)

Add feature flag:

```typescript
const USE_BLOCKS = process.env.NEXT_PUBLIC_USE_BLOCKS === "1" || isDebugEnabled();

return USE_BLOCKS ? (
  <ReportView vehicle={vehicle} userInputs={inputs} />
) : (
  <LegacySectionView blocks={composeReportSections(ctx)} />
);
```

### Phase 2: Convert Sections One-by-One (2-5 days)

Convert in **tier priority order**:

1. ✅ Recalls & Safety (Tier 1) - **DONE**
2. Known failure modes / stranded risk (Tier 1)
3. ✅ Battery health (Tier 2) - **DONE**
4. Degradation trajectory (Tier 2)
5. Warranty gaps (Tier 3)
6. Maintenance probability (Tier 3)
7. Range fit (Tier 4)
8. Charging compatibility (Tier 4)

**Checklist per conversion**:
- [ ] Stable semantic ID (`id: "section.name.v1"`)
- [ ] Correct tier (1-4)
- [ ] Guidance level (1-3)
- [ ] Dynamic `confidence(ctx)`
- [ ] Complete `confidenceFrame(ctx)`
- [ ] Strategic `withhold(ctx)` where applicable
- [ ] Calibrated `urgency(ctx)` if time-sensitive
- [ ] Value prop `ask(ctx)` for personalization
- [ ] Voice-compliant `render(ctx)` (passes linter)

### Phase 3: Remove Legacy Sections (When 8/8 Converted)

- Delete `composeReportSections()`
- Remove feature flag
- Keep linter + confidence trace **forever** (dev-only + CI)

---

## File Structure

```
C:\Dev\ev-risk\
├── core\
│   ├── content.ts              # Block types, RenderCtx, BlockBase
│   ├── templates.ts            # Voice utilities (guidancePrefix, urgencyCalibration, etc.)
│   └── blocks\
│       └── sampleBlocks.ts     # Battery + Recalls sample blocks
├── components\
│   ├── BlockRenderer.tsx       # Renders any Block with stable styling
│   └── ReportView.tsx          # Orchestrates blocks, runs linter + conf trace
├── debug\
│   ├── voiceLinter.ts          # Banned phrase detection
│   └── confTrace.ts            # Confidence change logging
└── BLOCK_SYSTEM_GUIDE.md       # This file
```

---

## Testing Checklist

### Stable Rendering Tests

- [ ] Blocks maintain order when inputs change
- [ ] No `key={idx}` warnings in console
- [ ] Block IDs are semantic, not positional
- [ ] Adding/removing blocks doesn't cause swapping

### Voice Linting Tests

- [ ] `?debug=1` enables linter
- [ ] Banned phrases trigger warnings
- [ ] Compliant text passes linter
- [ ] Linter output includes rule + match + index

### Confidence Tracing Tests

- [ ] `?debug=1` enables tracing
- [ ] Initial confidence logged on mount
- [ ] Confidence changes logged when inputs change
- [ ] Delta calculated correctly (from → to)
- [ ] Missing signals identified

### Urgency Calibration Tests

- [ ] `level: "before_purchase"` renders timeline
- [ ] `level: "safety_related"` renders probability + consequence
- [ ] `level: "time_sensitive"` renders impact + timeline
- [ ] `level: "none"` renders nothing
- [ ] No uncalibrated "URGENT" text

### Withholding Tests

- [ ] `kind: "true_unknown"` withholds when data missing
- [ ] Withholding text explains why we can't advise
- [ ] Blocks without data show withhold message
- [ ] Withholding doesn't break rendering

---

## Common Mistakes to Avoid

### Mistake 1: Static Confidence

**BAD**:
```typescript
confidence: 0.65, // ❌ Static value
```

**GOOD**:
```typescript
confidence: (ctx) => {
  const base = 0.65;
  const bonus = ctx.inputs?.annualMileage ? 0.1 : 0;
  return clamp01(base + bonus);
},
```

### Mistake 2: Position-Based Keys

**BAD**:
```typescript
blocks.map((block, idx) => <div key={idx}>...</div>) // ❌ Causes swapping
```

**GOOD**:
```typescript
blocks.map((block) => <div key={block.id}>...</div>) // ✅ Stable identity
```

### Mistake 3: Uncalibrated Urgency

**BAD**:
```typescript
render: () => "⚠️ CRITICAL: URGENT ACTION REQUIRED" // ❌ Banned
```

**GOOD**:
```typescript
urgency: () => ({
  level: "before_purchase",
  whyNow: "open recalls can affect registration",
  timeline: "3–7 days",
}),
render: () => "We recommend confirming recall completion before purchase."
```

### Mistake 4: Missing Confidence Frame

**BAD**:
```typescript
confidence: (ctx) => 0.75,
// ❌ No confidenceFrame - user doesn't know what "75%" means
```

**GOOD**:
```typescript
confidence: (ctx) => 0.75,
confidenceFrame: (ctx) => ({
  label: "high",
  practical: "this estimate is reliable for decision-making",
  basedOn: ["vehicle battery data", "your annual mileage"],
  missing: [],
  affects: ["battery replacement timing"],
  notAffects: ["immediate safety"],
}),
```

### Mistake 5: Banned Phrase Usage

**BAD**:
```typescript
render: () => "Consider upgrading your battery." // ❌ Linter blocks "Consider"
```

**GOOD**:
```typescript
render: () => "Here's how to evaluate whether battery replacement makes sense: compare the estimated replacement cost to the vehicle's current value."
```

---

## Performance Notes

### Min-Height for Stability

BlockRenderer uses `min-h-[110px]` to prevent layout shifts:

```typescript
<section className={`rounded-xl border bg-white p-4 ${tierStyle(block.tier)} min-h-[110px]`}>
```

**Why**: Prevents CLS (Cumulative Layout Shift) when blocks load content.

### Memoization

`ReportView` memoizes blocks to prevent unnecessary re-renders:

```typescript
const blocks = useMemo(() => getBlocks(ctx), [ctx]);
```

**Why**: Block composition can be expensive for large reports.

### Debug-Only Logging

All linting and tracing only runs when `?debug=1`:

```typescript
if (!isDebugEnabled()) return;
```

**Why**: Zero production overhead.

---

## Future Enhancements

1. **CI Integration**: Run voice linter in CI/CD pipeline
2. **Block Registry**: Central registry for all blocks by tier
3. **A/B Testing**: Test different guidanceLevel strategies
4. **Analytics**: Track which blocks drive personalization
5. **Block Versioning**: Support `v2` blocks without breaking `v1`

---

**Implemented**: 2025-12-28
**Status**: ✅ Complete
**Impact**: Stable rendering + voice enforcement + dynamic confidence
