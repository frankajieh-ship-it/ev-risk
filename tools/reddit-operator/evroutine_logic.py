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
    "routine": "https://offolab.com/routine",
    "receipt": "https://offolab.com/receipt",
    "compare": "https://offolab.com/compare",
}

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
) -> EVRoutineInviteDecision:
    """
    Decide which OFFO tool (if any) to invite the user to.

    Priority order:
    1. Hard blocks — brand war, confident, news → no invite
    2. Comparing two specific options → /compare
    3. Specific listing / VIN / dealer / price → /receipt
    4. Friction tag triggered OR user uncertain → /routine
    5. Default → no invite
    """
    # Hard blocks
    if user_state in NO_INVITE_STATES:
        return EVRoutineInviteDecision(should_invite=False)
    if intent in NO_INVITE_INTENTS:
        return EVRoutineInviteDecision(should_invite=False)
    if any(t in NO_INVITE_TAGS for t in friction_tags):
        return EVRoutineInviteDecision(should_invite=False)

    text = combined_text.lower()

    # Rule 1: Comparing two options → /compare
    if (
        "COMPARING_TWO_OPTIONS" in friction_tags
        or intent == "comparison"
        or _has_any(text, COMPARE_PATTERNS)
    ):
        return EVRoutineInviteDecision(
            should_invite=True,
            tool="compare",
            invite_text=INVITE_TEXT["compare"],
            trigger_reason="comparing_two_options",
        )

    # Rule 2: Specific listing → /receipt
    if _has_any(text, LISTING_PATTERNS):
        return EVRoutineInviteDecision(
            should_invite=True,
            tool="receipt",
            invite_text=INVITE_TEXT["receipt"],
            trigger_reason="specific_listing",
        )

    # Rule 3: Friction tag or uncertainty → /routine
    triggering_tags = [t for t in friction_tags if t in ROUTINE_FRICTION_TRIGGERS]
    if triggering_tags:
        return EVRoutineInviteDecision(
            should_invite=True,
            tool="routine",
            invite_text=INVITE_TEXT["routine"],
            trigger_reason=f"friction_tag:{triggering_tags[0]}",
        )

    if user_state == "uncertain":
        return EVRoutineInviteDecision(
            should_invite=True,
            tool="routine",
            invite_text=INVITE_TEXT["routine"],
            trigger_reason="user_uncertain",
        )

    return EVRoutineInviteDecision(should_invite=False)


# Backward-compat alias used by old pipeline code
def decide_evroutine_invite(
    friction_tags: List[str],
    user_state: Optional[str],
    intent: Optional[str],
    combined_text: str = "",
) -> EVRoutineInviteDecision:
    return decide_tool_invite(friction_tags, user_state, intent, combined_text)


def get_tool_blurb(tool: str) -> str:
    """Return the full tool blurb for a given tool key."""
    return TOOL_BLURBS.get(tool, TOOL_BLURBS["routine"])


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
