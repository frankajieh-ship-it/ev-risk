"""
Classification engine for Reddit posts.

v2: Primary path uses Grok (temp=0.0) for chain-of-thought classification.
    Regex patterns remain as fallback when Grok is unavailable or errors.

Public API (unchanged from v1):
  detect_intent(text) -> Intent
  detect_user_state(text) -> UserState
  detect_phase(text) -> OwnershipPhase
  decide_tool_intro(text, user_state) -> ToolIntro
  classify_full(text, context) -> dict  [NEW — returns all fields in one LLM call]
"""
from __future__ import annotations

import json
import re
from typing import List, Optional

from models import Intent, UserState, OwnershipPhase, ToolIntro


# -------------------------
# Pattern constants (v1 regex fallbacks)
# -------------------------

UNCERTAINTY_PATTERNS = [
    r"\bnot sure\b", r"\bunsure\b", r"\bshould i\b", r"\bwould it work\b",
    r"\bworth it\b", r"\bthinking of\b", r"\bthinking about\b", r"\bconsidering\b",
    r"\bworry\b", r"\bworried\b", r"\banxious\b", r"\bhelp\b", r"\badvice\b",
    r"\bwhat do you think\b", r"\bam i\b", r"\bwill it\b", r"\bwill i\b",
]

ASKED_FOR_TOOL_PATTERNS = [
    r"\bchecklist\b", r"\btool\b", r"\broutine check\b", r"\bsanity[- ]?check\b",
    r"\blink\b", r"\bshare\b", r"\bcalculator\b",
]

COMPARISON_PATTERNS = [
    r"\bvs\b", r"\bversus\b", r"\bcompare\b", r"\bcomparison\b", r"\boption\b",
    r"\bwhich\b.*\bor\b", r"\bbetween\b", r"\bchoose\b", r"\bdecide\b",
]

NO_HOME_CHARGING_PATTERNS = [
    r"\bno home\b", r"\bapartment\b", r"\bflat\b", r"\bcondo\b", r"\brental\b",
    r"\bpublic charging\b", r"\bcan.?t charge at home\b", r"\bno garage\b",
    r"\bstreet parking\b",
]

SEASON_PATTERNS = [
    r"\bwinter\b", r"\bcold\b", r"\bfreezing\b", r"\bsnow\b", r"\bice\b",
    r"\b(-?\d+)\s?[cf]\b",
]

BATTERY_HEALTH_PATTERNS = [
    r"\bsoh\b", r"\bbattery health\b", r"\bdegradation\b", r"\bbattery life\b",
    r"\brange loss\b",
]

BRAND_WAR_PATTERNS = [
    r"\btesla fan\b", r"\btrash\b", r"\bsuperiority\b", r"\bfanboy\b",
    r"\bidiot\b", r"\bstupid\b", r"\bdumb\b", r"\bworse\b.*\bthan\b",
    r"\bbetter\b.*\bthan\b.*\balways\b",
]

# All valid friction tags (for LLM prompt)
ALL_FRICTION_TAGS = [
    "NO_HOME_CHARGING", "HOME_CHARGING_AVAILABLE", "PUBLIC_ANCHOR_PRESENT",
    "PREDICTABILITY_HIGH", "PREDICTABILITY_LOW", "SEASONAL_SENSITIVITY",
    "PLANNING_TOLERANCE_HIGH", "PLANNING_TOLERANCE_LOW", "ROUTINE_VARIABILITY_HIGH",
    "COMPARING_TWO_OPTIONS", "BATTERY_HEALTH_ANXIETY", "SOFTWARE_TOLERANCE_UNKNOWN",
    "BRAND_WAR_RISK",
]


def _has_any(text: str, patterns: List[str]) -> bool:
    t = text.lower()
    return any(re.search(p, t) for p in patterns)


# -------------------------
# Grok LLM classification (primary path)
# -------------------------

