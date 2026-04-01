/**
 * Pipeline Diagram Export
 *
 * Returns Mermaid flowchart strings for each OFFO pipeline.
 * Used in blog posts and technical documentation.
 * Zero dependencies — pure string generation.
 */

export function getReceiptPipelineDiagram(): string {
  return `flowchart TD
    A["POST /api/receipt"] --> B["Rate Limit + Token Validation"]
    B --> C["Turnstile + Auth + Idempotency Cache<br/>(parallel)"]
    C --> D["classifyVehicle()"]
    D --> E["extractSignalsFromText()<br/>~150 rule patterns, negation-aware"]
    E --> F["scoreReceipt()<br/>Hard blockers → fit penalties → evidence bonuses"]
    F --> G["buildEnhancedFallbackReceipt()<br/>&lt;500ms deterministic result"]
    G --> H["INSERT receipts<br/>generation_status: lite"]
    H --> I["Return Lite Receipt to Client"]
    I --> J["Enqueue Background AI Upgrade<br/>Netlify Function, 15min budget"]
    J --> K["OpenAI gpt-4o-mini<br/>Structured output, strict schema"]
    K --> L["validateReceiptSchema()"]
    L -->|"lint errors"| M["applyDeterministicFixes()"]
    L -->|"valid"| N["UPDATE receipts<br/>generation_status: full"]
    M --> N`;
}

export function getAuctionPipelineDiagram(): string {
  return `flowchart TD
    A["POST /api/auction/analyze"] --> B["copartAdapter.fetchByUrl()"]
    B --> C["24h Cache Check<br/>auction_analyses table"]
    C -->|"Cache hit"| Z["Return Cached Report"]
    C -->|"Miss"| D["Auto.dev + NHTSA<br/>(parallel enrichment)"]
    D --> E["ARV Resolution<br/>P1: listings → P2: VIN → P3: curve → P4: AI"]
    E --> F["computeDeterministicMetrics()<br/>Damage classification + risk factors"]
    F --> G["Step 1: Grok<br/>classify + damage tone + photos"]
    G --> H{"canSkipRepairCost?"}
    H -->|"minor + ARV known"| I["Skip GPT-4o"]
    H -->|"complex damage"| J["Step 2b: GPT-4o<br/>repair cost breakdown"]
    I --> K["Step 2a: Gemini<br/>routine impact + owner summary"]
    J --> K
    K --> L{"totalCalls < 3?"}
    L -->|"yes"| M["Step 3: Grok<br/>polish + recommended_action"]
    L -->|"no"| N["Skip polish"]
    M --> O["computeAuctionOffoScore()<br/>financial 40% + usability 35% + feasibility 15% + reliability 10%"]
    N --> O
    O --> P["Arbitrage: max_safe_bid + safe_bid_range + profit_scenarios"]
    P --> Q["Persist AuctionEvalReport<br/>24h cache"]`;
}

export function getRoutineFitDiagram(): string {
  return `flowchart TD
    A["MinimumViableRoutine<br/>charging_access, climate, weekly_miles, ..."] --> B["computeRoutineFit()"]
    C["VehicleBasics<br/>range_mi, msrp, body_style, ..."] --> B
    D["ChargerContext<br/>dcfc_count, density_score"] --> B
    B --> E["Dim 1: Charging Stress — 30%<br/>L1 recovery calc, install feasibility, shared charger"]
    B --> F["Dim 2: Range Buffer — 25%<br/>sigmoid: 100 / (1 + e^(0.085 × (pct − 62)))"]
    B --> G["Dim 3: Recovery Resilience — 10%<br/>longest_day_pattern × charging_access"]
    B --> H["Dim 4: Climate Friction — 10%<br/>winter/hot × parking_exposure × heat_pump"]
    B --> I["Dim 5: Budget Fit — 15%<br/>100 × e^(-2.3 × over_budget_ratio)"]
    B --> J["Dim 6: Utility Fit — 10%<br/>body_style match + towing_needs"]
    E & F & G & H & I & J --> K["Cross-Dimension Multipliers"]
    K --> L{"Catastrophic zone?<br/>usage > 90% OR public + poor density"}
    L -->|"yes"| M["× 0.85 collapse multiplier"]
    L -->|"no"| N["Compound checks<br/>× 0.91 / × 0.93 / × 0.95"]
    M --> O["finalScore = round(clamp(weighted_sum × multiplier, 0, 100))"]
    N --> O
    O --> P["buildRankedBreakpoints()<br/>Top friction point → Plan B card"]
    P --> Q["RoutineFitScore<br/>score, label, mental_load, dimensions, failure_probability"]`;
}
