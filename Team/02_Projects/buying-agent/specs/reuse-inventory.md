# Reuse Inventory — existing OFFO features → agent

_Owner: CEO · 2026-10-19 · Tech Lead and Data-Intel: correct any path that's wrong on the board_

**Keep** = use as is (wrap as a tool) · **Combine** = merge into one tool · **Improve** = use, but fix first · **Retire (MVP)** = out of the agent for now; the code stays

| Capability | Where it lives | Decision | Agent tool | Notes |
|---|---|---|---|---|
| Listing extraction | `lib/listing-scraper.ts`, `app/api/extract-listing` | **Improve** | `analyze_listing` | Photo quality is a known weak spot. Extract facts only, don't rely on photos |
| Photo due diligence | `lib/photo-due-diligence.ts` | **Combine** | `analyze_listing` | Optional signal; never the basis for a verdict |
| Pricing / deal quality | `lib/pricing-engine.ts`, `lib/deal-quality-score.ts`, `lib/deals-score.ts` | **Combine** | `analyze_listing` | Produces the fair-price range for Section 5 |
| VIN decode + EV specs | `lib/vin-service.ts`, `app/api/vin/decode`, `app/api/vin/ev-specs` | **Keep** | `lookup_vin` | |
| VIN history | `lib/vin-history-client.ts`, `lib/vehicledatabases-client.ts` | **Keep** | `lookup_vin` | Open lien and title checks are a gap until ClearVin is live |
| Recalls | `lib/nhtsa-recall-client.ts`, `lib/nhtsa-recalls.ts` | **Keep** | `lookup_vin` | |
| Warranty | `lib/warranty-data.ts`, `app/api/tools/warranty` | **Combine** | `battery_health` | Battery warranty remaining |
| OBD SOH scan | `app/api/soh/*`, `lib/obd-pid-profiles.ts` | **Keep** | `battery_health` | When there's no scan, fall back to model-level risk and tell the buyer how to get one |
| Fit / routine scoring (EVFit) | `lib/compute-routine-fit-v2.ts`, `lib/batch-score-vehicles.ts`, `app/api/recommendations` | **Keep** | `match_fit` | Use V2 only |
| Weather + chargers | `lib/weather-client.ts`, `lib/charger-client.ts` | **Keep** | `match_fit` | NREL needs lat/lon |
| Ownership cost / risk | `lib/ownership-cost.ts`, `lib/compute-ownership-risk.ts` | **Combine** | `match_fit` | |
| Dealer questions | `lib/dealer-questions.ts` | **Keep** | `draft_seller_message` | |
| Seller message / voice | `lib/messaging-templates.ts` | **Keep** | `draft_seller_message` | Product-UX owns the tone |
| Report build + PDF V2 | `lib/build-report-contract.ts`, `lib/compose-report-blocks.ts`, `lib/pdf/ReportPdfV2.tsx` | **Improve** | (report output) | Map it to the 7 PRD sections; V2 only |
| Chat persistence | `chat_messages`, `app/api/advisor/sessions` | **Keep** | (agent memory) | |
| AI providers | `lib/providers/*` (circuit breaker, cost tracker) | **Keep** | (infra) | One model for the agent loop |
| Shortlist / saved vehicles | `lib/shortlist-store.ts`, `lib/shortlist-coach.ts` | **Keep** | (saved vehicles) | |
| Feature flags | `lib/feature-flags.ts`, `lib/rollout-flags.ts` | **Keep** | (infra) | Agent ships behind a flag |
| Current chat pipeline | `app/api/chat/route.ts` | **Retire (MVP)** | — | Replaced by the agent when the flag is on |
| Copart auction risk | `lib/auction/*`, `lib/copart-*` | **Retire (MVP)** | — | Different segment (salvage bidders) |
| Dealer portal, mechanic marketplace | `app/api/dealer*`, `app/api/mechanics` | **Retire (MVP)** | — | Mechanics only as an inspection referral link |
| Garage news | `app/api/news/garage` | **Retire (MVP)** | — | Unstable |
