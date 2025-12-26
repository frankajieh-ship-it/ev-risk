# EV-Risk™ v1.0 - Expected Outcomes (Pre-Launch Validation)

## Purpose
This document defines expected scoring outcomes for 5 real-world test scenarios. These benchmarks are based on known industry data, NHTSA recalls, and expert consensus on EV reliability.

**Critical Validation Rule:** If actual system outputs differ by >15 points or produce wrong verdict (GREEN vs RED), HALT and adjust scoring algorithm.

---

## Test Scenario 1: 2018 Nissan Leaf – AZ
**Input:**
- Model: Nissan Leaf (SV trim)
- Year: 2018 (7 years old)
- Current Mileage: 60,000 mi
- ZIP: 85001 (Phoenix, AZ – Extreme Hot)
- Daily Miles: 35 mi/day (~12,775 mi/year)
- Home Charging: Yes
- Risk Tolerance: Moderate

**Expected Output:**
- **Verdict:** 🔴 RED (High Risk)
- **Score Range:** 25-45 / 100
- **Key Flags:**
  - Battery degradation: 25-35% (air-cooled chemistry + extreme heat)
  - Climate impact: "Challenging" (Extreme Hot zone)
  - Estimated replacement cost: ~$8,500-$10,000
  - Recommendation: "High Risk - Budget for battery replacement within 2-3 years"

**Why This Expected Outcome:**
- Nissan Leaf uses air-cooled battery (no thermal management)
- Phoenix heat accelerates degradation by 50% (1.5x modifier)
- Known industry data: 2018 Leafs in AZ routinely lose 30%+ capacity by 60k miles
- Mileage acceptable but age + climate = critical risk

---

## Test Scenario 2: 2020 Chevy Bolt – MI
**Input:**
- Model: Chevrolet Bolt EV (LT trim)
- Year: 2020 (5 years old)
- Current Mileage: 42,000 mi
- ZIP: 48201 (Detroit, MI – Cold)
- Daily Miles: 30 mi/day (~10,950 mi/year)
- Home Charging: Yes
- Risk Tolerance: Moderate

**Expected Output:**
- **Verdict:** 🟡 YELLOW (Moderate Risk)
- **Score Range:** 50-65 / 100
- **Key Flags:**
  - Critical recalls: 2 (21V-650, 21V-861 – battery fire risk)
  - Platform risk: Heavily penalized for critical recalls
  - Battery degradation: 12-18% (LG Chem NMC + cold stress)
  - Climate impact: "Moderate" (Cold zone = 1.25x modifier)
  - **Warning:** "Verify battery recall completion before purchase"

**Why This Expected Outcome:**
- 2017-2022 Bolts had catastrophic battery fire recall (143,000 units)
- Platform risk score should be 40-60/100 due to critical recalls
- Battery health acceptable IF recall completed (new battery = better score)
- Cold Michigan winters add degradation stress
- Should NOT be GREEN due to recall severity, but not RED if mileage/age ok

---

## Test Scenario 3: 2021 Tesla Model 3 Long Range – CA
**Input:**
- Model: Tesla Model 3 Long Range
- Year: 2021 (4 years old)
- Current Mileage: 35,000 mi
- ZIP: 94103 (San Francisco, CA – Mild)
- Daily Miles: 25 mi/day (~9,125 mi/year)
- Home Charging: Yes
- Risk Tolerance: Moderate

**Expected Output:**
- **Verdict:** 🟢 GREEN (Low Risk)
- **Score Range:** 75-90 / 100
- **Key Flags:**
  - Battery degradation: 6-10% (NMC811 chemistry + mild climate)
  - Climate impact: "Favorable" (Mild zone, no penalty)
  - Charger density: "Excellent" (Bay Area = highest in US)
  - Ownership fit: 95-100/100 (ideal conditions)
  - Low mileage for age (~8,750 mi/year avg)
  - Recommendation: "Low Risk - Good purchase candidate"

**Why This Expected Outcome:**
- Tesla Model 3 LR has strong reliability track record (8.5/10)
- Bay Area climate ideal for EVs (no extreme heat/cold)
- Below-average mileage reduces wear
- Excellent charging infrastructure + home charging
- No critical recalls for 2021 model year
- Should be clear GREEN unless scoring is too conservative

---