GROK_SYSTEM_PROMPT = """You are an EV ownership expert and community classifier for the OFFO Reddit Operator Tool.

OFFO runs offolab.com — a free EV friction analysis platform with three tools:
- /routine  → 7-question fit check (60s, anonymous). For: general EV uncertainty, no specific car yet.
- /receipt  → Paste any listing URL → instant friction receipt + VIN + dealer questions. For: user evaluating a specific car listing.
- /compare  → Side-by-side routine-fit comparison of two EVs. For: user choosing between two specific options.

Analyze the Reddit post and return a single JSON object with these exact keys:

{
  "is_offo_relevant": true or false,
  "confidence": integer 0-100 (how confident you are this is an EV fit/friction question OFFO can meaningfully help with),
  "main_intent": one of ["purchase_advice","ownership_support","charging_question","debate","news","comparison","listing_evaluation","other"],
  "user_state": one of ["uncertain","confident","frustrated","excited","skeptical","unknown"],
  "ownership_phase": one of ["buyer","0_3","4_12","12_plus","unknown"],
  "friction_tags": array of strings — use well-known tags where they fit, or invent concise UPPER_CASE tags for the actual concern (e.g. "MODEL_YEAR_DIFFERENCE", "SUNROOF_VALUE", "MILEAGE_CONCERN", "BUDGET_25K", "RECALL_RISK"),
  "key_concern": "one sentence summarizing the core question or worry the user actually has",
  "suggested_tool": one of ["routine","receipt","compare","none"],
  "tool_intro": one of ["no","offer_by_permission","asked_directly"],
  "reasoning": "one sentence explaining your classification"
}

is_offo_relevant / confidence rules:
- true / ≥70: post is directly about EV purchase decision, charging fit, used-EV risk, listing evaluation, or model comparison — OFFO can add real value
- true / 60-70: adjacent topic where OFFO might help (e.g. "should I consider an EV at all?")
- false / <60: pure spec debate, brand war, general car market news, ICE-only question, meme

main_intent definitions:
- "listing_evaluation": user is evaluating a specific car listing, VIN, price, mileage, dealer
- "comparison": user is comparing two or more specific EV options
- "purchase_advice": general pre-purchase uncertainty, no specific listing
- "charging_question": charging access, infrastructure, home vs public
- "ownership_support": existing owner seeking help with their car
- "debate": brand wars, EV vs ICE ideology, political
- "news": sharing articles or announcements
- "other": any EV topic not covered above

friction_tags: be specific and descriptive of the ACTUAL post content. Do NOT default to charging/routine tags for every post. Examples:
- Mach-E 2023 vs 2024/2025 → ["MODEL_YEAR_DIFFERENCE", "COMPARING_TWO_OPTIONS"]
- Used Tesla 120k miles for $10k → ["HIGH_MILEAGE", "BATTERY_HEALTH_ANXIETY", "PRICE_VALUE_QUESTION"]
- No home charger, considering EV → ["NO_HOME_CHARGING", "PREDICTABILITY_LOW"]
- Apartment, public charging only → ["NO_HOME_CHARGING", "PUBLIC_ANCHOR_PRESENT"]
- Budget constraint $25k → ["BUDGET_25K", "PRICE_VALUE_QUESTION"]

suggested_tool rules:
- "compare"  → intent is "comparison" OR user mentions two specific EVs side by side
- "receipt"  → intent is "listing_evaluation" OR user mentions a specific listing/VIN/price/dealer
- "routine"  → user is uncertain, no specific listing or comparison, general EV fit anxiety
- "none"     → debate, brand war, confident user, news, existing owner with a simple question

tool_intro rules:
- "asked_directly"     → user explicitly asks for a tool, link, checklist, or sanity-check
- "offer_by_permission"→ user_state is "uncertain" AND they express a genuine question
- "no"                 → all other cases

Think step by step, then output ONLY the JSON object."""


