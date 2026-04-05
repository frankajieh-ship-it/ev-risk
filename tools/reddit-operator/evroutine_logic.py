"""
OFFO Tool Invite Decision Engine — Reddit Operator Tool v2

Three tools on offolab.com, each serving a different user need:

  /routine  — 7-question fit check (60s, anonymous)
              "Which EV fits MY life?" — pre-purchase uncertainty, no specific car yet
              → Invite when: user is uncertain, no specific listing mentioned, general EV anxiety

  /receipt  — Paste any listing URL → instant friction receipt + VIN analysis + dealer questions
              "Should I buy THIS specific car?" — analyzing a real listing
              → Invite when: user mentions a specific listing, price, VIN, mileage, dealer

  /compare  — Side-by-side routine-fit comparison of two EVs
              "Which of THESE TWO is better for me?" — choosing between specific options
              → Invite when: user is comparing two named EVs / two options

Routing logic:
  COMPARING_TWO_OPTIONS + specific models  → /compare
  Specific listing / VIN / price / dealer  → /receipt
  General uncertainty / no specific car    → /routine
  Brand war / confident / news             → no invite
"""
from __future__ import annotations

import re
from typing import List, Optional

from models import EVRoutineInviteDecision, TechSupportFlag


# -------------------------
# Tool URLs
# -------------------------

TOOL_URLS = {
    "routine":   "https://offolab.com/routine",
    "receipt":   "https://offolab.com/receipt",
    "compare":   "https://offolab.com/compare",
    "dealer_qa": "https://offolab.com/receipt",  # dealer Q&A is part of the receipt flow
    "dealer":    "https://offolab.com/workspace",
}


def _build_receipt_url(detected_vehicle: Optional[dict]) -> str:
    """Build a pre-populated receipt URL from detected vehicle data."""
    if not detected_vehicle:
        return TOOL_URLS["receipt"]
    import urllib.parse
    params = {}
    if detected_vehicle.get("year"):
        params["year"] = str(detected_vehicle["year"])
    if detected_vehicle.get("make"):
        params["make"] = detected_vehicle["make"]
    if detected_vehicle.get("model"):
        params["model"] = detected_vehicle["model"]
    if detected_vehicle.get("price_mentioned"):
        params["price"] = str(detected_vehicle["price_mentioned"])
    if detected_vehicle.get("mileage_mentioned"):
        params["mileage"] = str(detected_vehicle["mileage_mentioned"])
    if not params:
        return TOOL_URLS["receipt"]
    return f"{TOOL_URLS['receipt']}?{urllib.parse.urlencode(params)}"


def _build_compare_url(detected_vehicle: Optional[dict]) -> str:
    """Build a pre-populated compare URL from detected vehicle data (first vehicle)."""
    if not detected_vehicle:
        return TOOL_URLS["compare"]
    import urllib.parse
    params = {}
    if detected_vehicle.get("year"):
        params["y1"] = str(detected_vehicle["year"])
    if detected_vehicle.get("make"):
        params["m1"] = detected_vehicle["make"]
    if detected_vehicle.get("model"):
        params["mo1"] = detected_vehicle["model"]
    if not params:
        return TOOL_URLS["compare"]
    return f"{TOOL_URLS['compare']}?{urllib.parse.urlencode(params)}"

# -------------------------
# Invite text per tool
# -------------------------

INVITE_TEXT = {
    "routine": (
        "If it helps, we built a free 60-second EV fit check (no signup) that shows "
        "where charging will fade into the background vs keep resurfacing in your routine. "
        "offolab.com/routine"
    ),
    "receipt": (
        "If you want a quick sanity-check on that listing, paste the URL at offolab.com/receipt — "
        "it pulls the VIN, flags the real friction points, and gives you the dealer follow-up "
        "questions worth asking."
    ),
    "compare": (
        "If you're stuck between the two, offolab.com/compare lets you run a routine-fit "
        "comparison side by side — it shows which one will fade into the background vs "
        "keep resurfacing based on how you actually drive."
    ),
    "dealer_qa": (
        "I can help generate personalized seller follow-up questions — if you share the listing "
        "at offolab.com/receipt it'll pull the VIN and surface exactly what to ask the dealer."
    ),
    "dealer": (
        "If you're the seller, offolab.com/workspace lets you upload the listing directly and "
        "get matched with serious buyers who've already done their EV research."
    ),
    "vin": (
        "I can run a VIN decode + risk check — paste the 17-character VIN and I'll pull the "
        "history flags. Or drop the listing at offolab.com/receipt for the full analysis."
    ),
}