## Test Scenario 4: 2019 BMW i3 – NY
**Input:**
- Model: BMW i3 (120 Ah)
- Year: 2019 (6 years old)
- Current Mileage: 48,000 mi
- ZIP: 10001 (Manhattan, NY – Cold)
- Daily Miles: 40 mi/day (~14,600 mi/year)
- Home Charging: **NO**
- Risk Tolerance: Moderate

**Expected Output:**
- **Verdict:** 🟡 YELLOW (Moderate Risk)
- **Score Range:** 55-70 / 100
- **Key Flags:**
  - Ownership fit penalty: -25 to -40 points (no home charging + 40 mi/day)
  - Daily range fit: "Poor" or "Moderate" (40 mi/day ÷ ~120 mi real-world range = 33%)
  - Battery degradation: 12-18% (Samsung SDI NMC + cold climate)
  - Charger density: "Excellent" (NYC), but still penalized for no home charging
  - Climate impact: "Moderate" (Cold winters)
  - **Warning:** "No home charging - heavily reliant on public infrastructure"

**Why This Expected Outcome:**
- Small 42kWh battery pack means range anxiety risk
- NO home charging is major lifestyle penalty (should drop ownership fit to 60-75/100)
- High daily usage (40 mi/day = 33% of range) requires frequent charging
- Cold NYC winters reduce real-world range by 20-30%
- Battery health acceptable, but ownership fit is poor
- Should NOT be GREEN due to charging constraints

---

## Test Scenario 5: 2022 Ford Mustang Mach-E – TX
**Input:**
- Model: Ford Mustang Mach-E (Premium Extended Range)
- Year: 2022 (3 years old)
- Current Mileage: 28,000 mi
- ZIP: 78701 (Austin, TX – Hot)
- Daily Miles: 35 mi/day (~12,775 mi/year)
- Home Charging: Yes
- Risk Tolerance: Moderate

**Expected Output:**
- **Verdict:** 🟢 GREEN or 🟡 YELLOW (Borderline)
- **Score Range:** 70-80 / 100
- **Key Flags:**
  - Battery degradation: 5-9% (newer platform, but heat stress)
  - Climate impact: "Moderate" (Hot zone = 1.25x modifier)
  - Platform risk: 70-80/100 (some early quality issues, no critical recalls)
  - Ownership fit: 85-95/100 (good infrastructure, home charging)
  - Charger density: "Good" (Austin tech hub)
  - Age/mileage acceptable (~9,333 mi/year avg)

**Why This Expected Outcome:**
- Newer platform (only 3 years old) = low degradation
- Texas heat adds some battery stress but not extreme
- Ford has had some minor build quality complaints but no catastrophic recalls
- Austin has strong EV infrastructure (Tesla HQ, tech hub)
- Should be borderline GREEN/YELLOW depending on platform risk weighting
- **If score is 75+, system is slightly optimistic**
- **If score is <65, system is too conservative**

---

## Validation Success Criteria

### ✅ **PASS Conditions:**
1. All 5 scenarios land within ±10 points of expected range
2. Verdicts (GREEN/YELLOW/RED) match expected for 4/5 scenarios
3. Critical flags appear correctly (Bolt recalls, Leaf heat degradation, i3 no-home-charging)
4. Score breakdown percentages align with reality (battery/platform/ownership weights)

### ⚠️ **INVESTIGATE Conditions:**
1. 1-2 scenarios differ by 10-15 points (may need minor tuning)
2. Borderline scenario (Mach-E) lands on opposite side of threshold (75 vs 74)
3. One category (battery/platform/ownership) consistently too harsh or lenient

### 🛑 **FAIL / HALT Conditions:**
1. Any scenario differs by >15 points from expected range
2. 2018 Leaf scores GREEN (catastrophic scoring failure)
3. 2021 Tesla scores YELLOW or RED (too conservative)
4. Bolt shows 0 critical recalls (data loading error)
5. i3 scores GREEN despite no home charging (ownership fit broken)

---

## Next Steps After Validation

**If PASS:**
- Document results in `tests/output_validation.md`
- Proceed to launch prep (deployment, analytics, etc.)

**If INVESTIGATE:**
- Review specific category weights (40/30/30 split)
- Adjust climate modifiers (1.5x / 1.25x)
- Fine-tune recall penalty scoring

**If FAIL:**
- HALT launch immediately
- Debug data loading (CSV parsing, JSON structure)
- Re-examine scoring formulas (degradation calc, penalty stacking)
- Re-run tests after fixes

---

**Test Date:** 2025-12-26
**System Version:** EV-Risk™ v1.0
**Tester:** Claude Code (Validation Agent)
