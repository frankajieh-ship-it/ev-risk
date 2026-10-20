# OFFO Buying Agent — Brief

_Product owner: CEO · Build owner: Tech Lead · Started: 2026-10-19_

## Problem
Used-EV buyers can't judge battery health, history or fair price on their own. OFFO already answers each of these, but in separate tools that buyers have to find and piece together themselves.

## Bet
A single conversational agent that calls OFFO's existing capabilities as tools will convert and retain buyers better than separate features, and it's the thing they'll pay for.

## What exists vs. what's missing
- **Exists:** EVFit matching, VIN decode + history + recalls, OBD SOH scanning, the Copart 4-stage risk pipeline, negotiation generators, chat persistence (`chat_messages`, advisor sessions).
- **Missing:** the current `/api/chat` is a fixed 4-model pipeline with no tool calling, and it can't reach any of the above. That orchestration layer is the build.

> **The requirements are in [PRD.md](PRD.md)** (target customer, report contents, acceptance criteria). Feature mapping: [specs/reuse-inventory.md](specs/reuse-inventory.md).

## MVP scope (5 tools) — revised 2026-10-19, see D-005
| Tool | Wraps | Data owner |
|---|---|---|
| `analyze_listing` | Listing extraction + pricing/deal quality | Data-Intel |
| `lookup_vin` | VIN decode + VINAudit/VehicleDatabases history + NHTSA recalls | Data-Intel |
| `battery_health` | SOH computation + battery warranty | Data-Intel |
| `match_fit` | EVFit routine fit + weather/chargers + ownership cost | Data-Intel |
| `draft_seller_message` | Dealer questions + messaging templates | Product-UX (copy) |

## Out of scope for MVP
Copart auction risk, garage news, listing-photo fixes, the V1 report schema, dealer portal changes.

## Success criteria
See the acceptance criteria in [PRD.md](PRD.md).

## Open questions
- Price and packaging → Growth + CEO, by 2026-11-14
- Keep the 10 msg/day chat cap? Its code comment still says "upgrade", but nothing is paid