TOOL_BLURBS = {
    "routine": (
        "We built a free 7-question EV fit check (60 seconds, anonymous) at offolab.com/routine "
        "that surfaces your specific friction points — charging access, routine variability, "
        "seasonal factors — and tells you what would break first."
    ),
    "receipt": (
        "offolab.com/receipt lets you paste any listing URL (AutoTrader, Carvana, CarGurus, etc.) "
        "and get an instant friction receipt: VIN check, real risk flags, and the exact "
        "dealer questions worth asking before you commit."
    ),
    "compare": (
        "offolab.com/compare runs a side-by-side routine-fit analysis on two EVs — not specs, "
        "but which one fits your charging anchor, planning tolerance, and weekly variability."
    ),
    "dealer_qa": (
        "offolab.com/receipt generates a personalized set of dealer follow-up questions based on "
        "the specific listing — VIN flags, mileage context, and the questions buyers usually forget to ask."
    ),
    "dealer": (
        "offolab.com/workspace is built for dealers and private sellers — upload your listing, "
        "get matched with OFFO buyers who have already completed their EV fit check."
    ),
}

# -------------------------
# Detection patterns
# -------------------------

# Signals that user is talking about a SPECIFIC listing (→ /receipt)
LISTING_PATTERNS = [
    r"\bvin\b",
    r"\bcarfax\b",
    r"\bcarmax\b",
    r"\bcarvana\b",
    r"\bautotrader\b",
    r"\bcargurus\b",
    r"\bcars\.com\b",
    r"\$\d{3,}",                        # price like $18,500
    r"\b\d{4}\s+\w+\s+\w+\b",          # year make model like "2021 Chevy Bolt"
    r"\b\d{4,6}\s*(miles?|km)\b",       # mileage
    r"\bdealer\b",
    r"\bsalesperson\b",
    r"\bnegotiat\b",
    r"\blisting\b",
    r"\bfor sale\b",
    r"\bused\b.*\bev\b",
    r"\bcertified pre.?owned\b",
    r"\bcpo\b",
    r"\boffer(ing|ed)?\b.*\bprice\b",
    r"\bthey.?re asking\b",
    r"\bask(ing)? price\b",
]

# Signals that user is comparing TWO specific options (→ /compare)
COMPARE_PATTERNS = [
    r"\bvs\.?\b",
    r"\bversus\b",
    r"\bor the\b",
    r"\bcompare\b",
    r"\bbetween\b.*\band\b",
    r"\bwhich (is|would|one)\b",
    r"\btwo (options|choices|evs|cars)\b",
    r"\boption (a|b|1|2)\b",
    r"\bchoosing between\b",
    r"\bcan.?t decide\b",
]

# Friction triggers that warrant a /routine invite
ROUTINE_FRICTION_TRIGGERS = {
    "NO_HOME_CHARGING",
    "BATTERY_HEALTH_ANXIETY",
    "PREDICTABILITY_LOW",
    "ROUTINE_VARIABILITY_HIGH",
    "PLANNING_TOLERANCE_LOW",
    "SEASONAL_SENSITIVITY",
}

# Signals that block any invite
NO_INVITE_STATES = {"confident", "excited"}
NO_INVITE_INTENTS = {"debate", "news"}
NO_INVITE_TAGS = {"BRAND_WAR_RISK"}

# Intents that route to specific tools regardless of text patterns
INTENT_TOOL_MAP = {
    "vin_analysis":     ("receipt",   "vin",       "intent:vin_analysis"),
    "compare_listings": ("compare",   "compare",   "intent:compare_listings"),
    "listing_rating":   ("receipt",   "receipt",   "intent:listing_rating"),
    "pricing_deal":     ("receipt",   "receipt",   "intent:pricing_deal"),
    "dealer_questions": ("dealer_qa", "dealer_qa", "intent:dealer_questions"),
    "dealer_upload":    ("dealer",    "dealer",    "intent:dealer_upload"),
    "routine_fit":      ("routine",   "routine",   "intent:routine_fit"),
    "charging_question":("routine",   "routine",   "intent:charging_question"),
    "purchase_advice":  ("routine",   "routine",   "intent:purchase_advice"),
}


def _has_any(text: str, patterns: List[str]) -> bool:
    t = text.lower()
    return any(re.search(p, t) for p in patterns)


# -------------------------
# Main routing logic
# -------------------------

