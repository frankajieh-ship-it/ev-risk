"""
Classification engine for Reddit posts.
Detects intent, user state, ownership phase, and tool intro permission.
"""
from __future__ import annotations

import re
from typing import List

from models import Intent, UserState, OwnershipPhase, ToolIntro


# -------------------------
# Pattern constants
# -------------------------

UNCERTAINTY_PATTERNS = [
    r"\bnot sure\b",
    r"\bunsure\b",
    r"\bshould i\b",
    r"\bwould it work\b",
    r"\bworth it\b",
    r"\bthinking of\b",
    r"\bthinking about\b",
    r"\bconsidering\b",
    r"\bworry\b",
    r"\bworried\b",
    r"\banxious\b",
    r"\bhelp\b",
    r"\badvice\b",
    r"\bwhat do you think\b",
    r"\bam i\b",
    r"\bwill it\b",
    r"\bwill i\b",
]

ASKED_FOR_TOOL_PATTERNS = [
    r"\bchecklist\b",
    r"\btool\b",
    r"\broutine check\b",
    r"\bsanity[- ]?check\b",
    r"\blink\b",
    r"\bshare\b",
    r"\bcalculator\b",
]

COMPARISON_PATTERNS = [
    r"\bvs\b",
    r"\bversus\b",
    r"\bcompare\b",
    r"\bcomparison\b",
    r"\boption\b",
    r"\bwhich\b.*\bor\b",
    r"\bbetween\b",
    r"\bchoose\b",
    r"\bdecide\b",
]

NO_HOME_CHARGING_PATTERNS = [
    r"\bno home\b",
    r"\bapartment\b",
    r"\bflat\b",
    r"\bcondo\b",
    r"\brental\b",
    r"\bpublic charging\b",
    r"\bcan.?t charge at home\b",
    r"\bno garage\b",
    r"\bstreet parking\b",
]

SEASON_PATTERNS = [
    r"\bwinter\b",
    r"\bcold\b",
    r"\bfreezing\b",
    r"\bsnow\b",
    r"\bice\b",
    r"\b(-?\d+)\s?[cf]\b",  # temperature mentions
]

BATTERY_HEALTH_PATTERNS = [
    r"\bsoh\b",
    r"\bbattery health\b",
    r"\bdegradation\b",
    r"\bbattery life\b",
    r"\brange loss\b",
]

BRAND_WAR_PATTERNS = [
    r"\btesla fan\b",
    r"\btrash\b",
    r"\bsuperiority\b",
    r"\bfanboy\b",
    r"\bidiot\b",
    r"\bstupid\b",
    r"\bdumb\b",
    r"\bworse\b.*\bthan\b",
    r"\bbetter\b.*\bthan\b.*\balways\b",
]


def _has_any(text: str, patterns: List[str]) -> bool:
    """Check if text matches any of the regex patterns."""
    t = text.lower()
    return any(re.search(p, t) for p in patterns)


# -------------------------
# Detection functions
# -------------------------

def detect_intent(text: str) -> Intent:
    """Classify the primary intent of the post."""
    t = text.lower()

    # Comparison intent takes priority
    if _has_any(t, COMPARISON_PATTERNS):
        return "comparison"

    # Charging-related questions
    if _has_any(t, NO_HOME_CHARGING_PATTERNS) or "charge" in t or "charger" in t:
        return "charging_question"

    # Purchase advice (uncertainty + buying context)
    if _has_any(t, UNCERTAINTY_PATTERNS):
        if any(w in t for w in ["buy", "purchase", "get", "getting", "first ev", "new ev"]):
            return "purchase_advice"

    # News/article sharing
    if any(w in t for w in ["news", "article", "reported", "announced", "release"]):
        return "news"

    # Debate/advocacy
    if any(w in t for w in ["debate", "vs ice", "superiority", "better than"]):
        return "debate"

    # Ownership support (existing owners seeking help)
    if any(w in t for w in ["my ev", "my car", "i have", "i own", "i drive"]):
        return "ownership_support"

    return "unknown"


def detect_user_state(text: str) -> UserState:
    """Detect the emotional state of the user."""
    t = text.lower()

    if _has_any(t, UNCERTAINTY_PATTERNS):
        return "uncertain"

    if any(w in t for w in ["love", "excited", "thrilled", "amazing", "fantastic", "great"]):
        return "excited"

    if any(w in t for w in ["hate", "annoyed", "frustrated", "sick of", "tired of", "angry"]):
        return "frustrated"

    if any(w in t for w in ["skeptical", "doubt", "not convinced", "don't believe", "suspicious"]):
        return "skeptical"

    if any(w in t for w in ["decided", "going to", "will buy", "already", "confident"]):
        return "confident"

    return "unknown"


def detect_phase(text: str) -> OwnershipPhase:
    """Detect ownership phase based on text cues."""
    t = text.lower()

    # Buyer phase (pre-purchase)
    if any(w in t for w in [
        "first ev", "never had an ev", "thinking about getting", "buying an ev",
        "should i buy", "looking to buy", "considering", "before i buy"
    ]):
        return "buyer"

    # Early ownership (0-3 months)
    if re.search(r"\b(1|2|3|one|two|three)\s*(week|weeks|month|months)\b", t):
        if any(w in t for w in ["just got", "recently", "new owner", "just bought"]):
            return "0_3"

    # Mid ownership (4-12 months)
    if re.search(r"\b(4|5|6|7|8|9|10|11|12|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(month|months)\b", t):
        return "4_12"

    # Long-term (12+ months)
    if any(w in t for w in ["years", "year", "18 months", "2 years", "3 years", "long time"]):
        return "12_plus"

    # Default to buyer if uncertain context suggests pre-purchase
    if _has_any(t, UNCERTAINTY_PATTERNS) and any(w in t for w in ["buy", "get", "purchase"]):
        return "buyer"

    return "unknown"


def decide_tool_intro(text: str, user_state: UserState) -> ToolIntro:
    """
    Determine whether to introduce the OFFO tool.

    HARD-CODED RULE: Only introduce tool if:
    1. User explicitly asks for a tool/checklist/link
    2. User expresses uncertainty AND we detect uncertainty patterns

    This is the core brand safety rule - never push the tool unsolicited.
    """
    t = text.lower()

    # Asked directly - user wants a tool/checklist
    if _has_any(t, ASKED_FOR_TOOL_PATTERNS):
        return "asked_directly"

    # Offer by permission - user is uncertain
    if user_state == "uncertain" and _has_any(t, UNCERTAINTY_PATTERNS):
        return "offer_by_permission"

    # Default: do not mention tool
    return "no"
