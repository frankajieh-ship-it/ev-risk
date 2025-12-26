# EV-Risk™ v1.0 - Output Validation Report
**Test Date:** 2025-12-26
**System Version:** v1.0
**Status:** ⚠️ **CRITICAL ISSUES IDENTIFIED** - Scoring algorithm requires adjustment

---

## Executive Summary

**Test Results:** 1/5 scenarios PASS ✅ | 4/5 scenarios FAIL 🛑

**Critical Failures Identified:**
1. **Scenario 1 (2018 Leaf AZ):** Scored YELLOW (59/100) - Expected RED (25-45). **15+ point deviation.**
2. **Scenario 2 (2020 Bolt MI):** Scored GREEN (83/100) - Expected YELLOW (50-65). **18+ point deviation. CRITICAL RECALL DATA MISSING.**
3. **Scenario 4 (2019 i3 NYC):** Scored GREEN (80/100) - Expected YELLOW (55-70). **No-home-charging penalty NOT working.**
4. Battery degradation calculations appear conservative (underestimating degradation in hot climates)
5. Platform risk NOT detecting critical Chevy Bolt recalls (21V-650, 21V-861)

**Root Causes:**
- Climate degradation modifiers not aggressive enough
- Critical recall data missing from recalls.csv
- No-home-charging penalty insufficient
- Platform risk penalties too lenient

---

## Detailed Test Results

### ✅ Scenario 3: 2021 Tesla Model 3 Long Range – CA (PASS)
**Expected:** 🟢 GREEN (75-90)
**Actual:** 🟢 GREEN (86/100)

| Metric | Expected | Actual | Status |
|--------|----------|--------|--------|
| Overall Score | 75-90 | 86 | ✅ PASS |
| Verdict | GREEN | GREEN | ✅ PASS |
| Battery Risk | High | 88/100 (7.2% deg) | ✅ PASS |
| Platform Risk | 70-80 | 70/100 | ✅ PASS |
| Ownership Fit | 95-100 | 100/100 | ✅ PASS |
| Climate Impact | Favorable | Favorable | ✅ PASS |
| Charger Density | Excellent | Excellent | ✅ PASS |

**Analysis:** This scenario worked perfectly. Mild Bay Area climate, low mileage, excellent infrastructure, strong reliability. Score of 86 is spot-on.

---

### 🛑 Scenario 1: 2018 Nissan Leaf – AZ (FAIL)
**Expected:** 🔴 RED (25-45)
**Actual:** 🟡 YELLOW (59/100)

| Metric | Expected | Actual | Deviation |
|--------|----------|--------|-----------|
| Overall Score | 25-45 | 59 | **+14 to +34 points** 🛑 |
| Verdict | RED | YELLOW | **Wrong verdict** 🛑 |
| Battery Risk | 15-30 | 54/100 | **Too optimistic** 🛑 |
| Battery Degradation | 25-35% | 21.0% | **-4 to -14%** 🛑 |
| Climate Modifier | Applied | Applied (1.5x) | Insufficient |
| Platform Risk | 40-60 | 50/100 | ✅ OK |
| Ownership Fit | 60-75 | 75/100 | Slightly high |

**Critical Issues:**
1. **Battery degradation underestimated:** 21% vs expected 25-35%
   - Formula: (2.0% NMC * 7 years) + (0 excess miles) * 1.5 climate = 21%
   - **Problem:** Air-cooled Nissan Leaf should use WORSE chemistry than liquid-cooled NMC
   - **Fix needed:** Leaf-specific degradation rate OR higher base rate for air-cooled packs

2. **Battery risk score too high:** 54/100 for 21% degradation
   - 21% degradation should score 30-40/100 (RED zone)
   - Current scoring maps 21% → 54/100 (mid-YELLOW)
   - **Fix needed:** Adjust battery risk scoring curve to penalize 20%+ degradation more heavily

3. **Climate modifier insufficient:** 1.5x not aggressive enough for Extreme Hot + air-cooled
   - Phoenix temps routinely hit 115°F (46°C) in summer
   - Air-cooled Leaf packs degrade 2-3x faster in AZ per industry data
   - **Fix needed:** Apply 2.0x modifier for air-cooled + Extreme Hot

**Recommendation:** HALT - This is a known bad vehicle (2018 Leaf in AZ) and system scored it YELLOW instead of RED.

---

