"""
Qualification Engine — deterministic post scoring for the PRAW scanner.

Scores each incoming Reddit post (0.0–1.0) and decides whether it should
enter the multi-AI pipeline. Purely keyword/heuristic — no LLM calls, so
it runs in microseconds per post.

Threshold: 0.65 to proceed.
"""
from __future__ import annotations

from dataclasses import dataclass


# -------------------------
# Signal lists
# -------------------------

DECISION_KEYWORDS = [
    "good deal", "worth it", "should i buy", "thinking of buying",
    "is this a good price", "buy this", "deal check", "thoughts on this",
    "is this a good", "is this worth", "should i get", "bad deal",
    "overpaying", "fair price", "reasonable price", "too expensive",
    "is this overpriced", "pull the trigger", "make an offer",
    "negotiating", "what would you pay", "what should i offer",
]

DETAIL_SIGNALS = [
    "http", "price", "$", "miles", "km", "mileage", "year", "vin",
    "listing", "cargurus", "autotrader", "dealership", "carfax",
    "private seller", "asking", "odometer", "carmax", "vroom",
    "facebook marketplace", "craigslist", "offer",
]

ROUTINE_SIGNALS = [
    "charge", "charging", "commute", "apartment", "garage", "winter",
    "miles per day", "home charger", "public charging", "work",
    "road trip", "range anxiety", "daily driver", "lease", "financing",
]

EXCLUDE_PATTERNS = [
    "meme", "lol", "vs ice", "brand war", "superiority",
    "fanboy", "announced", "breaking", "news:", "just got",
    "just delivered", "delivery day", "finally arrived",
]

# Subreddits where buying-intent posts are most valuable
HIGH_VALUE_SUBREDDITS = {
    "electricvehicles", "electriccars", "whatcarshouldibuy",
    "askcarsales", "teslamotors", "rivian", "ioniq5", "bolt_ev",
    "chevybolt", "nissanleaf",
}


# -------------------------
# Score result
# -------------------------

@dataclass
class QualificationScore:
    intent_score: float       # 0–1: does post signal buying decision?
    detail_score: float       # 0–1: does post include car/price/listing detail?
    routine_score: float      # 0–1: does post mention lifestyle/charging signals?
    spam_risk: float          # 0–1: meme, brand war, news? (subtracted)
    final_score: float        # 0–1: weighted composite
    should_reply: bool        # True if final_score >= 0.65
    disqualify_reason: str    # non-empty if should_reply = False


# -------------------------
# Scoring logic
# -------------------------

def qualify_post(title: str, body: str, subreddit: str) -> QualificationScore:
    """
    Score a Reddit post for buying intent and OFFO reply relevance.

    Weights: intent*0.50 + detail*0.30 + routine*0.20 - spam_risk
    Threshold: 0.65 to proceed into the pipeline.

    Hard disqualifiers (override score):
      - spam_risk > 0.5   → always skip
      - intent_score < 0.3 → no buying intent detected, skip
      - body < 20 chars   → too vague to help
    """
    combined = (title + " " + body).lower()
    title_lower = title.lower()
    subreddit_lower = subreddit.lower().lstrip("r/")

    # --- Intent score ---
    intent_hits = sum(1 for kw in DECISION_KEYWORDS if kw in combined)
    # Title match is worth more
    title_intent_hits = sum(1 for kw in DECISION_KEYWORDS if kw in title_lower)
    intent_score = min(1.0, (intent_hits * 0.2) + (title_intent_hits * 0.3))

    # --- Detail score ---
    detail_hits = sum(1 for sig in DETAIL_SIGNALS if sig in combined)
    detail_score = min(1.0, detail_hits * 0.15)
    # Body length bonus (more text = more detail to work with)
    if len(body) < 20:
        detail_score = 0.0
    elif len(body) > 200:
        detail_score = min(1.0, detail_score + 0.2)

    # --- Routine/lifestyle score ---
    routine_hits = sum(1 for sig in ROUTINE_SIGNALS if sig in combined)
    routine_score = min(1.0, routine_hits * 0.25)

    # --- Spam risk ---
    spam_hits = sum(1 for pat in EXCLUDE_PATTERNS if pat in combined)
    spam_risk = min(1.0, spam_hits * 0.4)

    # --- Subreddit bonus ---
    subreddit_bonus = 0.1 if subreddit_lower in HIGH_VALUE_SUBREDDITS else 0.0

    # --- Composite ---
    raw = (
        intent_score * 0.50
        + detail_score * 0.30
        + routine_score * 0.20
        - spam_risk
        + subreddit_bonus
    )
    final_score = round(max(0.0, min(1.0, raw)), 3)

    # --- Hard disqualifiers ---
    if spam_risk > 0.5:
        return QualificationScore(
            intent_score=intent_score,
            detail_score=detail_score,
            routine_score=routine_score,
            spam_risk=spam_risk,
            final_score=final_score,
            should_reply=False,
            disqualify_reason="spam_risk_too_high",
        )

    if intent_score < 0.3:
        return QualificationScore(
            intent_score=intent_score,
            detail_score=detail_score,
            routine_score=routine_score,
            spam_risk=spam_risk,
            final_score=final_score,
            should_reply=False,
            disqualify_reason="no_buying_intent",
        )

    if len(body.strip()) < 20:
        return QualificationScore(
            intent_score=intent_score,
            detail_score=detail_score,
            routine_score=routine_score,
            spam_risk=spam_risk,
            final_score=final_score,
            should_reply=False,
            disqualify_reason="body_too_short",
        )

    should_reply = final_score >= 0.65
    reason = "" if should_reply else f"score_below_threshold ({final_score:.2f})"

    return QualificationScore(
        intent_score=intent_score,
        detail_score=detail_score,
        routine_score=routine_score,
        spam_risk=spam_risk,
        final_score=final_score,
        should_reply=should_reply,
        disqualify_reason=reason,
    )
