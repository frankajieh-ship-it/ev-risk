# EV Data ETL Scripts

These scripts populate `data_v2/` with authoritative, API-sourced vehicle data.
They replace the hand-curated CSV/JSON files in `data_v1.0/`.

## Quick Start

```bash
# 1. Get free API keys (takes ~2 minutes each):
#    NREL: https://developer.nrel.gov/signup/
#    EIA:  https://www.eia.gov/opendata/

# 2. Run Phase 1 scripts in order:
npx tsx scripts/etl/fetch-epa-vehicles.ts           # ~1–2 min (no key needed)
npx tsx scripts/etl/fetch-nhtsa-recalls.ts          # ~3–5 min (no key needed; needs vehicle_master.json)
NREL_API_KEY=xxx npx tsx scripts/etl/fetch-afdc-chargers.ts
EIA_API_KEY=xxx npx tsx scripts/etl/fetch-eia-rates.ts
NREL_API_KEY=xxx npx tsx scripts/etl/fetch-incentives.ts

# 3. Run Phase 2 scripts (semi-manual data compilation):
npx tsx scripts/etl/compile-charging-profiles.ts    # no API needed
npx tsx scripts/etl/compile-range-stack.ts          # no API needed
AUTODEV_API=xxx npx tsx scripts/etl/fetch-market-pricing.ts  # needs vehicle_master.json
```

---

## Script Reference

| Script | Output | Auth | Cadence |
|--------|--------|------|---------|
| `fetch-epa-vehicles.ts` | `data_v2/vehicle_master.json` | None | Quarterly |
| `fetch-vPIC-patterns.ts` | Enriches vehicle_master.json | None | Quarterly |
| `fetch-nhtsa-recalls.ts` | `data_v2/recalls_live.json` | None | Monthly |
| `fetch-afdc-chargers.ts` | `data_v2/charger_density_v2.json` | `NREL_API_KEY` | Quarterly |
| `fetch-eia-rates.ts` | `data_v2/electricity_rates.json` | `EIA_API_KEY` | Annually |
| `fetch-incentives.ts` | `data_v2/incentives.json` | `NREL_API_KEY` (optional) | Monthly |
| `compile-charging-profiles.ts` | `data_v2/charging_profiles.json` | None | As needed |
| `compile-range-stack.ts` | `data_v2/range_stack.json` | None | As needed |
| `fetch-market-pricing.ts` | `data_v2/market_pricing.json` | `AUTODEV_API` | Monthly |

---

## Output Files

Generated files are excluded from git (see `.gitignore`). Semi-manual compiled
files are committed because they represent research effort that cannot be
automatically regenerated:

| File | Committed? | Why |
|------|-----------|-----|
| `vehicle_master.json` | No | Regenerated from EPA API |
| `recalls_live.json` | No | Regenerated from NHTSA API |
| `charger_density_v2.json` | No | Regenerated from AFDC API |
| `electricity_rates.json` | No | Regenerated from EIA API |
| `market_pricing.json` | No | Regenerated from Auto.dev API |
| `incentives.json` | Yes | IRS rules manually verified |
| `charging_profiles.json` | Yes | Third-party test data manually compiled |
| `range_stack.json` | Yes | AAA/Recurrent data manually compiled |
| `ownership_cost.json` | Yes (when created) | Consumer Reports data manually compiled |

---

## Environment Variables

| Variable | Where to Get | Free? |
|----------|-------------|-------|
| `NREL_API_KEY` | developer.nrel.gov/signup | Yes |
| `EIA_API_KEY` | eia.gov/opendata | Yes |
| `AUTODEV_API` | auto.dev (paid subscription) | No — already in app |

---

## Adding New Vehicles

The `fetch-epa-vehicles.ts` script covers all EPA-registered BEVs automatically.
For vehicles not yet in the EPA database (very new models), add them manually
to `data_v2/vehicle_master.json` with `"data_source": "manual"`.

## Updating Incentive Data

The federal incentive list in `fetch-incentives.ts` (the `FEDERAL_NEW_VEHICLES`
array) must be updated manually whenever:
- A new model year qualifies for the credit
- Assembly location changes (IRA requires North American final assembly)
- IRS publishes updated VIN eligibility list (usually January each year)

Check: https://www.irs.gov/credits-deductions/manufacturers-and-models-for-new-clean-vehicles-purchased-in-2023-2024
