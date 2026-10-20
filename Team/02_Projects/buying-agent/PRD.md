# PRD — OFFO Buying Agent (MVP)

_Owner: CEO · Status: **Approved for build** · 2026-10-19 · Feedback: comment on `01_Comms/BOARD.md`_

## Vision
A buyer pastes a used-EV listing and gets an evidence-backed answer: **should I buy this car, at this price, for my life?** Not a chatbot that talks about EVs, but an agent that checks the car and makes a call.

## Target customer (first segment)
**A US first-time EV buyer with a specific used EV in mind.**
- Has a listing URL or VIN (dealer or private party), and is 1–3 weeks from buying
- Budget of about $15k–$40k; the car is 2018 or newer
- Main fear: battery health, a hidden history, overpaying, or "will it work for my commute/charging?"

**Not this segment (for now):** salvage/auction bidders, dealers, buyers still browsing with no car picked, fleet buyers.

## Core use case
1. Buyer pastes a listing URL or VIN and gives their ZIP + 3 answers (home charging? daily miles? budget).
2. The agent runs the checks (listing, VIN history, recalls, battery, fit, price) and asks follow-ups only when needed.
3. The buyer gets a **Buying Report** with a verdict, and can ask follow-up questions in chat.

## What the Buying Report must contain
| # | Section | Must answer |
|---|---|---|
| 1 | **Verdict** | Buy / Buy with conditions / Walk away, with a confidence level and the top 3 reasons |
| 2 | **Battery** | SOH evidence (scan if available, otherwise model-level risk), warranty remaining, what to ask for |
| 3 | **History** | Title brand, accidents, owners, open recalls. Open lien and title checks are marked **unverified** until ClearVin is live |
| 4 | **Fit** | Range vs. their daily miles in their climate, charging access, real cost to own |
| 5 | **Price** | Fair price range vs. asking price, and how much negotiation room there is |
| 6 | **Next steps** | Questions for the seller, a ready-to-send negotiation message, an inspection checklist |
| 7 | **Evidence & gaps** | A source for every claim, plus an explicit "we couldn't verify" list. No guessed facts, ever |

## Scope
**In:** 5 agent tools (`analyze_listing`, `lookup_vin`, `battery_health`, `match_fit`, `draft_seller_message`), the Buying Report (V2 schema), saved vehicles, chat follow-ups. All behind a feature flag.
**Out:** Copart auction risk, dealer portal, mechanic marketplace (used only as a "get an inspection" referral), garage news, new PDF templates.

## MVP acceptance criteria (all must pass to launch)
1. **Completeness:** on a 20-VIN test set, 100% of reports contain all 7 sections; missing data appears in Section 7, never as a blank or a guess.
2. **Accuracy:** 0 fabricated facts across the 20-VIN set (Data-Intel signs off on every tool's output).
3. **Speed:** first verdict in ≤ 90s from paste; chat turn p95 ≤ 15s.
4. **Cost:** ≤ $0.50 model cost per report (Tech Lead confirms or proposes a revised target by 10-23).
5. **Usability:** in 5 moderated sessions, ≥ 4 buyers reach a decision without leaving OFFO and rate the report ≥ 4/5 for usefulness.
6. **Safety:** works on mobile; the existing `/api/chat` is untouched when the flag is off.

## Pricing experiment (approval: CEO · design: Growth)
Hypothesis: **free verdict + paid full report** (Sections 2–7) at a one-time **$19–$29**. We test it with real checkout, using the Stripe setup that's already wired, on flag-enabled traffic only. Growth delivers the experiment design by **11-06**, and the CEO decides by **11-14**.

## Primary KPI
**Buyers who got real value and showed they'd pay.** Measured as: % of reports that end in a decision the buyer acts on, and the number of buyers who pay or pre-commit.