def decide_tool_invite(
    friction_tags: List[str],
    user_state: Optional[str],
    intent: Optional[str],
    combined_text: str = "",
    detected_vehicle: Optional[dict] = None,
) -> EVRoutineInviteDecision:
    """
    Decide which OFFO tool (if any) to invite the user to.

    Priority order (first match wins):
    1. Hard blocks — brand war, confident, news → no invite
    2. VIN_MENTIONED tag OR vin_analysis intent → /receipt (VIN invite)
    3. TWO_LISTINGS_MENTIONED OR compare_listings intent → /compare
    4. SPECIFIC_LISTING_PRESENT OR listing_rating / pricing_deal intent → /receipt
    5. dealer_questions intent → dealer_qa
    6. dealer_upload intent → dealer
    7. Intent-to-tool map (routine_fit, charging_question, purchase_advice) → /routine
    8. Listing URL patterns (regex) → /receipt
    9. Compare patterns (regex) → /compare
    10. Friction tag OR uncertain → /routine
    11. Default → no invite
    """
    # Hard blocks
    if user_state in NO_INVITE_STATES:
        return EVRoutineInviteDecision(should_invite=False)
    if intent in NO_INVITE_INTENTS:
        return EVRoutineInviteDecision(should_invite=False)
    if any(t in NO_INVITE_TAGS for t in friction_tags):
        return EVRoutineInviteDecision(should_invite=False)

    text = combined_text.lower()

    # Rule 1: VIN → /receipt (highest specificity)
    if "VIN_MENTIONED" in friction_tags or intent == "vin_analysis":
        receipt_url = _build_receipt_url(detected_vehicle)
        invite = INVITE_TEXT["vin"]
        if detected_vehicle and receipt_url != TOOL_URLS["receipt"]:
            invite = invite.replace("offolab.com/receipt", receipt_url)
        return EVRoutineInviteDecision(
            should_invite=True,
            tool="receipt",
            invite_text=invite,
            trigger_reason="vin_mentioned",
        )

    # Rule 2: Two listings → /compare
    if (
        "TWO_LISTINGS_MENTIONED" in friction_tags
        or intent == "compare_listings"
        or "COMPARING_TWO_OPTIONS" in friction_tags
    ):
        compare_url = _build_compare_url(detected_vehicle)
        invite = INVITE_TEXT["compare"]
        if detected_vehicle and compare_url != TOOL_URLS["compare"]:
            invite = invite.replace("offolab.com/compare", compare_url)
        return EVRoutineInviteDecision(
            should_invite=True,
            tool="compare",
            invite_text=invite,
            trigger_reason="comparing_two_options",
        )

    # Rule 3: Specific listing / pricing deal → /receipt
    if (
        "SPECIFIC_LISTING_PRESENT" in friction_tags
        or intent in ("listing_rating", "pricing_deal")
        or _has_any(text, LISTING_PATTERNS)
    ):
        receipt_url = _build_receipt_url(detected_vehicle)
        invite = INVITE_TEXT["receipt"]
        if detected_vehicle and receipt_url != TOOL_URLS["receipt"]:
            # Build a vehicle label for a more personal invite
            dv = detected_vehicle
            label_parts = [str(dv["year"]) if dv.get("year") else None, dv.get("make"), dv.get("model")]
            label = " ".join(p for p in label_parts if p)
            invite = (
                f"If you want a quick sanity-check on {'the ' + label if label else 'that listing'}, "
                f"paste the URL at {receipt_url} — "
                "it pulls the VIN, flags the real friction points, and gives you the dealer "
                "follow-up questions worth asking."
            )
        return EVRoutineInviteDecision(
            should_invite=True,
            tool="receipt",
            invite_text=invite,
            trigger_reason="specific_listing",
        )

    # Rule 4: Dealer questions
    if intent == "dealer_questions":
        return EVRoutineInviteDecision(
            should_invite=True,
            tool="dealer_qa",
            invite_text=INVITE_TEXT["dealer_qa"],
            trigger_reason="intent:dealer_questions",
        )

    # Rule 5: Dealer upload
    if intent == "dealer_upload":
        return EVRoutineInviteDecision(
            should_invite=True,
            tool="dealer",
            invite_text=INVITE_TEXT["dealer"],
            trigger_reason="intent:dealer_upload",
        )

    # Rule 6: Compare via text patterns
    if _has_any(text, COMPARE_PATTERNS):
        return EVRoutineInviteDecision(
            should_invite=True,
            tool="compare",
            invite_text=INVITE_TEXT["compare"],
            trigger_reason="compare_pattern",
        )

    # Rule 7: Friction tag or intent → /routine
    triggering_tags = [t for t in friction_tags if t in ROUTINE_FRICTION_TRIGGERS]
    if triggering_tags:
        return EVRoutineInviteDecision(
            should_invite=True,
            tool="routine",
            invite_text=INVITE_TEXT["routine"],
            trigger_reason=f"friction_tag:{triggering_tags[0]}",
        )

    if intent in ("routine_fit", "charging_question", "purchase_advice") or user_state == "uncertain":
        return EVRoutineInviteDecision(
            should_invite=True,
            tool="routine",
            invite_text=INVITE_TEXT["routine"],
            trigger_reason="user_uncertain" if user_state == "uncertain" else f"intent:{intent}",
        )

    return EVRoutineInviteDecision(should_invite=False)