### 🛑 Scenario 2: 2020 Chevy Bolt EV – MI (FAIL)
**Expected:** 🟡 YELLOW (50-65)
**Actual:** 🟢 GREEN (83/100)

| Metric | Expected | Actual | Deviation |
|--------|----------|--------|-----------|
| Overall Score | 50-65 | 83 | **+18 to +33 points** 🛑 |
| Verdict | YELLOW | GREEN | **Wrong verdict** 🛑 |
| Critical Recalls | 2 (21V-650, 21V-861) | 0 | **DATA MISSING** 🛑 |
| Platform Risk | 40-60 | 70/100 | **Too high** 🛑 |
| Battery Risk | 70-85 | 83/100 | ✅ OK |
| Ownership Fit | 80-95 | 95/100 | ✅ OK |

**Critical Issues:**
1. **CRITICAL RECALL DATA MISSING:**
   - System shows: "0 recall(s) (0 critical)"
   - Reality: 2017-2022 Bolts had 2 critical battery fire recalls (NHTSA 21V-650, 21V-861)
   - 143,000 units affected, multiple vehicle fires, GM recall cost $1.8B
   - **Fix needed:** Add Bolt recalls to recalls.csv immediately

2. **Platform risk score too high:** 70/100 despite known catastrophic recall
   - Should be 40-60/100 due to critical safety recalls
   - **Fix needed:** After adding recall data, verify platform risk drops appropriately

3. **Battery risk acceptable IF recall completed:**
   - 83/100 is reasonable for a 5-year-old Bolt WITH NEW BATTERY (recall fix)
   - But system should warn: "Verify recall completion - battery may have been replaced"

**Recommendation:** HALT - Missing critical safety recall data is unacceptable for production.

---

### 🛑 Scenario 4: 2019 BMW i3 – NY (FAIL)
**Expected:** 🟡 YELLOW (55-70)
**Actual:** 🟢 GREEN (80/100)

| Metric | Expected | Actual | Deviation |
|--------|----------|--------|-----------|
| Overall Score | 55-70 | 80 | **+10 to +25 points** 🛑 |
| Verdict | YELLOW | GREEN | **Wrong verdict** 🛑 |
| Home Charging | NO | NO (detected) | ✅ Detected |
| Ownership Fit | 60-75 | 90/100 | **+15 to +30 points** 🛑 |
| No-Home Penalty | -25 to -40 | -10 (insufficient) | **Too lenient** 🛑 |
| Battery Risk | 70-85 | 80/100 | ✅ OK |
| Platform Risk | 60-75 | 70/100 | ✅ OK |

**Critical Issues:**
1. **No-home-charging penalty insufficient:**
   - System detected no home charging ✅
   - But only applied -10 point penalty (Excellent charger density)
   - Expected: -25 to -40 point penalty
   - **Problem:** Ownership fit scored 90/100 despite no home charging in NYC

2. **Charger density overrides lifestyle penalty:**
   - NYC has "Excellent" public infrastructure
   - But relying on public charging for 40 mi/day is still a major lifestyle compromise
   - Small 42kWh battery + high daily usage + no home charging = poor fit
   - **Fix needed:** Cap ownership fit at 70/100 when no home charging, regardless of public infrastructure

3. **Daily range ratio not penalized enough:**
   - 40 mi/day ÷ 250 mi range = 16% (should be low penalty)
   - But BMW i3 real-world range drops to ~150 mi in cold NYC winters
   - 40 mi/day ÷ 150 mi winter range = 27% (moderate penalty needed)
   - **Fix needed:** Apply seasonal range reduction for cold climates

**Recommendation:** Adjust no-home-charging penalty to be more aggressive, especially for high-usage scenarios.

---

### ✅ Scenario 5: 2022 Mustang Mach-E – TX (BORDERLINE PASS)
**Expected:** 🟢/🟡 Borderline (70-80)
**Actual:** 🟢 GREEN (78/100)

| Metric | Expected | Actual | Status |
|--------|----------|--------|--------|
| Overall Score | 70-80 | 78 | ✅ PASS (upper end) |
| Verdict | GREEN or YELLOW | GREEN | ✅ ACCEPTABLE |
| Battery Risk | 80-90 | 88/100 (7.5% deg) | ✅ PASS |
| Platform Risk | 70-80 | 58/100 | ⚠️ Slightly low |
| Ownership Fit | 85-95 | 85/100 | ✅ PASS |
| Climate Impact | Moderate (Hot) | Moderate | ✅ PASS |

