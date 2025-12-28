# Report Rendering Stability Implementation

**Date**: 2025-12-28
**Status**: ✅ Complete
**Philosophy**: Prevent visual/logical jumps through stable block identity and hysteresis

---

## The Problem

### Visual Jumps (Most Common Issue)

**Symptom**: Report content appears to "jump" or "swap" when confidence changes slightly

**Root Cause**: Using array `index` as React key

```tsx
// ❌ BAD: Blocks swap positions when list changes
{blocks.map((block, index) => (
  <div key={index}>{block.content}</div>
))}
```

**What Happens**:
1. User adds personalization data
2. Confidence changes from 64% → 66%
3. Block list regenerates
4. React sees different `index` values
5. Blocks re-render in wrong order → visual jump

---

### Logical Jumps (Text Flickering)

**Symptom**: Text variants flip back and forth ("Medium" → "High" → "Medium")

**Root Cause**: Tiny confidence changes crossing thresholds

```tsx
// ❌ BAD: No hysteresis
const tier = confidence >= 0.75 ? "High" : "Medium";

// User adjusts input:
// confidence: 74% → "Medium"
// confidence: 75% → "High"  (crosses threshold)
// confidence: 74.5% → "Medium" (falls back)
// Result: Text flickers
```

---

### Layout Jumps (Height Instability)

**Symptom**: Page scrolls or shifts when content updates

**Root Cause**: Block heights change during re-render

```tsx
// ❌ BAD: No min-height
<div className="p-4 rounded border">
  {block.content} {/* Height varies by content */}
</div>

// Result: When content changes, entire page reflows
```

---

## The Solution

### A. Stable Block Identity ✅

**Location**: [types/reportBlocks.ts](types/reportBlocks.ts)

**Key Concept**: Semantic IDs derived from block meaning, not position

```typescript
export interface ReportBlock {
  id: string; // e.g., "summary.v1", "riskScore.v1"
  kind: BlockKind; // Type for styling
  priority: number; // Stable ordering (10, 20, 30...)
  content: string | React.ReactNode;
  confidenceMin?: number; // Gating
  confidenceMax?: number;
}
```

**Why This Works**:
- `id` never changes for the same semantic block
- React uses `id` as key → blocks maintain identity
- No swapping, no jumps

**Example**:
```typescript
const blocks: ReportBlock[] = [
  {
    id: "summary.v1",  // ✅ Stable ID
    kind: "summary",
    priority: 10,
    content: "Assessment Confidence: Medium",
  },
  {
    id: "riskScore.v1",  // ✅ Different ID
    kind: "risk",
    priority: 20,
    content: "Overall Score: 75/100",
  },
];
```

---

### B. Confidence Hysteresis ✅

**Location**: [lib/confidence-hysteresis.ts](lib/confidence-hysteresis.ts)

**Key Concept**: Sticky thresholds prevent flickering

**Tier Thresholds**:
- Tier 3 (High): ≥ 75%
- Tier 2 (Medium): ≥ 50%
- Tier 1 (Low): ≥ 25%
- Tier 0 (Very Low): < 25%

**Hysteresis (Downgrade Thresholds)**:
- From Tier 3 → 2: Must drop below **68%** (not 75%)
- From Tier 2 → 1: Must drop below **42%** (not 50%)
- From Tier 1 → 0: Must drop below **18%** (not 25%)

**Example**:
```typescript
// User confidence: 74%
const tier1 = stableTier(null, 0.74);  // → 2 (Medium)

// Confidence increases to 76%
const tier2 = stableTier(2, 0.76);     // → 3 (High) ✅

// Confidence drops to 74%
const tier3 = stableTier(3, 0.74);     // → 3 (High) ✅ Hysteresis!

// Confidence drops to 67%
const tier4 = stableTier(3, 0.67);     // → 2 (Medium) ✅ Below 68%
```

**Why This Works**:
- Small fluctuations don't change tier
- Text variants stay stable
- No flickering

---

### C. Stable Layout Heights ✅

**Location**: [components/ReportBlockView.tsx](components/ReportBlockView.tsx)

**Key Concept**: Reserve space with `min-height` per block kind

**Min-Height Classes**:
```typescript
function getMinHeightClass(kind: BlockKind): string {
  switch (kind) {
    case "summary": return "min-h-[120px]";
    case "risk": return "min-h-[140px]";
    case "confidence": return "min-h-[150px]";
    case "why": return "min-h-[100px]";
    case "battery_context": return "min-h-[160px]";
    case "ownership_fit": return "min-h-[130px]";
    case "trust_calibration": return "min-h-[180px]";
    case "next_steps": return "min-h-[90px]";
    default: return "min-h-[90px]";
  }
}
```

**Why This Works**:
- Block height doesn't change when content updates
- Page doesn't reflow
- Scroll position stays stable

---

### D. Debounced Inputs ✅

