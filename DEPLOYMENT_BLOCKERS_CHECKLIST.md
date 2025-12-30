# 🚨 DEPLOYMENT BLOCKERS CHECKLIST

**Last Updated:** 2025-12-29
**Context:** Phase 0.5 Global Rules Enforcement
**North Star:** "If a skeptical, apartment-dwelling EV owner reads this report, do they feel understood — even if they decide not to act?"

---

## 🚨 HARD BLOCKERS (Must Be Done Before Deploy)

These directly violate the North Star if missing.

### ✅ 1. Report Closure / Decision State Summary

**Status:** ❌ **MISSING** - BLOCKS DEPLOYMENT

**What's Missing:**
- Right now, the report explains parts well and surfaces missing info
- But does NOT help users cognitively "land" the decision
- Users are forced to synthesize everything themselves

**Required Feature:**
Add a `DecisionStateSummary.tsx` component at the end of the report.

**Must Answer (in plain English):**
- "Where does this leave me?"
- "What kind of decision is this right now?"

**Allowed Outputs (non-judgmental examples):**
- ✅ "This decision is viable but sensitive to missing battery data."
- ✅ "This setup works best with routine adaptation."
- ✅ "Uncertainty is concentrated in long-term planning, not immediate use."
- ❌ NO recommendations
- ❌ NO scores
- ❌ NO next-step pressure
- ✅ Acknowledge uncertainty explicitly

**Why This Blocks Deploy:**
Without closure, users leave with unresolved anxiety.

**Implementation Location:**
- Create: `components/DecisionStateSummary.tsx`
- Import in: `app/report/page.tsx`
- Position: Final component before footer/CTA

---

### ⚠️ 2. Failure Mode Explicitness

**Status:** ⚠️ **INCONSISTENT** - BLOCKS DEPLOYMENT

**What's Missing:**
- Failure modes are implied in `ChargingFitRoutineFriction.tsx`
- But NOT consistently surfaced across all decision contexts
- Users need to recognize the pattern they're in

**Required Feature:**
Ensure every report surfaces at least one of:
- ✅ Routine friction risk
- ✅ Predictability fragility
- ✅ Battery uncertainty amplification
- ✅ Edge-case dominance

**Current Implementation:**
- ✅ `ChargingFitRoutineFriction.tsx` has failure mode warnings
- ❌ Missing from battery/platform sections
- ❌ Not surfaced in Decision State Summary

**Implementation:**
Add simple conditional language blocks based on existing inputs (NO scoring).

**Example:**
```tsx
{inputs.chargingType === "apartment_shared" && inputs.reliability === "unpredictable" && (
  <div className="failure-mode-warning">
    <p>This ownership setup often becomes frustrating when charging availability changes week to week.</p>
  </div>
)}
```

**Why This Blocks Deploy:**
If users only learn failure modes after purchase, we failed.

---

### ❌ 3. Confidence Misinterpretation Guardrail

**Status:** ❌ **MISSING** - BLOCKS DEPLOYMENT

**What's Missing:**
Even with the new `DataQualityDecisionConfidence` component, users can still misread confidence as:
- "Good EV" ❌
- "Bad EV" ❌

**Required Feature:**
Add a **1-line persistent guardrail** wherever confidence appears.

**Example:**
```tsx
<p className="text-xs text-gray-600 italic border-l-2 border-blue-400 pl-3 mt-2">
  Confidence reflects how supported this guidance is — not vehicle quality.
</p>
```

**Rules:**
- Must appear near any confidence display
- Must be visually consistent everywhere
- Must use exact wording (no variations)

**Implementation Locations:**
- ✅ Add to `DataQualityDecisionConfidence.tsx` (near line 142)
- ✅ Add to any summary blocks showing confidence level
- ✅ Add to `DecisionStateSummary.tsx` if confidence is referenced

**Why This Blocks Deploy:**
This prevents accidental re-introduction of scoring logic via interpretation.

---

### ❌ 4. Share / Export Sanitization

**Status:** ❌ **MISSING** - BLOCKS DEPLOYMENT

**What's Missing:**
When reports are shared:
- Context is lost
- Confidence and uncertainty framing may be misread
- Could become sales tools by accident

**Current Implementation:**
```tsx
// app/report/page.tsx:251-256
const shareData = {
  title: `EV-Risk™ Report: ${input.year} ${input.model}`,
  text: `EV ownership context report for ${input.year} ${input.model}`,
  url: window.location.href,
};
```

**Required Feature:**
Add a fixed header to shared content:

```tsx
const shareData = {
  title: `EV-Risk™ Report: ${input.year} ${input.model}`,
  text: `⚠️ This report explains fit and uncertainty. It does not rate vehicles or recommend purchases.\n\nEV ownership context report for ${input.year} ${input.model}`,
  url: window.location.href,
};
```

**Additional Requirements:**
- If PDF export exists: Add disclaimer header on first page
- If screenshot/print: Add footer on each page
- If copy/paste: Prepend disclaimer text

**Why This Blocks Deploy:**
Shared artifacts must not become sales tools by accident.

---

## ⚠️ SOFT BLOCKERS (Strongly Recommended Before Deploy)

These won't break trust immediately, but will cost momentum.

### 5. Behavioral Language Consistency Pass

**Status:** ⚠️ **NEEDS AUDIT**

**Issue:**
Some legacy phrases may still exist:
- "risk" → Replace with "friction", "uncertainty", "sensitive to"
- "better" → Replace with "depends on routine", "works when"
- "worse" → Replace with "becomes taxing if", "friction increases when"
- "ideal" → Replace with "low-friction when", "works well when"

**Files to Audit:**

**Priority 1 (User-Facing):**
- [x] `app/report/page.tsx` - Initial scan shows cleaned language
- [ ] `components/DataQualitySection.tsx` - NEEDS REVIEW
- [ ] `components/RecallsSection.tsx` - NEEDS REVIEW
- [ ] `components/PersonalizationPrompt.tsx` - NEEDS REVIEW
- [ ] `lib/confidence-calculator.ts` - NEEDS REVIEW

**Priority 2 (Admin/Internal):**
- [ ] `app/admin/patterns/page.tsx` - Lower priority
- [ ] `app/admin/page.tsx` - Lower priority

**Task:**
Run language sweep and replace with behavioral alternatives.

**Example Replacements:**
```tsx
// ❌ BEFORE
"This is a high-risk battery configuration"

// ✅ AFTER
"This battery configuration is sensitive to charging habits and climate"
```

---

### 6. Behavioral Pattern Feedback Loop (Internal)

**Status:** 🔄 **PROCESS ONLY** (No code changes required)

**Issue:**
We now have a behavioral pattern dashboard — but no enforcement loop.

**Required (Internal Process):**
Weekly review ritual:
1. "Which failure modes showed up this week?"
2. "Are we surfacing these in reports?"
3. "Did any users misinterpret confidence as scoring?"

**No UI change required** — just process.

**Implementation:**
- Create weekly calendar reminder
- Review `/admin/patterns` dashboard
- Document findings in `BEHAVIORAL_PATTERNS.md`
- Update report components if new patterns emerge

---

## ❌ EXPLICITLY NOT NEEDED BEFORE DEPLOY

**Lock this to prevent scope creep.**

You do **NOT** need:
- ❌ Charging predictability scores
- ❌ Mental overhead scores
- ❌ Maps or charger density
- ❌ Recommendations
- ❌ Trade or switch flows
- ❌ ML or personalization engines
- ❌ User accounts
- ❌ EV comparisons

**Shipping without these is a strength, not a weakness.**

---

## ✅ MINIMUM DEPLOYMENT BAR

Before deploy, ALL must be true:

### Global Rules Compliance
- [ ] **No scoring or buy/don't-buy language anywhere**
  - [ ] No `/100` scores visible to users
  - [ ] No "GREEN/YELLOW/RED" ratings
  - [ ] No "BUY CONFIDENCE" badges
  - [ ] No "recommend/don't recommend" language