**Analysis:**
- Score of 78/100 is at the high end of expected range (70-80)
- Platform risk of 58/100 is slightly lower than expected (70-80), possibly due to known Mach-E quality issues
- Battery degradation of 7.5% with Hot climate modifier is reasonable
- Borderline GREEN verdict is acceptable for a 3-year-old vehicle in good conditions

**Minor Issue:** Platform risk might be slightly too harsh (58 vs 70-80), but within acceptable range.

---

## Root Cause Analysis

### Issue 1: Battery Degradation Formula Too Conservative
**Current Formula:**
```typescript
const ageDegradation = chemistryData.degradation_rate_per_year * vehicleAge;
const excessMileage = Math.max(0, input.currentMileage - expectedMileage);
const mileageDegradationPenalty = (excessMileage / 50000) * 5;
const baseDegradation = ageDegradation + mileageDegradationPenalty;
const degradation_percent = Math.min(baseDegradation * climateModifier, 40);
```

**Problems:**
1. NMC chemistry rate (2.0%/year) applied to Nissan Leaf (should be worse for air-cooled)
2. Climate modifiers (1.5x Extreme, 1.25x Moderate) too conservative
3. No vehicle-specific adjustments for known problematic models

**Proposed Fix:**
```typescript
// Add air-cooled penalty for Nissan Leaf
let baseRate = chemistryData.degradation_rate_per_year;
if (model.includes("Leaf") && year <= 2022) { // Pre-2023 Leafs are air-cooled
  baseRate = 3.0; // 3%/year for air-cooled in normal climate
}

// Increase climate modifiers
if (climateZone.zone === "Extreme Hot" || climateZone.zone === "Extreme Cold") {
  if (model.includes("Leaf")) {
    climateModifier = 2.0; // 2x for air-cooled + extreme
  } else {
    climateModifier = 1.7; // Increased from 1.5x
  }
}
```

---

### Issue 2: Critical Recall Data Missing
**Current State:**
- recalls.csv does NOT contain Chevy Bolt fire recalls (21V-650, 21V-861)
- System shows 0 recalls for 2020 Bolt

**Required Fix:**
Add to recalls.csv:
```csv
GM,Chevrolet Bolt EV,2017,2019,21V-650,Battery Fire Risk,Critical,"Battery pack fire risk due to manufacturing defects. Full battery replacement required.",68667
GM,Chevrolet Bolt EV,2019,2022,21V-861,Battery Fire Risk,Critical,"Expanded battery fire recall covering all 2019-2022 model years. GM replaced all battery packs.",73000
```

**Impact:** Platform risk should drop to 40-60/100 for affected Bolts.

---

### Issue 3: No-Home-Charging Penalty Insufficient
**Current Code (lib/scoring.ts:249-261):**
```typescript
if (!input.homeCharging) {
  if (charger_density === "Poor") score -= 40;
  else if (charger_density === "Moderate") score -= 25;
  else if (charger_density === "Good") score -= 15;
  else if (charger_density === "Excellent") score -= 10; // ← TOO LENIENT
}
```

**Problem:** -10 penalty for Excellent density is too small. Even with great public infrastructure, no home charging is a major lifestyle compromise.

**Proposed Fix:**
```typescript
if (!input.homeCharging) {
  if (charger_density === "Poor") score -= 50;
  else if (charger_density === "Moderate") score -= 35;
  else if (charger_density === "Good") score -= 25;
  else if (charger_density === "Excellent") score -= 20; // Increased from -10

  // Additional penalty for high daily usage
  if (dailyRangeRatio > 0.25) {
    score -= 15; // Frequent charging needed
  }
}
```

---

### Issue 4: Battery Risk Scoring Curve Too Optimistic
**Current Scoring (lib/scoring.ts:145-154):**
```typescript
if (degradation_percent <= 15) {
  score = 100 - (degradation_percent / 15) * 25; // 15% deg → 75 score
} else if (degradation_percent <= 25) {
  score = 75 - ((degradation_percent - 15) / 10) * 35; // 25% deg → 40 score
} else {
  score = Math.max(0, 40 - (degradation_percent - 25) * 2); // 30% deg → 30 score
}
```

**Problem:** 21% degradation scores 54/100 (mid-YELLOW), but should be 35-45/100 (RED zone).