**Location**: [hooks/useDebouncedInput.ts](hooks/useDebouncedInput.ts)

**Key Concept**: Use `useTransition` to defer report updates

**Problem**:
```tsx
// ❌ BAD: Every keystroke triggers report recomposition
<input onChange={(e) => updateReport({ dailyMiles: e.target.value })} />
// Result: Jank, lag, visual instability
```

**Solution**:
```tsx
// ✅ GOOD: Local state updates immediately, report updates in low priority
const { value, onChange, isPending } = useDebouncedText("", (val) => {
  updateReport({ dailyMiles: parseInt(val) });
});

<input
  value={value}
  onChange={onChange}
  className={isPending ? "opacity-70" : ""}
/>
```

**Why This Works**:
- UI stays responsive (local state updates immediately)
- Report updates deferred (low priority)
- No jank during typing

---

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| [types/reportBlocks.ts](types/reportBlocks.ts) | Block type definitions | 1-58 |
| [lib/confidence-hysteresis.ts](lib/confidence-hysteresis.ts) | Tier calculation with hysteresis | 1-181 |
| [lib/compose-report-blocks.ts](lib/compose-report-blocks.ts) | Block composition logic | 1-212 |
| [components/ReportBlockView.tsx](components/ReportBlockView.tsx) | Block rendering component | 1-167 |
| [hooks/useDebouncedInput.ts](hooks/useDebouncedInput.ts) | Debounced input hooks | 1-128 |
| [components/StableReportExample.tsx](components/StableReportExample.tsx) | Integration example | 1-139 |

---

## Implementation Guide

### Step 1: Define Block Structure

```typescript
// types/reportBlocks.ts
export interface ReportBlock {
  id: string;           // ✅ Stable semantic ID
  kind: BlockKind;      // For styling
  priority: number;     // For ordering
  content: string;
  confidenceMin?: number;
}
```

### Step 2: Compose Blocks with Stable IDs

```typescript
// lib/compose-report-blocks.ts
export function composeReportBlocks(ctx: ReportContext): ReportBlock[] {
  const blocks: ReportBlock[] = [
    {
      id: "summary.v1",  // ✅ Never changes
      kind: "summary",
      priority: 10,
      content: generateSummary(ctx),
    },
    {
      id: "riskScore.v1",
      kind: "risk",
      priority: 20,
      content: generateRiskScore(ctx),
    },
  ];

  return blocks
    .filter(b => b.confidenceMin == null || ctx.confidence >= b.confidenceMin)
    .sort((a, b) => a.priority - b.priority);
}
```

### Step 3: Use Stable Tier Hook

```typescript
// In report component
import { useStableTier } from "@/lib/confidence-hysteresis";

const confidenceTier = useStableTier(confidence);
// ✅ Tier changes only when crossing hysteresis thresholds
```

### Step 4: Render with Stable Keys

```typescript
// components/ReportBlockList.tsx
export function ReportBlockList({ blocks, confidenceTier }) {
  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <ReportBlockView
          key={block.id}  // ✅ Stable key prevents swapping
          block={block}
          confidenceTier={confidenceTier}
        />
      ))}
    </div>
  );
}
```

### Step 5: Use Debounced Inputs

```typescript
// In form component
import { useDebouncedText } from "@/hooks/useDebouncedInput";

const { value, onChange, isPending } = useDebouncedText("", (val) => {
  updateReport({ zipCode: val });
});

<input
  type="text"
  value={value}
  onChange={onChange}
  className={isPending ? "opacity-70" : ""}
/>
```

---

## Integration Example

```typescript
// app/report/page.tsx
import { useStableTier } from "@/lib/confidence-hysteresis";
import { composeReportBlocks } from "@/lib/compose-report-blocks";
import { ReportBlockList } from "@/components/ReportBlockView";

export default function ReportPage() {
  const [reportData, setReportData] = useState(null);

  // Calculate stable tier
  const confidenceTier = useStableTier(reportData.confidence.overall_score / 100);

  // Build context
  const reportContext: ReportContext = {
    confidence: reportData.confidence.overall_score / 100,
    confidenceTier,
    inputs: reportData.input,
    scores: {
      overall: reportData.confidence.overall_score,
      battery: reportData.confidence.battery_risk.score,
      platform: reportData.confidence.platform_risk.score,
      ownership: reportData.confidence.ownership_fit.score,
    },
    personalizationCount: calculatePersonalizationCount(reportData.input),
    hasZeroPersonalization: calculatePersonalizationCount(reportData.input) === 0,
  };

  // Compose blocks
  const blocks = composeReportBlocks(reportContext);

  // Render with stable keys
  return <ReportBlockList blocks={blocks} confidenceTier={confidenceTier} />;
}
```

---

## Testing Checklist

### Visual Stability Tests

