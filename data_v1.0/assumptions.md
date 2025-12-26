# EV-Risk™ Data v1.0 - Assumptions & Sources

## Overview
This document outlines the assumptions, sources, and limitations of the MVP dataset used in EV-Risk™ v1.0.

## Data Files

### 1. battery_degradation.json
**Purpose**: Battery chemistry mapping and degradation rate estimates

**Assumptions**:
- Degradation rates are annual averages based on moderate climate and usage
- Rates assume 12,000 miles/year typical driving
- Does not account for extreme climate acceleration (handled separately)
- Chemistry classifications are simplified (real-world batteries may use blends)

**Sources**:
- Geotab EV Battery Degradation Study (2023)
- Recurrent Auto battery health reports
- Tesla Impact Report 2023
- Industry manufacturer specifications

**Limitations**:
- Does not account for individual battery management system quality
- Early production years may have higher degradation than later improvements
- Fast charging frequency impact not modeled in v1.0

---

### 2. range_delta.csv
**Purpose**: Real-world vs EPA range comparison

**Assumptions**:
- Real-world range based on 65mph highway, 55°F ambient, no HVAC use
- Delta represents average across multiple test cycles
- Does not account for driver behavior variance

**Sources**:
- InsideEVs 70mph highway range tests
- Car and Driver EV range testing
- Edmunds EV range verification
- Consumer Reports EV testing data

**Limitations**:
- Highway-focused (city range may differ significantly)
- Seasonal variation not captured in single delta value
- Wind, terrain, and driving style create high individual variance

---

### 3. recalls.csv
**Purpose**: Known safety and reliability recall database

**Assumptions**:
- Only includes NHTSA-documented recalls (US market)
- Severity ratings are subjective interpretations
- Recall completion rates not tracked in v1.0

**Sources**:
- NHTSA Recall Database (safercar.gov)
- Manufacturer recall notices
- EV-specific recall aggregations

**Limitations**:
- Does not include TSBs (Technical Service Bulletins)
- International recalls not included
- No tracking of recall fix effectiveness
- Recent recalls may be incomplete (ongoing investigations)

---

### 4. owner_issue_clusters.json
**Purpose**: Common failure modes and reliability patterns

**Assumptions**:
- Frequency ratings (High/Medium/Low) based on forum discussion volume
- Severity is subjective impact assessment
- Reliability scores are relative, not absolute (scale 0-10)

**Sources**:
- Tesla Motors Club forums
- Reddit r/electricvehicles, model-specific subreddits
- Consumer Reports reliability surveys
- TrueDelta reliability data
- Edmunds long-term test reports

**Limitations**:
- Forum bias (vocal minority may skew perception)
- Sample size varies widely by model popularity
- Newer models have limited long-term data
- Manufacturer service bulletin data not publicly available

---

### 5. climate_zones.csv
**Purpose**: ZIP-level climate classification for battery degradation impact

**Assumptions**:
- 3-digit ZIP prefix provides sufficient granularity for MVP
- Temperature averages from 2015-2023 (climate change trend not modeled)
- "Extreme" thresholds: >95°F heat days, <10°F cold days

**Sources**:
- NOAA National Centers for Environmental Information
- Weather Underground historical data
- US Climate Data (usclimatedata.com)

**Limitations**:
- ZIP-3 is coarse (e.g., 900 covers vast California region)
- Microclimates within ZIP zones not captured
- Garage vs. outdoor parking impact not modeled
- Future climate change not projected

---

### 6. charger_density.csv
**Purpose**: Public charging infrastructure availability

**Assumptions**:
- DCFC = DC Fast Charger (50kW+)
- L2 = Level 2 (home/public AC chargers)
- Density score is qualitative interpretation of infrastructure adequacy

**Sources**:
- US Department of Energy Alternative Fuels Data Center
- PlugShare database
- ChargePoint network data
- Electrify America station maps

**Limitations**:
- Does not account for charger reliability/uptime
- Network compatibility (Tesla Supercharger vs. CCS) not distinguished in v1.0
- Workplace/home charging availability not captured
- Rapid infrastructure growth means data may be outdated quickly

---

## Scoring Algorithm Assumptions

### Battery Risk (40% weight)
- Age-based degradation is linear (reality: may accelerate after 70% SoH)
- All battery chemistries degrade uniformly within their class
- Replacement cost is worst-case (warranty may cover some scenarios)

### Platform Risk (30% weight)
- Critical recalls = 2x impact vs. Medium recalls
- Owner issue frequency = linear correlation with future failure probability
- All reported issues are weighted equally within severity tier

### Ownership Fit (30% weight)
- Daily miles → annual miles (x 365) is accurate representation
- Climate zone impact is uniform across entire ZIP-3 region
- Charger density linear correlation with ownership convenience

---

## Known Gaps (Future Versions)

**v1.1 Roadmap**:
- Individual VIN lookup (current battery SoH, specific recall status)
- Insurance cost integration (ZIP + model)
- Resale value depreciation curves
- Total Cost of Ownership (TCO) projections

**v2.0 Aspirations**:
- Machine learning model trained on real warranty claim data
- Integration with Carfax/AutoCheck vehicle history
- Real-time charging network status
- Predictive maintenance scheduling

---

## Data Refresh Cadence

| File | Refresh Frequency | Last Updated |
|------|------------------|--------------|
| battery_degradation.json | Annually | 2025-01-15 |
| range_delta.csv | Quarterly | 2025-01-15 |
| recalls.csv | Monthly | 2025-01-15 |
| owner_issue_clusters.json | Quarterly | 2025-01-15 |
| climate_zones.csv | Annually | 2025-01-15 |
| charger_density.csv | Quarterly | 2025-01-15 |

---

## Disclaimer

This data is provided for informational purposes only and should not be considered professional automotive advice. EV-Risk™ v1.0 uses publicly available data and statistical modeling to provide risk assessments. Individual vehicle conditions may vary significantly. Always obtain a pre-purchase inspection from a qualified EV technician before purchasing a used electric vehicle.

**Version**: 1.0
**Last Updated**: January 15, 2025
**Author**: EV-Risk Development Team