# Backward-compat alias used by old pipeline code
def decide_evroutine_invite(
    friction_tags: List[str],
    user_state: Optional[str],
    intent: Optional[str],
    combined_text: str = "",
    detected_vehicle: Optional[dict] = None,
) -> EVRoutineInviteDecision:
    return decide_tool_invite(friction_tags, user_state, intent, combined_text, detected_vehicle)


def get_tool_blurb(tool: str) -> str:
    """Return the full tool blurb for a given tool key."""
    return TOOL_BLURBS.get(tool, TOOL_BLURBS["routine"])


def get_tool_url(tool: str) -> str:
    """Return the URL for a given tool key."""
    return TOOL_URLS.get(tool, TOOL_URLS["routine"])


# -------------------------
# Tech support funnel
# -------------------------

SUPPORT_PATTERNS = {
    "extraction_fail": [
        r"\bextract(ion)?\b.*\bfail(ed|ing)?\b",
        r"\bdidn.?t (work|parse|extract)\b",
        r"\bwrong (price|mileage|year|model)\b",
        r"\bincorrect (data|info|details)\b",
        r"\bmissed\b.*\bdetails?\b",
        r"\bcan.?t (read|find|parse)\b.*\blisting\b",
    ],
    "my_garage": [
        r"\bmy garage\b",
        r"\bsaved (cars?|vehicles?|listings?)\b",
        r"\bwhere.?s my\b",
        r"\bcan.?t find\b.*\b(saved|previous)\b",
    ],
    "receipt": [
        r"\breceipt\b.*\b(not|didn.?t|wrong|broken)\b",
        r"\bvin\b.*\b(not|failed|wrong)\b",
        r"\banalysis\b.*\b(not|didn.?t|wrong)\b",
    ],
    "compare": [
        r"\bcompare\b.*\b(not|doesn.?t|broken|stuck)\b",
        r"\bcomparison\b.*\b(not|failed|wrong)\b",
    ],
    "general": [
        r"\bhow do i\b.*\btool\b",
        r"\bnot (loading|working|showing)\b",
        r"\bbroken\b.*\bsite\b",
        r"\bstuck\b.*\b(page|screen|loading)\b",
        r"\boffolab\b.*\b(help|issue|problem|error)\b",
    ],
}

SUPPORT_REPLY_SUFFIXES = {
    "extraction_fail": (
        "If the listing didn't parse right, try pasting it directly at offolab.com/receipt — "
        "it handles most major listing sites. Want me to walk you through it?"
    ),
    "receipt": (
        "For receipt issues, try re-pasting the listing URL at offolab.com/receipt. "
        "If it's still off, say 'show me' and I'll walk you through it."
    ),
    "compare": (
        "For comparison issues, try again at offolab.com/compare. "
        "Say 'show me' if you want step-by-step help."
    ),
    "my_garage": (
        "Your saved vehicles should be in the Garage section. "
        "Say 'show me' and I'll walk you through finding them."
    ),
    "general": (
        "Want me to walk you through this in the tool? "
        "Just say 'show me' and I'll generate the exact steps."
    ),
}


def detect_tech_support(text: str) -> TechSupportFlag:
    """
    Detect whether a Reddit post is a support question about the OFFO tool.
    """
    t = text.lower()

    for support_type, patterns in SUPPORT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, t):
                return TechSupportFlag(
                    is_support_question=True,
                    support_type=support_type,
                    suggested_reply_suffix=SUPPORT_REPLY_SUFFIXES.get(
                        support_type, SUPPORT_REPLY_SUFFIXES["general"]
                    ),
                )

    return TechSupportFlag(is_support_question=False)
