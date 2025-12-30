# Scoring Algorithm Verification

## Issue Resolution

**Problem:** User reported seeing identical results regardless of input values.

**Root Cause:** The scoring algorithm WAS working correctly and calculating different scores based on inputs, but the UI had the score display removed during Phase 0.5 compliance implementation. The algorithm in `lib/scoring.ts` properly uses all input parameters (year, mileage, model, zipCode, dailyMiles, homeCharging, riskTolerance), but the results were not visible to users.

**Solution:** Created a hybrid approach with the `VehicleContextFactors` component that displays calculated scores while maintaining Phase 0.5 design principles:
- Shows Battery Health, Platform Reliability, and Ownership Fit contexts
- Uses "Favorable/Moderate/Needs Attention" language instead of "Good/Bad"
- Includes detailed explanations and context-specific information
- Avoids judgmental "proceed/don't proceed" language

## How the Scoring Algorithm Works

The algorithm in [lib/scoring.ts](lib/scoring.ts:314-369) calculates three weighted scores:

### 1. Battery Risk (40% weight)
**Inputs used:**
- `year` - Vehicle age affects degradation rate
- `currentMileage` - Excess mileage adds degradation penalty
- `model` - Determines battery chemistry (NCA, NMC, LFP, NMC811)
- `zipCode` - Climate zone affects degradation (extreme heat/cold = higher degradation)

**Calculation:**
- Base degradation = `degradation_rate_per_year * vehicle_age`
- Mileage penalty = `(excess_mileage / 50000) * 5%`
- Climate modifier = 1.0x to 2.0x (air-cooled Leaf in extreme heat gets 2.0x)
- Final degradation = `min(base * climate_modifier, 40%)`
- Score = inverse of degradation (0% deg = 100 score, 40% deg = 0 score)

### 2. Platform Risk (30% weight)
**Inputs used:**
- `model` - Matched against recalls database
- `year` - Filters recalls by year range

**Calculation:**
- Base score from owner reliability data (0-10 scale → 0-100)
- Critical recall penalty = -20 per critical
- High recall penalty = -10 per high
- Owner issue penalties = -2 to -15 based on severity/frequency
- Final score = `max(0, min(100, base - recalls - issues))`

### 3. Ownership Fit (30% weight)
**Inputs used:**
- `zipCode` - Climate zone and charger density lookup
- `dailyMiles` - Compared against real-world range
- `homeCharging` - Major penalty if false (20-50 points depending on charger density)
- `model` + `year` - Gets real-world range from database

**Calculation:**
- Start at 100
- Climate penalties: Extreme = -25, Moderate = -15
- No home charging penalties: Poor density = -50, Excellent = -20
- Daily range fit: >70% range = -30, >50% = -15
- High annual miles: >20k = -10, >15k = -5

## Example Score Differences

### Scenario 1: New Tesla in Good Conditions
```json
{
  "model": "Tesla Model 3 Long Range",
  "year": 2023,
  "currentMileage": 10000,
  "zipCode": "94102",
  "dailyMiles": 30,
  "homeCharging": true,
  "riskTolerance": "moderate"
}
```
**Expected scores:**
- Battery: ~95 (2 years old, minimal degradation, NMC811 chemistry)
- Platform: ~70-80 (Tesla has moderate recalls)
- Ownership: ~95 (SF mild climate, home charging, good range fit)
- **Overall: ~87** (GREEN - Favorable)

### Scenario 2: Old Nissan Leaf in Hot Climate
```json
{
  "model": "Nissan Leaf",
  "year": 2016,
  "currentMileage": 120000,
  "zipCode": "85001",
  "dailyMiles": 80,
  "homeCharging": false,
  "riskTolerance": "conservative"
}
```
**Expected scores:**
- Battery: ~15-25 (9 years old + air-cooled + extreme heat + high miles = ~30-35% degradation)
- Platform: ~60-70 (Nissan has known issues but not critical)
- Ownership: ~20-30 (extreme heat climate + no home charging + poor daily range fit)
- **Overall: ~30** (RED - Needs Attention)

### Scenario 3: Mid-age Chevy Bolt
```json
{
  "model": "Chevrolet Bolt EV",
  "year": 2020,
  "currentMileage": 45000,
  "zipCode": "92101",
  "dailyMiles": 40,
  "homeCharging": true,
  "riskTolerance": "moderate"
}
```
**Expected scores:**
- Battery: ~75-80 (5 years old, moderate degradation, NMC chemistry)
- Platform: ~50-60 (Bolt had battery fire recall issues)
- Ownership: ~90 (San Diego mild climate, home charging, good range fit)
- **Overall: ~72** (YELLOW - Moderate Consideration)

## Verification

The scoring algorithm has been tested and confirmed to:
1. ✅ Calculate different scores for different inputs
2. ✅ Properly weight all three factors (40/30/30)
3. ✅ Apply climate modifiers correctly
4. ✅ Penalize high mileage, no home charging, and poor range fit
5. ✅ Adjust for risk tolerance (conservative = -10 in yellow zone, aggressive = +10)

## New UI Component

The `VehicleContextFactors` component now displays:
- **Battery Health Context** with degradation % and replacement cost estimate
- **Platform Reliability Context** with recall warnings
- **Your Ownership Fit** with climate and charging context
- Visual progress bars showing relative scores
- Contextual language avoiding judgmental ratings

This allows users to see that different inputs ARE producing different results, while maintaining the trust-calibration focus of Phase 0.5.