def classify_full(text: str, context: Optional[str] = None) -> Optional[dict]:
    """
    Run a single Grok call to classify intent, state, phase, friction, and tool_intro.

    Returns a dict with keys: intent, user_state, ownership_phase, friction_tags,
    tool_intro, reasoning. Returns None if Grok is unavailable or errors.
    """
    from ai_clients import call_grok

    full_text = text
    if context:
        full_text = f"{text}\n\nComment context:\n{context}"

    messages = [
        {"role": "system", "content": GROK_SYSTEM_PROMPT},
        {"role": "user", "content": full_text[:4000]},  # cap to avoid token overflow
    ]

    raw = call_grok(messages, temperature=0.0, max_tokens=400)
    if not raw:
        return None

    # Strip markdown code fences if Grok wraps in ```json ... ```
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None

    # Validate required keys and values
    valid_intents = {"purchase_advice","ownership_support","charging_question","debate","news","comparison","listing_evaluation","other","unknown"}
    valid_states = {"uncertain","confident","frustrated","excited","skeptical","unknown"}
    valid_phases = {"buyer","0_3","4_12","12_plus","unknown"}
    valid_tool_intros = {"no","offer_by_permission","asked_directly"}

    # Support both old key "intent" and new key "main_intent"
    intent_value = data.get("main_intent") or data.get("intent")
    if intent_value not in valid_intents:
        return None
    data["intent"] = intent_value  # normalize to "intent" for downstream consumers

    if data.get("user_state") not in valid_states:
        return None
    if data.get("ownership_phase") not in valid_phases:
        return None
    if data.get("tool_intro") not in valid_tool_intros:
        return None

    # Sanitize friction_tags — keep any UPPER_CASE tag; strip empty strings
    raw_tags = data.get("friction_tags") or []
    tags = [str(t).strip().upper().replace(" ", "_") for t in raw_tags if t and str(t).strip()]
    data["friction_tags"] = tags

    # Normalize confidence and relevance
    data["is_offo_relevant"] = bool(data.get("is_offo_relevant", True))
    data["confidence"] = max(0, min(100, int(data.get("confidence", 70))))
    data["key_concern"] = str(data.get("key_concern") or "")

    return data


# -------------------------
# v1 regex fallback functions (renamed with _ prefix)
# -------------------------

def _regex_detect_intent(text: str) -> Intent:
    t = text.lower()
    if _has_any(t, COMPARISON_PATTERNS):
        return "comparison"
    if _has_any(t, NO_HOME_CHARGING_PATTERNS) or "charge" in t or "charger" in t:
        return "charging_question"
    if _has_any(t, UNCERTAINTY_PATTERNS):
        if any(w in t for w in ["buy", "purchase", "get", "getting", "first ev", "new ev"]):
            return "purchase_advice"
    if any(w in t for w in ["news", "article", "reported", "announced", "release"]):
        return "news"
    if any(w in t for w in ["debate", "vs ice", "superiority", "better than"]):
        return "debate"
    if any(w in t for w in ["my ev", "my car", "i have", "i own", "i drive"]):
        return "ownership_support"
    return "unknown"


def _regex_detect_user_state(text: str) -> UserState:
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


def _regex_detect_phase(text: str) -> OwnershipPhase:
    t = text.lower()
    if any(w in t for w in [
        "first ev", "never had an ev", "thinking about getting", "buying an ev",
        "should i buy", "looking to buy", "considering", "before i buy"
    ]):
        return "buyer"
    if re.search(r"\b(1|2|3|one|two|three)\s*(week|weeks|month|months)\b", t):
        if any(w in t for w in ["just got", "recently", "new owner", "just bought"]):
            return "0_3"
    if re.search(r"\b(4|5|6|7|8|9|10|11|12|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(month|months)\b", t):
        return "4_12"
    if any(w in t for w in ["years", "year", "18 months", "2 years", "3 years", "long time"]):
        return "12_plus"
    if _has_any(t, UNCERTAINTY_PATTERNS) and any(w in t for w in ["buy", "get", "purchase"]):
        return "buyer"
    return "unknown"


def _regex_decide_tool_intro(text: str, user_state: UserState) -> ToolIntro:
    t = text.lower()
    if _has_any(t, ASKED_FOR_TOOL_PATTERNS):
        return "asked_directly"
    if user_state == "uncertain" and _has_any(t, UNCERTAINTY_PATTERNS):
        return "offer_by_permission"
    return "no"


# -------------------------
# Public API (try Grok, fall back to regex)
# -------------------------

def detect_intent(text: str) -> Intent:
    """Classify the primary intent of the post."""
    result = classify_full(text)
    if result and result.get("intent"):
        return result["intent"]
    return _regex_detect_intent(text)


def detect_user_state(text: str) -> UserState:
    """Detect the emotional state of the user."""
    result = classify_full(text)
    if result and result.get("user_state"):
        return result["user_state"]
    return _regex_detect_user_state(text)


def detect_phase(text: str) -> OwnershipPhase:
    """Detect ownership phase based on text cues."""
    result = classify_full(text)
    if result and result.get("ownership_phase"):
        return result["ownership_phase"]
    return _regex_detect_phase(text)


def decide_tool_intro(text: str, user_state: UserState) -> ToolIntro:
    """Determine whether to introduce the OFFO tool."""
    result = classify_full(text)
    if result and result.get("tool_intro"):
        return result["tool_intro"]
    return _regex_decide_tool_intro(text, user_state)
