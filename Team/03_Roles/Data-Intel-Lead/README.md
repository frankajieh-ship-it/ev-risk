# EV Data & Intelligence Lead (Member 2)

**Mandate:** vehicle matching, listing analysis, VIN research, pricing, evidence quality.

**Owns:** whether a data source or claim is good enough to show a buyer. You can block a tool from shipping if its evidence is weak.

**Known context**
- VIN history: VINAudit + VehicleDatabases.com. VINAudit lacks open lien and title checks (ClearVin was evaluated to fill those gaps)
- NREL charger API: use lat/lon, since the `location` param returns 422
- Vehicle photos: `data/vehicle-images.csv` is the source of truth
- Report schema is mid-migration. The agent uses V2 only

**Week 1**
1. Data audit per agent tool (coverage, freshness, failure modes, gaps) → `02_Projects/buying-agent/specs/data-audit.md`
2. Answer the Tech Lead's tool data-contract request on the board