**Proposed Fix:**
```typescript
if (degradation_percent <= 12) {
  score = 100 - (degradation_percent / 12) * 20; // 12% → 80 (GREEN)
} else if (degradation_percent <= 20) {
  score = 80 - ((degradation_percent - 12) / 8) * 30; // 20% → 50 (YELLOW)
} else {
  score = Math.max(0, 50 - (degradation_percent - 20) * 2.5); // 30% → 25 (RED)
}
```

**Impact:** 21% degradation would score ~47/100 instead of 54/100.

---

## Validation Status: 🛑 FAIL

### Pass/Fail Summary
| Scenario | Expected | Actual | Verdict Match | Score Deviation | Status |
|----------|----------|--------|---------------|-----------------|--------|
| 1. 2018 Leaf AZ | RED (25-45) | YELLOW (59) | ❌ NO | +14 to +34 | 🛑 FAIL |
| 2. 2020 Bolt MI | YELLOW (50-65) | GREEN (83) | ❌ NO | +18 to +33 | 🛑 FAIL |
| 3. 2021 Model 3 CA | GREEN (75-90) | GREEN (86) | ✅ YES | 0 | ✅ PASS |
| 4. 2019 i3 NY | YELLOW (55-70) | GREEN (80) | ❌ NO | +10 to +25 | 🛑 FAIL |
| 5. 2022 Mach-E TX | GREEN/YELLOW (70-80) | GREEN (78) | ✅ YES | 0 | ✅ PASS |

**Overall:** 2/5 PASS, 3/5 FAIL

---

## Required Actions Before Launch

### 🚨 CRITICAL (Must Fix Before Launch)

1. **Add Chevy Bolt Recall Data** (15 min)
   - Add 21V-650 and 21V-861 to recalls.csv
   - Verify platform risk drops to 40-60/100 for 2020 Bolt
   - Re-test Scenario 2

2. **Fix Air-Cooled Battery Degradation** (30 min)
   - Add Nissan Leaf-specific degradation rate (3.0%/year base)
   - Increase Extreme Hot modifier to 2.0x for air-cooled vehicles
   - Re-test Scenario 1 (target: 30-45/100, RED verdict)

3. **Increase No-Home-Charging Penalty** (15 min)
   - Change Excellent density penalty from -10 to -20
   - Add -15 additional penalty for high daily usage (>25% range)
   - Re-test Scenario 4 (target: 60-70/100, YELLOW verdict)

### ⚠️ IMPORTANT (Recommended Before Launch)

4. **Adjust Battery Risk Scoring Curve** (20 min)
   - Shift thresholds: GREEN <12%, YELLOW 12-20%, RED >20%
   - Make curve more aggressive for 20%+ degradation
   - Re-test all scenarios

5. **Increase Climate Modifiers** (10 min)
   - Extreme Hot/Cold: 1.5x → 1.7x
   - Hot/Hot Humid/Cold: 1.25x → 1.35x
   - Re-test heat-affected scenarios (Leaf AZ, Mach-E TX)

### 📋 OPTIONAL (Post-Launch Refinement)

6. Add seasonal range adjustment for cold climates
7. Add vehicle-specific reliability overrides for known problematic models
8. Add "recall completion verification" warning for affected vehicles

---

## Re-Test Plan

After implementing fixes 1-5 above, re-run all 5 scenarios and verify:

**Target Outcomes:**
1. **2018 Leaf AZ:** 30-45/100 (RED) - battery degradation 28-35%
2. **2020 Bolt MI:** 50-65/100 (YELLOW) - critical recalls flagged
3. **2021 Model 3 CA:** 80-90/100 (GREEN) - no change
4. **2019 i3 NY:** 60-70/100 (YELLOW) - ownership fit 65-75/100
5. **2022 Mach-E TX:** 72-80/100 (GREEN) - no change

**Success Criteria:**
- All 5 scenarios land within ±5 points of target
- All verdicts match expected (GREEN/YELLOW/RED)
- Critical flags appear correctly (Bolt recalls, Leaf heat, i3 no-home)

---

## Conclusion

**Current State:** System is too optimistic and missing critical safety data.

**Risk Assessment:** Launching in current state would:
- Give buyers false confidence in risky vehicles (2018 Leaf in AZ)
- Miss catastrophic safety recalls (Chevy Bolt fires)
- Underestimate lifestyle challenges (no home charging)

**Recommendation:** **DO NOT LAUNCH** until critical fixes 1-3 are implemented and re-tested.

**Estimated Fix Time:** 1-2 hours for all critical fixes + re-testing.

**Next Step:** Implement critical fixes in priority order, then re-run validation suite.