- [ ] Blocks do NOT swap positions when confidence changes
- [ ] Text does NOT flicker between variants (Medium ↔ High)
- [ ] Page does NOT scroll/jump when content updates
- [ ] Blocks maintain consistent heights during updates
- [ ] Layout is stable when adding/removing personalization

### Performance Tests

- [ ] Typing in inputs does NOT cause lag
- [ ] Report updates smoothly (no jank)
- [ ] Re-renders are batched (not per keystroke)
- [ ] Mobile: No visual instability on scroll

### Tier Stability Tests

**Test Scenario 1**: Confidence crosses threshold upward
```
Confidence: 74% → Tier 2 (Medium)
Confidence: 76% → Tier 3 (High) ✅
```

**Test Scenario 2**: Confidence drops slightly below threshold
```
Tier: 3 (High)
Confidence: 76% → 74% → Tier STAYS 3 ✅ (Hysteresis)
```

**Test Scenario 3**: Confidence drops significantly
```
Tier: 3 (High)
Confidence: 76% → 67% → Tier 2 (Medium) ✅ (Below 68%)
```

---

## Common Pitfalls (Avoid These)

### ❌ Using Array Index as Key

```tsx
// ❌ BAD
{blocks.map((block, index) => (
  <div key={index}>{block.content}</div>
))}
```

**Why Bad**: Blocks swap when list order changes

**Fix**:
```tsx
// ✅ GOOD
{blocks.map((block) => (
  <div key={block.id}>{block.content}</div>
))}
```

---

### ❌ No Hysteresis on Thresholds

```tsx
// ❌ BAD
const tier = confidence >= 0.75 ? 3 : 2;
```

**Why Bad**: Text flickers when confidence hovers around 75%

**Fix**:
```tsx
// ✅ GOOD
const tier = useStableTier(confidence);
```

---

### ❌ Variable Block Heights

```tsx
// ❌ BAD
<div className="p-4">
  {block.content}
</div>
```

**Why Bad**: Page reflows when content length changes

**Fix**:
```tsx
// ✅ GOOD
<div className="p-4 min-h-[120px]">
  {block.content}
</div>
```

---

### ❌ Updating Report on Every Keystroke

```tsx
// ❌ BAD
<input onChange={(e) => updateReport({ zipCode: e.target.value })} />
```

**Why Bad**: Causes jank and lag

**Fix**:
```tsx
// ✅ GOOD
const { value, onChange } = useDebouncedText("", (val) => {
  updateReport({ zipCode: val });
});
<input value={value} onChange={onChange} />
```

---

## Performance Impact

### Before Rendering Stability

**Symptoms**:
- Blocks jump when confidence changes
- Text flickers: "Medium" → "High" → "Medium"
- Page scrolls unexpectedly during updates
- Typing causes visible lag (jank)

**User Experience**: "Feels buggy and unstable"

---

### After Rendering Stability

**Improvements**:
- ✅ Blocks stay in place (stable IDs)
- ✅ Text stable (hysteresis)
- ✅ No layout jumps (min-height)
- ✅ Smooth typing (useTransition)

**User Experience**: "Feels polished and professional"

---

## Mobile Considerations

### Specific Mobile Issues

1. **Touch Scrolling**: Layout jumps more noticeable on mobile
2. **Smaller Viewport**: Height changes more impactful
3. **Slower Devices**: Jank more visible

### Mobile Optimizations Applied

```css
/* app/globals.css */
@media (max-width: 768px) {
  /* Stable form spacing */
  form > div {
    margin-bottom: 1.5rem;
  }

  /* Compact info boxes */
  .bg-blue-50.border-blue-200 {
    font-size: 0.875rem;
    padding: 0.75rem;
  }
}
```

---

## Key Principles

### 1. Semantic IDs Over Positional Indexing

**Principle**: Block identity = semantic meaning, not array position

**Application**:
- `id: "summary.v1"` ✅
- `key={index}` ❌

---

### 2. Hysteresis Over Hard Thresholds

**Principle**: Require larger change to reverse direction

**Application**:
- Upgrade at 75% ✅
- Downgrade only below 68% ✅
- No flickering

---

### 3. Reserve Space Over Dynamic Heights

**Principle**: Min-height prevents reflow

**Application**:
- `min-h-[120px]` ✅
- Variable height ❌

---

### 4. Deferred Updates Over Immediate

**Principle**: UI responsive, heavy updates deferred

**Application**:
- `useTransition` ✅
- `onChange={() => updateReport()}` ❌

---

## Future Enhancements

1. **Smooth Animations**: Fade transitions when blocks appear/disappear
2. **Scroll Anchoring**: Keep user's reading position stable
3. **Virtual Scrolling**: For very long reports
4. **Progressive Loading**: Render blocks incrementally

---

**Implemented**: 2025-12-28
**Status**: ✅ Complete
**Impact**: Eliminates visual/logical jumps, creates polished user experience

