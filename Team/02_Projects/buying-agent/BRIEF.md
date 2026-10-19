# OFFO Buying Agent — Brief

_Product owner: CEO · Build owner: Tech Lead · Started: 2026-10-19_

## Problem
Used-EV buyers can't judge battery health, history or fair price on their own. OFFO already answers each of these, but in separate tools that buyers have to find and piece together themselves.

## Bet
A single conversational agent that calls OFFO's existing capabilities as tools will convert and retain buyers better than separate features, and it's the thing they'll pay for.

## What exists vs. what's missing
- **Exists:** EVFit matching, VIN decode + history + recalls, OBD SOH scanning, the Copart 4-stage risk pipeline, negotiation generators, chat persistence (`chat_messages`, advisor sessions).
- **Missing:** the current `/api/chat` is a fixed 4-model pipeline with no tool calling, and it can't reach any of the above. That orchestration layer is the build.

## MVP scope (5 tools)
| Tool | Wraps | Data owner |
|---|---|---|
| `match_evs` | EVFit engine | Data-Intel |
| `lookup_vin` | VIN decode + VINAudit/VehicleDatabases history + NHTSA recalls | Data-Intel |
| `battery_health` | SOH computation | Data-Intel |
| `auction_risk` | Copart pipeline | Tech Lead |
| `draft_seller_message` | Negotiation generators | Product-UX (copy) |

## Out of scope for MVP
Garage news, listing-photo fixes, the V1 report schema, dealer portal changes.

## Success criteria
- In 5 moderated sessions, the buyer reaches a confident go/no-go on a specific vehicle without leaving the chat
- Agent turn p95 under 15s, with cost per session tracked
- At least 3 of 10 interviewed buyers say they'd pay (price tested by Growth)

## Open questions
- Price and packaging → Growth + CEO, by 2026-11-14
- Keep the 10 msg/day chat cap? Its code comment still says "upgrade", but nothing is paid
