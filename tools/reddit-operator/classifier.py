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

from models import Intent, UserState, OwnershipPhase, ToolIntro, DetectedVehicle


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
    # v2 additions
    "PRICE_UNCERTAINTY", "HIGH_MILEAGE_CONCERN", "WARRANTABLE_MILES",
    "SPECIFIC_LISTING_PRESENT", "VIN_MENTIONED", "TWO_LISTINGS_MENTIONED",
    "DEALER_REPUTATION_UNKNOWN", "PRIVATE_SELLER",
    "READY_TO_BUY", "EARLY_RESEARCH",
]

# VIN pattern (17-char alphanumeric, excluding I/O/Q)
VIN_PATTERN = re.compile(r'\b[A-HJ-NPR-Z0-9]{17}\b', re.IGNORECASE)

# Listing URL patterns
LISTING_URL_PATTERN = re.compile(
    r'(autotrader|carvana|cargurus|cars\.com|carmax|carfax|vroom|shift\.com|ebay.*motors|craigslist.*cars)',
    re.IGNORECASE,
)


def _has_any(text: str, patterns: List[str]) -> bool:
    t = text.lower()
    return any(re.search(p, t) for p in patterns)


# -------------------------
# Grok LLM classification (primary path)
# -------------------------

GROK_SYSTEM_PROMPT = """You are an EV ownership expert and community classifier for the OFFO Reddit Operator Tool v2.

OFFO runs offolab.com — a free EV friction analysis platform with these tools:
- /routine    → 7-question fit check (60s, anonymous). For: general EV uncertainty, no specific car yet.
- /receipt    → Paste any listing URL → instant friction receipt + VIN + dealer questions. For: specific listing evaluation or VIN analysis.
- /compare    → Side-by-side routine-fit comparison of two EVs. For: choosing between two specific options.
- /dealer-qa  → Generates personalized seller follow-up questions. For: pre-purchase question prep.
- /dealer     → Dealer workspace for uploading and matching listings with buyers.

Analyze the Reddit post and return a single JSON object with these exact keys:

{
  "is_offo_relevant": true or false,
  "confidence": integer 0-100 (how confident you are this is an EV fit/friction question OFFO can meaningfully help with),
  "main_intent": one of ["listing_rating","dealer_questions","pricing_deal","vin_analysis","compare_listings","dealer_upload","routine_fit","purchase_advice","ownership_support","charging_question","debate","news","other"],
  "secondary_intent": one of the same values or null (optional second intent, e.g. listing_rating + vin_analysis together),
  "detected_vehicle": {
    "year": integer or null,
    "make": string or null,
    "model": string or null,
    "trim": string or null,
    "price_mentioned": integer (USD) or null,
    "mileage_mentioned": integer (miles) or null
  },
  "user_state": one of ["uncertain","confident","frustrated","excited","skeptical","unknown"],
  "ownership_phase": one of ["buyer","0_3","4_12","12_plus","unknown"],
  "friction_tags": array of strings — use UPPER_CASE tags describing the actual concern,
  "key_concern": "one sentence summarizing the core question or worry the user actually has",
  "offer_by_permission": true if you should suggest the OFFO tool to this user, false otherwise,
  "suggested_tool": one of ["receipt","compare","routine","dealer_qa","dealer","none"],
  "tool_intro": one of ["no","offer_by_permission","asked_directly"],
  "needs_market_data": true or false (true when real-time local pricing would make the reply meaningfully more accurate),
  "market_focus": one of ["local_pricing","comps","depreciation","regional_demand",null],
  "reasoning": "one sentence explaining your classification"
}

is_offo_relevant / confidence rules:
- true / ≥70: post is directly about EV purchase decision, charging fit, used-EV risk, listing evaluation, VIN, model comparison, dealer interaction — OFFO can add real value
- true / 60-70: adjacent topic where OFFO might help (e.g. "should I consider an EV at all?")
- false / <60: pure spec debate, brand war, general car market news, ICE-only question, meme

main_intent definitions:
- "listing_rating": user has a specific listing link/details and wants an evaluation
- "dealer_questions": user wants to know what to ask the seller before buying
- "pricing_deal": "Is this a good deal?" price/value evaluation without a link
- "vin_analysis": VIN is mentioned, user wants decode + risk check
- "compare_listings": two specific EVs are mentioned side-by-side
- "dealer_upload": seller or dealer post, looking to reach buyers
- "routine_fit": charging fit / "does this EV work for my life?" — no specific listing
- "purchase_advice": general pre-purchase uncertainty, no specific listing
- "ownership_support": existing owner seeking help with their car
- "charging_question": charging access, infrastructure, home vs public only
- "debate": brand wars, EV vs ICE ideology, political
- "news": sharing articles or announcements
- "other": any EV topic not covered above

detected_vehicle: extract from the post text whatever is present. Set fields to null if not mentioned. For price, convert to integer USD (e.g. "$28k" → 28000).

friction_tags: be specific and descriptive. Use these standard tags where they fit, invent new UPPER_CASE tags for edge cases:
- Standard: NO_HOME_CHARGING, HOME_CHARGING_AVAILABLE, PUBLIC_ANCHOR_PRESENT, PREDICTABILITY_HIGH, PREDICTABILITY_LOW, SEASONAL_SENSITIVITY, PLANNING_TOLERANCE_HIGH, PLANNING_TOLERANCE_LOW, ROUTINE_VARIABILITY_HIGH, COMPARING_TWO_OPTIONS, BATTERY_HEALTH_ANXIETY, SOFTWARE_TOLERANCE_UNKNOWN, BRAND_WAR_RISK
- v2 additions: PRICE_UNCERTAINTY, HIGH_MILEAGE_CONCERN, WARRANTABLE_MILES, SPECIFIC_LISTING_PRESENT, VIN_MENTIONED, TWO_LISTINGS_MENTIONED, DEALER_REPUTATION_UNKNOWN, PRIVATE_SELLER, READY_TO_BUY, EARLY_RESEARCH

suggested_tool rules:
- "receipt"    → VIN mentioned, OR intent is listing_rating / vin_analysis / pricing_deal (specific car)
- "compare"    → intent is compare_listings OR two named EVs mentioned side by side
- "dealer_qa"  → intent is dealer_questions
- "dealer"     → intent is dealer_upload
- "routine"    → user is uncertain, no specific listing, general EV fit anxiety, routine_fit / purchase_advice / charging_question
- "none"       → debate, brand war, news, confident user, simple ownership question

tool_intro rules:
- "asked_directly"     → user explicitly asks for a tool, link, checklist, or sanity-check
- "offer_by_permission"→ user_state is "uncertain" AND they express a genuine question (offer_by_permission = true)
- "no"                 → all other cases

needs_market_data rules (real-time Auto.dev pricing data — call only when genuinely useful):
- true for: listing_rating (user has a specific price to compare), pricing_deal, compare_listings (side-by-side price context), dealer_upload (demand signal)
- false for: routine_fit, charging_question, ownership_support, debate, news, other

market_focus options:
- "local_pricing"    → listing_rating or pricing_deal — user wants to know if the price is fair vs local comps
- "comps"            → compare_listings — user wants side-by-side pricing context for two EVs
- "depreciation"     → user explicitly asks about long-term value / resale
- "regional_demand"  → dealer_upload — seller wants to know if demand is strong locally
- null               → all other intents

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

    raw = call_grok(messages, temperature=0.0, max_tokens=900)
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
    valid_intents = {
        "listing_rating", "dealer_questions", "pricing_deal", "vin_analysis",
        "compare_listings", "dealer_upload", "routine_fit", "purchase_advice",
        "ownership_support", "charging_question", "debate", "news", "other",
        # Legacy values from v1 (accepted for backward compat)
        "comparison", "listing_evaluation", "unknown",
    }
    valid_states = {"uncertain","confident","frustrated","excited","skeptical","unknown"}
    valid_phases = {"buyer","0_3","4_12","12_plus","unknown"}
    valid_tool_intros = {"no","offer_by_permission","asked_directly"}

    # Support both old key "intent" and new key "main_intent"
    intent_value = data.get("main_intent") or data.get("intent")
    # Map legacy intent values to v2
    _legacy_map = {
        "comparison": "compare_listings",
        "listing_evaluation": "listing_rating",
        "unknown": "other",
    }
    intent_value = _legacy_map.get(intent_value, intent_value)
    if intent_value not in valid_intents:
        return None
    data["intent"] = intent_value  # normalize to "intent" for downstream consumers

    if data.get("user_state") not in valid_states:
        data["user_state"] = "unknown"
    if data.get("ownership_phase") not in valid_phases:
        data["ownership_phase"] = "unknown"
    if data.get("tool_intro") not in valid_tool_intros:
        data["tool_intro"] = "no"

    # Sanitize friction_tags — keep any UPPER_CASE tag; strip empty strings
    raw_tags = data.get("friction_tags") or []
    tags = [str(t).strip().upper().replace(" ", "_") for t in raw_tags if t and str(t).strip()]
    data["friction_tags"] = tags

    # Normalize confidence and relevance
    data["is_offo_relevant"] = bool(data.get("is_offo_relevant", True))
    data["confidence"] = max(0, min(100, int(data.get("confidence", 70))))
    data["key_concern"] = str(data.get("key_concern") or "")

    # v2: secondary intent (optional)
    secondary = data.get("secondary_intent")
    if secondary:
        secondary = _legacy_map.get(secondary, secondary)
        data["secondary_intent"] = secondary if secondary in valid_intents else None
    else:
        data["secondary_intent"] = None

    # v2: detected_vehicle — normalize fields
    dv = data.get("detected_vehicle")
    if dv and isinstance(dv, dict):
        data["detected_vehicle"] = {
            "year": int(dv["year"]) if dv.get("year") else None,
            "make": str(dv["make"]).strip() if dv.get("make") else None,
            "model": str(dv["model"]).strip() if dv.get("model") else None,
            "trim": str(dv["trim"]).strip() if dv.get("trim") else None,
            "price_mentioned": int(dv["price_mentioned"]) if dv.get("price_mentioned") else None,
            "mileage_mentioned": int(dv["mileage_mentioned"]) if dv.get("mileage_mentioned") else None,
        }
    else:
        data["detected_vehicle"] = None

    # v2: suggested_tool
    valid_tools = {"receipt", "compare", "routine", "dealer_qa", "dealer", "none"}
    data["suggested_tool"] = data.get("suggested_tool") if data.get("suggested_tool") in valid_tools else "none"

    # v2: offer_by_permission
    data["offer_by_permission"] = bool(data.get("offer_by_permission", False))

    # v2: market data flags
    data["needs_market_data"] = bool(data.get("needs_market_data", False))
    valid_market_focus = {"local_pricing", "comps", "depreciation", "regional_demand"}
    mf = data.get("market_focus")
    data["market_focus"] = mf if mf in valid_market_focus else None

    return data


# -------------------------
# v1 regex fallback functions (renamed with _ prefix)
# -------------------------

def _regex_detect_intent(text: str) -> Intent:
    t = text.lower()
    # VIN pattern check → vin_analysis
    if VIN_PATTERN.search(text) or re.search(r'\bvin\b', t):
        return "vin_analysis"
    # Listing URL present → listing_rating
    if LISTING_URL_PATTERN.search(t):
        return "listing_rating"
    # Two listings → compare_listings
    if _has_any(t, COMPARISON_PATTERNS) and re.search(r'\b(model|tesla|nissan|chevy|bolt|leaf|ioniq|id\.\d|mach.?e|kia|rivian|gm|ford|hyundai)\b', t):
        return "compare_listings"
    # Dealer questions
    if re.search(r'\b(what (to|should i) ask|questions? (for|to ask|the dealer)|dealer questions?)\b', t):
        return "dealer_questions"
    # Seller/dealer post → dealer_upload
    if re.search(r'\b(selling my|i.?m selling|for sale|listed it|put it up)\b', t) and re.search(r'\bev\b|\belectric\b', t):
        return "dealer_upload"
    # Pricing deal
    if re.search(r'\b(good deal|fair price|too (much|expensive)|worth (it|\$)|is \$\d|at \$\d|asking \$)\b', t):
        return "pricing_deal"
    # Routine fit / charging fit
    if _has_any(t, NO_HOME_CHARGING_PATTERNS) or re.search(r'\b(fit|work for|work with|suit|my lifestyle|my routine)\b', t):
        return "routine_fit"
    if "charge" in t or "charger" in t:
        return "charging_question"
    if _has_any(t, COMPARISON_PATTERNS):
        return "compare_listings"
    if _has_any(t, UNCERTAINTY_PATTERNS):
        if any(w in t for w in ["buy", "purchase", "get", "getting", "first ev", "new ev"]):
            return "purchase_advice"
    if any(w in t for w in ["news", "article", "reported", "announced", "release"]):
        return "news"
    if any(w in t for w in ["debate", "vs ice", "superiority", "better than"]):
        return "debate"
    if any(w in t for w in ["my ev", "my car", "i have", "i own", "i drive"]):
        return "ownership_support"
    return "other"


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