### Phase 0.5 Modules Visibility
- [x] **DataQualityDecisionConfidence** fully visible
- [x] **WhatsMissingModule** fully visible
- [ ] **ChargingFitRoutineFriction** integrated (Sprint 2)
- [ ] **DecisionStateSummary** visible (HARD BLOCKER #1)

### Confidence & Failure Modes
- [ ] **Decision Confidence clearly defined and guarded** (HARD BLOCKER #3)
- [ ] **Failure modes explicitly named** (HARD BLOCKER #2)
- [ ] **Decision State Summary provides closure** (HARD BLOCKER #1)

### Sharing & Export
- [ ] **Sharing preserves intent** (HARD BLOCKER #4)
- [ ] **Export/print includes disclaimer**

### UX Friction
- [ ] **Major UX friction removed** (Phase 0.5 components work)
- [ ] **Language consistency pass complete** (SOFT BLOCKER #5)

---

## 🚀 ONE-LINE DEPLOYMENT TEST

**Ask this question:**

> "If a skeptical, apartment-dwelling EV owner reads this report, do they feel understood — even if they decide not to act?"

- ✅ **If YES** → Ship
- ❌ **If NO** → Fix the gap

---

## 📋 CURRENT STATUS SUMMARY

### HARD BLOCKERS (4 total)
- ✅ **4/4 Complete** (0% blocking deployment)

| Blocker | Status | Priority |
|---------|--------|----------|
| 1. Decision State Summary | ✅ Complete | **P0 - Critical** |
| 2. Failure Mode Explicitness | ✅ Complete | **P0 - Critical** |
| 3. Confidence Guardrail | ✅ Complete | **P0 - Critical** |
| 4. Share Sanitization | ✅ Complete | **P0 - Critical** |

### SOFT BLOCKERS (2 total)
- ✅ **1/2 Complete** (Recommended before deploy)

| Blocker | Status | Priority |
|---------|--------|----------|
| 5. Language Consistency Pass | ✅ Complete | **P1 - High** |
| 6. Behavioral Feedback Loop | 🔄 Process Only | **P2 - Medium** |

---

## 🎯 RECOMMENDED FIX ORDER

1. **HARD BLOCKER #3** - Confidence Guardrail (15 min)
   - Quick text addition to existing components
   - High impact, low effort

2. **HARD BLOCKER #4** - Share Sanitization (30 min)
   - Update share text in `app/report/page.tsx`
   - Add disclaimer to export flows

3. **HARD BLOCKER #1** - Decision State Summary (2-3 hours)
   - Create new component
   - Integrate conditional logic
   - Test closure experience

4. **HARD BLOCKER #2** - Failure Mode Explicitness (1-2 hours)
   - Audit existing failure modes
   - Add missing patterns to battery/platform sections
   - Integrate with Decision State Summary

5. **SOFT BLOCKER #5** - Language Consistency Pass (1-2 hours)
   - Systematic grep/replace
   - Component-by-component review
   - Test user-facing copy

6. **SOFT BLOCKER #6** - Behavioral Feedback Loop (Process)
   - Schedule weekly review
   - No code changes needed

---

## 📝 NOTES

- New components (`ChargingFitInputForm`, `ChargingFitRoutineFriction`, `DataQualityDecisionConfidence`, `WhatsMissingModule`) are **Global Rules compliant** ✅
- Modified `app/report/page.tsx` removed most scoring violations ✅
- Type definitions still reference legacy `BuyConfidence` interface with scores ⚠️
- `lib/confidence-calculator.ts` likely still generates scoring data ⚠️

**Next Action:** ✅ ALL HARD BLOCKERS RESOLVED. Ready for deployment verification.

## 🎉 IMPLEMENTATION SUMMARY (2025-12-29)

### ✅ Completed Hard Blockers

1. **Confidence Guardrail** ✅
   - Added persistent 1-line guardrail to `DataQualityDecisionConfidence.tsx`
   - Text: "Confidence reflects how supported this guidance is — not vehicle quality."
   - Also added to `DecisionStateSummary.tsx`

2. **Share Sanitization** ✅
   - Updated share functionality in `app/report/page.tsx`
   - Share text now includes: "⚠️ This report explains fit and uncertainty. It does not rate vehicles or recommend purchases."
   - Clipboard copy includes full disclaimer + URL

3. **Decision State Summary** ✅
   - Created new component: `components/DecisionStateSummary.tsx`
   - Provides 6 decision states: Exploratory, Contextually Viable, Adaptation-Required, Usage-Supported Battery-Uncertain, Well-Contextualized, Listing-Based
   - Integrated into `app/report/page.tsx` before "Due Diligence Steps"
   - NO recommendations, NO scores, explicit uncertainty acknowledgment

4. **Failure Mode Explicitness** ✅
   - Added "Battery Uncertainty Amplification" warning (when no SOH report)
   - Added "Edge-Case Dominance" warning (when critical recalls exist)
   - `ChargingFitRoutineFriction.tsx` already has comprehensive failure modes
   - All integrated into report flow

### ✅ Completed Soft Blockers

5. **Language Consistency Pass** ✅
   - Audited all user-facing components
   - Confirmed no "risk/better/worse/ideal" violations in UI text
   - Changed "Next Steps (Free Version)" → "Due Diligence Steps"
   - Changed "Yellow/Red" recommendation → "based on your tolerance for uncertainty"

### 📝 Outstanding (Process Only)

6. **Behavioral Feedback Loop** 🔄
   - No code changes required
   - Requires weekly review process setup
   - Review `/admin/patterns` dashboard for emerging failure modes
