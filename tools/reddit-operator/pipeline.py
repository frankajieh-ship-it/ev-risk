"""
Multi-AI pipeline orchestrator for OFFO Reddit Operator Tool v2.

Pipeline (operator mode) — Generic EV Assistant:

  Stage 1: Grok (temp=0.0)
    → Classification + OFFO relevance gate
    → Returns: intent, friction_tags, user_state, is_offo_relevant, confidence (0-100),
               needs_market_data, market_focus, detected_vehicle
    → If confidence < 60 or not relevant: short-circuit → neutral reply, no tool mention

  Stage 2: Gemini 1.5 Pro (temp=0.7)
    → Empathetic structure: validate + hidden_tradeoff + reframe + reflective_question
    → Warm, human, analytical. Max 600 chars. Personal and non-salesy.
    → Fallback: TONE_TEMPLATES

  Stage 3: GPT-4o (temp=0.3)
    → Full reply polish: takes Stage 2 draft + adds precise EV technical knowledge
    → Intent-aware: listing/VIN/compare → LISTING_FOCUSED_SYSTEM_PROMPT
    → Battery, range, charging, used-EV risks, deal evaluation accuracy
    → Max 900 chars total. Returns final draft_reply_short + draft_reply_long.

  Stage 3.5: Market Analytics (conditional — only when needs_market_data = true)
    → Auto.dev Listings API: local comps, avg price, price percentile
    → 24h Supabase cache per VIN/YMM to avoid redundant API calls
    → Falls back gracefully if Auto.dev key missing or API errors

  Stage 4: Grok (temp=0.3)
    → Final tone check: sounds like helpful experienced EV owner
    → If market data present: instructs Grok to weave in comps/percentile naturally
    → Calm, analytical, never evangelical. Adjust tone only if needed.

Receipt mode:
  → Single GPT-4o structured call for RedditDraft JSON output
"""
from __future__ import annotations

import json
import re
import time
import uuid
from typing import List, Optional

from models import (
    AssistRequest, AssistResponse, ReplyPlan,
    Intent, UserState, OwnershipPhase, ToolIntro,
    RedditDraftOutput, RedditDraftStyle,
)
from classifier import classify_full, _regex_detect_intent, _regex_detect_user_state, _regex_detect_phase, _regex_decide_tool_intro
from friction_tagger import tag_frictions, get_primary_friction
from reply_generator import TONE_TEMPLATES, HIDDEN_TRADEOFF_TEMPLATES, build_reply_plan, build_drafts, get_tool_blurb
from evroutine_logic import decide_tool_invite, detect_tech_support, get_tool_blurb as get_tool_blurb_for
from ai_clients import call_grok, call_gpt4o
from db import get_few_shot_examples
from services.market_analytics import get_market_analytics, format_market_context


# -------------------------
# Stage 1: Grok Classification + Relevance Gate
# -------------------------

def _stage1_classify(combined: str) -> dict:
    """
    Stage 1: Grok (temp=0.0) — full classification with OFFO relevance gate.
    Falls back to regex classifier on failure.
    """
    result = classify_full(combined)
    if result:
        return result

    # Regex fallback — mark as relevant by default
    intent = _regex_detect_intent(combined)
    user_state = _regex_detect_user_state(combined)
    phase = _regex_detect_phase(combined)
    tags = tag_frictions(combined)
    tool_intro = _regex_decide_tool_intro(combined, user_state)

    return {
        "intent": intent,
        "user_state": user_state,
        "ownership_phase": phase,
        "friction_tags": tags,
        "tool_intro": tool_intro,
        "is_offo_relevant": True,
        "confidence": 70,
        "reasoning": "regex fallback",
    }


# -------------------------
# Stage 2: Gemini — Empathetic Structure
# -------------------------

GEMINI_EMPATHY_SYSTEM = """You are writing a Reddit reply for the OFFO EV community assistant.
OFFO helps people understand real-world EV friction — charging predictability, routine fit,
used-EV risks, deal evaluation. Not range anxiety or brand wars.

Voice: calm, warm, analytical, non-salesy. Like a knowledgeable friend who owns an EV.

Your task: given the post and its key_concern, write a structured draft with EXACTLY these 4 elements — tailored to the ACTUAL question, not generic charging/routine templates:
1. validate_line   — 1-2 sentences acknowledging the SPECIFIC concern warmly (reference the actual car model, price, mileage, scenario if present)
2. hidden_tradeoff — the non-obvious thing they are really trading off — specific to THIS post (1 sentence)
3. reframe_line    — gently shift perspective in a way relevant to THIS post (1 sentence)
4. question        — 1 reflective question that helps them think about their specific situation

Rules:
- Address what they ACTUALLY asked. If it is about model-year differences, address that. If it is about mileage at a specific price, address that. Do NOT default to "charging predictability" or "routine anchor" unless the post is actually about charging.
- "That makes sense" / "Totally fair" — not "I understand your concern"
- No verdict language (buy, skip, avoid, good deal)
- No OFFO/tool URLs in these lines (handled separately)
- Total combined length max 600 chars
- Return ONLY JSON: {"validate_line":"...","hidden_tradeoff":"...","reframe_line":"...","question":"..."}"""


def _build_few_shot_block(examples: list[dict]) -> str:
    """Format few-shot examples into a compact prompt block."""
    if not examples:
        return ""
    lines = ["\nHere are real Reddit replies that resonated with EV communities — use them as a style reference (do NOT copy, just match the natural voice):"]
    for i, ex in enumerate(examples, 1):
        title = ex.get("post_title", "")
        reply = ex.get("successful_reply", "")
        if title and reply and not reply.startswith("[reply for:"):
            lines.append(f"Example {i} (post: \"{title[:80]}\"): {reply[:300]}")
    return "\n".join(lines) if len(lines) > 1 else ""


def _stage2_gemini_empathy(
    intent: str,
    user_state: str,
    friction_tags: List[str],
    tone: str,
    post_text: str,
    key_concern: str = "",
) -> dict:
    """
    Stage 2: Gemini 1.5 Pro (temp=0.7) — empathetic structure.
    Falls back to TONE_TEMPLATES + HIDDEN_TRADEOFF_TEMPLATES on failure.
    """
    tpl = TONE_TEMPLATES.get(tone, TONE_TEMPLATES["standard"])
    primary = get_primary_friction(friction_tags)

    # Fetch few-shot examples from Supabase
    examples = get_few_shot_examples(intent, limit=3)
    few_shot_block = _build_few_shot_block(examples)

    user_msg = f"""Post text (first 800 chars): {post_text[:800]}

Key concern (what the user is REALLY asking): {key_concern or 'not specified'}

Classification:
- Intent: {intent}
- User state: {user_state}
- Friction tags: {', '.join(friction_tags) or 'none'}
- Tone target: {tone}
{few_shot_block}

Now write the 4-part empathy draft for THIS specific post."""

    raw = call_grok(GEMINI_EMPATHY_SYSTEM, user_msg, temperature=0.7, max_tokens=400)

    if raw:
        raw = raw.strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
        try:
            data = json.loads(raw)
            if data.get("validate_line") and data.get("question"):
                return data
        except json.JSONDecodeError:
            pass

    # Template fallback
    validate = tpl.get("validate_default", "That makes sense.")
    if "NO_HOME_CHARGING" in friction_tags:
        validate = tpl.get("validate_no_home", validate)
    elif "SEASONAL_SENSITIVITY" in friction_tags:
        validate = tpl.get("validate_seasonal", validate)
    elif "BATTERY_HEALTH_ANXIETY" in friction_tags:
        validate = tpl.get("validate_battery", validate)
    elif intent in ("comparison", "listing_evaluation") or "COMPARING_TWO_OPTIONS" in friction_tags:
        validate = tpl.get("validate_comparison", validate)

    hidden = tpl.get("hidden_default", HIDDEN_TRADEOFF_TEMPLATES.get(primary or "default", HIDDEN_TRADEOFF_TEMPLATES["default"]))
    if "SEASONAL_SENSITIVITY" in friction_tags:
        hidden = tpl.get("hidden_seasonal", hidden)
    elif "BATTERY_HEALTH_ANXIETY" in friction_tags:
        hidden = tpl.get("hidden_battery", hidden)

    reframe = tpl.get("reframe_default", "This is mostly about how often you have to think about charging.")
    if "HOME_CHARGING_AVAILABLE" in friction_tags:
        reframe = tpl.get("reframe_home", reframe)

    question = tpl.get("question_default", "In a normal week, where would charging actually happen?")
    if "NO_HOME_CHARGING" in friction_tags:
        question = tpl.get("question_no_home", question)
    elif intent == "comparison" or "COMPARING_TWO_OPTIONS" in friction_tags:
        question = tpl.get("question_comparison", question)

    return {
        "validate_line": validate,
        "hidden_tradeoff": hidden,
        "reframe_line": reframe,
        "question": question,
    }


# -------------------------
# Stage 3: GPT-4o — Technical Polish + Full Reply
# -------------------------

GPT4O_POLISH_SYSTEM = """You are the technical editor for an OFFO EV community Reddit reply.
OFFO helps people understand real-world EV friction at offolab.com.

Tools available (mention ONLY if tool_invite_permitted = true AND it directly solves the key_concern):
- offolab.com/routine  → 7-question fit check, 60 seconds, free, anonymous
- offolab.com/receipt  → paste any listing URL → friction receipt + VIN + dealer questions
- offolab.com/compare  → side-by-side routine-fit comparison of two EVs

Your task: take the empathy draft and produce the final reply that DIRECTLY addresses the key_concern.
1. Add precise, specific EV technical knowledge relevant to THIS post (model-year differences, actual battery chemistry, charging curve reality, specific recall data, used-EV mileage benchmarks, real price-value signals for the mentioned car/price)
2. Fix any factual gaps or vague claims — be specific about the actual car/situation mentioned
3. Do NOT default to generic charging/routine framing if the post is about something else (model year, mileage, price, sunroof, etc.)
4. Ensure reply sounds like an experienced EV owner — helpful, calm, never evangelical
5. If tool_invite_permitted = true: end with a soft, single-sentence tool mention using the correct URL
6. If tool_invite_permitted = false: end with only the reflective question, no tool mention

Output JSON:
{
  "draft_reply_short": "...",  // ≤900 chars, 1-2 flowing paragraphs
  "draft_reply_long": "...",   // ≤2500 chars, same content with more technical detail
  "facts_added": ["..."]       // brief list of any specific technical facts you added
}"""

LISTING_FOCUSED_SYSTEM_PROMPT = """You are the technical editor for an OFFO EV community Reddit reply, specializing in listing evaluation, VIN analysis, pricing, and dealer interactions.
OFFO helps people understand real-world EV friction at offolab.com.

The user is asking about a SPECIFIC vehicle listing, VIN, price, or dealer situation.
Tools (mention ONLY if tool_invite_permitted = true):
- offolab.com/receipt  → paste listing URL → VIN check + friction receipt + dealer questions
- offolab.com/compare  → if two listings mentioned, compare side-by-side

Your task: take the empathy draft and produce the final reply for THIS specific listing concern.
1. Address the detected vehicle details (year/make/model/price/mileage) explicitly in your reply
2. Add specific used-EV risk knowledge: battery degradation benchmarks for this model, common recalls, typical mileage thresholds, CPO vs private sale considerations
3. Mention specific price-value signals: is this price above/below market for this year/mileage? (use your training knowledge)
4. For VIN questions: explain what CARFAX/AutoCheck would surface and what the OFFO receipt adds (auction history, lemon title, odometer flags)
5. For dealer questions: frame what the user should specifically ask given this vehicle
6. Sound like a knowledgeable friend who has researched this exact car — specific, calm, not salesy
7. If tool_invite_permitted = true: end with the correct tool invite text

Output JSON:
{
  "draft_reply_short": "...",  // ≤900 chars, 1-2 flowing paragraphs
  "draft_reply_long": "...",   // ≤2500 chars, same content with more technical detail
  "facts_added": ["..."]       // list of specific price/risk facts you added
}"""

DEALER_SYSTEM_PROMPT = """You are the technical editor for an OFFO EV community Reddit reply, responding to a seller or dealer post.
OFFO helps people understand real-world EV friction at offolab.com.

The post is from someone SELLING an EV, not buying.
Tools (mention ONLY if tool_invite_permitted = true):
- offolab.com/workspace → dealer workspace to upload listing and get matched with serious buyers

Your task: write a helpful reply that:
1. Acknowledges their listing with specifics (year/make/model/price/mileage) if present
2. Offers useful seller-side perspective: typical buyer concerns for this model, what documentation to have ready, how to stand out vs dealer listings
3. Keeps tone neutral and helpful — this is a seller community post, not a buyer negotiation
4. If tool_invite_permitted = true: mention OFFO workspace for dealer listings
5. Do NOT challenge the price or suggest the car is overpriced

Output JSON:
{
  "draft_reply_short": "...",  // ≤900 chars
  "draft_reply_long": "...",   // ≤2500 chars
  "facts_added": ["..."]
}"""


def _stage3_gpt4o_polish(
    empathy_draft: dict,
    intent: str,
    friction_tags: List[str],
    tool_invite_permitted: bool,
    tool_invite_text: str,
    post_text: str,
    key_concern: str = "",
    few_shot_examples: Optional[List[dict]] = None,
    detected_vehicle: Optional[dict] = None,
) -> dict:
    """
    Stage 3: GPT-4o (temp=0.3) — technical accuracy + full reply assembly.
    Intent-aware: listing/VIN/compare posts use LISTING_FOCUSED_SYSTEM_PROMPT,
    dealer posts use DEALER_SYSTEM_PROMPT, all others use GPT4O_POLISH_SYSTEM.
    Falls back to string concat on failure.
    """
    # Select system prompt based on intent
    if intent in ("listing_rating", "vin_analysis", "dealer_questions", "compare_listings", "pricing_deal"):
        system_prompt = LISTING_FOCUSED_SYSTEM_PROMPT
    elif intent == "dealer_upload":
        system_prompt = DEALER_SYSTEM_PROMPT
    else:
        system_prompt = GPT4O_POLISH_SYSTEM

    few_shot_block = _build_few_shot_block(few_shot_examples or [])

    # Build vehicle context block if available
    vehicle_block = ""
    if detected_vehicle:
        parts = []
        if detected_vehicle.get("year"):
            parts.append(f"Year: {detected_vehicle['year']}")
        if detected_vehicle.get("make"):
            parts.append(f"Make: {detected_vehicle['make']}")
        if detected_vehicle.get("model"):
            parts.append(f"Model: {detected_vehicle['model']}")
        if detected_vehicle.get("trim"):
            parts.append(f"Trim: {detected_vehicle['trim']}")
        if detected_vehicle.get("price_mentioned"):
            parts.append(f"Price: ${detected_vehicle['price_mentioned']:,}")
        if detected_vehicle.get("mileage_mentioned"):
            parts.append(f"Mileage: {detected_vehicle['mileage_mentioned']:,} miles")
        if parts:
            vehicle_block = "\nDetected vehicle: " + " | ".join(parts)

    user_msg = f"""Post context (first 600 chars): {post_text[:600]}

Key concern (what the user is REALLY asking): {key_concern or 'not specified'}{vehicle_block}

Empathy draft:
validate_line: {empathy_draft.get('validate_line', '')}
hidden_tradeoff: {empathy_draft.get('hidden_tradeoff', '')}
reframe_line: {empathy_draft.get('reframe_line', '')}
question: {empathy_draft.get('question', '')}

Intent: {intent}
Friction tags: {', '.join(friction_tags) or 'none'}
tool_invite_permitted: {tool_invite_permitted}
tool_invite_text (use verbatim if permitted): {tool_invite_text if tool_invite_permitted else 'N/A'}
{few_shot_block}"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_msg},
    ]

    raw = call_gpt4o(messages, temperature=0.3, max_tokens=1600, response_format={"type": "json_object"})

    if raw:
        try:
            data = json.loads(raw.strip())
            if data.get("draft_reply_short") and data.get("draft_reply_long"):
                return data
        except json.JSONDecodeError:
            pass

    # String concat fallback
    v = empathy_draft.get("validate_line", "")
    h = empathy_draft.get("hidden_tradeoff", "")
    r = empathy_draft.get("reframe_line", "")
    q = empathy_draft.get("question", "")
    tool = f" {tool_invite_text}" if tool_invite_permitted and tool_invite_text else ""

    short = f"{v} {h} {r} {q}{tool}".strip()
    if len(short) > 900:
        short = short[:899].rstrip() + "…"

    long_ = "\n\n".join(filter(None, [v, h, r, q, tool_invite_text if tool_invite_permitted else ""]))
    if len(long_) > 2500:
        long_ = long_[:2497] + "..."

    return {"draft_reply_short": short, "draft_reply_long": long_, "facts_added": []}


# -------------------------
# Stage 3.5: Market Analytics (conditional)
# -------------------------

def _stage35_market_analytics(
    needs_market_data: bool,
    detected_vehicle: Optional[dict],
    listing_price: Optional[int],
    zip_code: Optional[str] = None,
) -> Optional[dict]:
    """
    Stage 3.5: Fetch local market comps from Auto.dev (only when needed).

    Skips entirely if:
    - needs_market_data is False
    - detected_vehicle is None (no make/model to search)
    - AUTO_DEV_API_KEY is not set

    Returns market analytics dict or None.
    """
    if not needs_market_data or not detected_vehicle:
        return None

    return get_market_analytics(
        vin=None,                              # VIN not stored on detected_vehicle; use YMM
        zip_code=zip_code,
        listing_price=listing_price,
        make=detected_vehicle.get("make"),
        model=detected_vehicle.get("model"),
        year=detected_vehicle.get("year"),
    )


# -------------------------
# Stage 4: Grok — Final Tone Check
# -------------------------

GROK_TONE_CHECK_SYSTEM = """You are the final tone editor for an OFFO EV community Reddit reply.
Check that the reply sounds like a helpful, experienced EV owner — calm, analytical, never evangelical.

Rules:
- If tone is already good: return it unchanged
- Remove any salesy language, hype, or unsolicited enthusiasm
- Remove any brand disparagement
- Remove double tool mentions (keep only the last one if duplicated)
- Ensure the reply ends naturally — not abruptly
- Short version max 900 chars, long version max 2500 chars
- Return ONLY JSON: {"draft_reply_short": "...", "draft_reply_long": "..."}"""

GROK_TONE_CHECK_WITH_MARKET_SYSTEM = """You are the final tone editor for an OFFO EV community Reddit reply.
You have access to real-time local market pricing data. Your job is to:
1. Check that the reply sounds like a helpful, experienced EV owner — calm, analytical, never evangelical
2. Naturally weave in the market context where it adds value (1 sentence, specific numbers)
   - Example: "Locally, similar 2023 Mach-Es are averaging $26.8k — this one at $25k is in the 18th percentile."
   - Example: "For context, 14 local comps put the market range at $22k–$29k, with this listing near the low end."
3. Only mention price numbers if they are accurate and add value — don't force it
4. Do NOT add market context if it's already in the reply

Rules:
- Remove salesy language, hype, brand disparagement
- Remove double tool mentions
- Short version max 900 chars, long version max 2500 chars
- Return ONLY JSON: {"draft_reply_short": "...", "draft_reply_long": "..."}"""


def _stage4_grok_tone_check(
    draft_short: str,
    draft_long: str,
    market_context: str = "",
) -> dict:
    """
    Stage 4: Grok (temp=0.3) — final tone check + optional market context injection.
    Returns input unchanged if Grok fails.
    """
    if market_context:
        system = GROK_TONE_CHECK_WITH_MARKET_SYSTEM
        user_msg = f"""Market context (verified real-time data): {market_context}

draft_reply_short: {draft_short}

draft_reply_long: {draft_long}"""
    else:
        system = GROK_TONE_CHECK_SYSTEM
        user_msg = f"""draft_reply_short: {draft_short}

draft_reply_long: {draft_long}"""

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_msg},
    ]

    raw = call_grok(messages, temperature=0.3, max_tokens=800)

    if raw:
        raw = raw.strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
        try:
            data = json.loads(raw)
            if data.get("draft_reply_short") and data.get("draft_reply_long"):
                return data
        except json.JSONDecodeError:
            pass

    return {"draft_reply_short": draft_short, "draft_reply_long": draft_long}


# -------------------------
# Not-a-good-fit short-circuit
# -------------------------

NOT_FIT_SYSTEM = """You are an EV community assistant. This post is NOT a good fit for detailed EV friction analysis.
Write a short, helpful, neutral reply (max 200 chars). Be honest that you may not have the best data for this.
Examples:
- Pure spec debate: "This one's more of a spec showdown — happy to share general thoughts but I don't have strong data on the exact model-year difference here."
- Brand war: "I'll sit this one out — seems more like a preference debate than a practical question I can add much to."
- General news: "Interesting news — not something I can add much technical context to beyond what's already out there."
Return ONLY the plain reply text, no JSON."""


def _not_a_fit_reply(intent: str, post_text: str) -> str:
    """Generate a short neutral reply for irrelevant/low-confidence posts."""
    user_msg = f"Intent: {intent}\nPost (first 400 chars): {post_text[:400]}"
    messages = [
        {"role": "system", "content": NOT_FIT_SYSTEM},
        {"role": "user", "content": user_msg},
    ]
    raw = call_grok(messages, temperature=0.3, max_tokens=120)
    if raw and raw.strip():
        return raw.strip()

    # Hard fallback
    fallbacks = {
        "debate": "This feels more like a preference debate — happy to weigh in on the practical side if there's a specific question.",
        "news": "Interesting development — not much I can add technically here beyond what's been shared.",
        "default": "Not sure this is the best place for me to add value, but happy to help if there's a specific practical question.",
    }
    return fallbacks.get(intent, fallbacks["default"])


# -------------------------
# Main operator pipeline
# -------------------------

def run_operator_pipeline(req: AssistRequest) -> AssistResponse:
    """
    Run the full 4-stage generic EV assistant pipeline.
    Short-circuits with a neutral reply if post is not OFFO-relevant.
    """
    start_ms = int(time.time() * 1000)
    stages_used: List[str] = []
    debug: dict = {}

    combined = "\n".join(filter(None, [
        req.post_title or "",
        req.post_body or "",
        "\n".join(req.top_comment_context or []),
    ])).strip()

    # ── Stage 1: Classification + relevance gate ──────────────────────────
    t0 = int(time.time() * 1000)
    cls = _stage1_classify(combined)
    debug["grok_classify_ms"] = int(time.time() * 1000) - t0
    stages_used.append("grok_classify" if cls.get("reasoning") != "regex fallback" else "regex_classify")

    intent: str       = cls.get("intent", "other")
    secondary_intent: Optional[str] = cls.get("secondary_intent")
    detected_vehicle: Optional[dict] = cls.get("detected_vehicle")
    suggested_tool: Optional[str] = cls.get("suggested_tool")
    needs_market_data: bool = cls.get("needs_market_data", False)
    market_focus: Optional[str] = cls.get("market_focus")
    user_state: str   = cls.get("user_state", "unknown")
    phase: str        = cls.get("ownership_phase", "unknown")
    friction_tags: List[str] = cls.get("friction_tags") or tag_frictions(combined)
    tool_intro: str   = cls.get("tool_intro", "no")
    is_relevant: bool = cls.get("is_offo_relevant", True)
    confidence: int   = int(cls.get("confidence", 70))
    key_concern: str  = cls.get("key_concern", "")

    debug["is_offo_relevant"] = is_relevant
    debug["confidence"] = confidence
    debug["key_concern"] = key_concern
    debug["needs_market_data"] = needs_market_data
    if detected_vehicle:
        debug["detected_vehicle"] = detected_vehicle
    if secondary_intent:
        debug["secondary_intent"] = secondary_intent

    # ── Relevance gate: short-circuit if not a good fit ───────────────────
    if not is_relevant or confidence < 60:
        stages_used.append("not_a_fit_reply")
        neutral = _not_a_fit_reply(intent, combined)
        latency_ms = int(time.time() * 1000) - start_ms

        return AssistResponse(
            mode="operator",
            session_id=str(uuid.uuid4()),
            pipeline_stages_used=stages_used,
            is_offo_relevant=False,
            confidence_score=confidence,
            intent=intent,
            secondary_intent=secondary_intent,
            detected_vehicle=detected_vehicle,
            suggested_tool=None,
            user_state=user_state,
            ownership_phase=phase,
            friction_tags=friction_tags,
            draft_reply_short=neutral,
            draft_reply_long=neutral,
            safety_flags=["Not OFFO-relevant — no tool mention, short neutral reply only."],
            evroutine_invite=__import__("models").EVRoutineInviteDecision(should_invite=False),
            latency_ms=latency_ms,
            debug=debug,
        )

    # ── Stage 2: Gemini empathy structure ─────────────────────────────────
    t0 = int(time.time() * 1000)
    # Fetch few-shot examples once (shared by Stage 2 and Stage 3)
    few_shot_examples = get_few_shot_examples(intent, limit=3)
    empathy = _stage2_gemini_empathy(intent, user_state, friction_tags, req.tone, combined, key_concern=key_concern)
    debug["gemini_empathy_ms"] = int(time.time() * 1000) - t0
    stages_used.append("gemini_empathy")

    # ── Tool invite decision (before Stage 3 so GPT-4o can embed it) ──────
    tool_invite = decide_tool_invite(friction_tags, user_state, intent, combined, detected_vehicle)
    tool_invite_permitted = (
        tool_intro in ("offer_by_permission", "asked_directly")
        and tool_invite.should_invite
        and confidence >= 70
    )
    tool_invite_text = tool_invite.invite_text or ""

    # ── Stage 3: GPT-4o technical polish + full reply ─────────────────────
    t0 = int(time.time() * 1000)
    polished = _stage3_gpt4o_polish(
        empathy, intent, friction_tags,
        tool_invite_permitted, tool_invite_text, combined,
        key_concern=key_concern,
        few_shot_examples=few_shot_examples,
        detected_vehicle=detected_vehicle,
    )
    debug["gpt4o_polish_ms"] = int(time.time() * 1000) - t0
    stages_used.append("gpt4o_polish")

    # ── Stage 3.5: Market Analytics (conditional) ────────────────────────
    market_data: Optional[dict] = None
    market_context: str = ""
    if needs_market_data:
        t0 = int(time.time() * 1000)
        listing_price = detected_vehicle.get("price_mentioned") if detected_vehicle else None
        market_data = _stage35_market_analytics(
            needs_market_data, detected_vehicle, listing_price
        )
        market_context = format_market_context(market_data, intent) if market_data else ""
        debug["market_analytics_ms"] = int(time.time() * 1000) - t0
        debug["market_data_found"] = market_data is not None
        if market_data:
            stages_used.append("market_analytics")

    # ── Stage 4: Grok tone check + optional market injection ─────────────
    t0 = int(time.time() * 1000)
    final = _stage4_grok_tone_check(
        polished["draft_reply_short"],
        polished["draft_reply_long"],
        market_context=market_context,
    )
    debug["grok_tone_ms"] = int(time.time() * 1000) - t0
    stages_used.append("grok_tone_check")

    if polished.get("facts_added"):
        debug["facts_added"] = polished["facts_added"]

    # ── Safety flags ──────────────────────────────────────────────────────
    safety: List[str] = []
    if "BRAND_WAR_RISK" in friction_tags:
        safety.append("Brand-war risk — keep neutral, avoid dunking.")
    if intent == "debate":
        safety.append("Debate context — focus on education, not winning.")
    if user_state == "frustrated":
        safety.append("User frustrated — lead with validation.")

    # ── ReplyPlan (for Streamlit display) ────────────────────────────────
    reply_plan = ReplyPlan(
        validate_line=empathy.get("validate_line", ""),
        hidden_tradeoff_line=empathy.get("hidden_tradeoff", ""),
        reframe_line=empathy.get("reframe_line", ""),
        reflective_question=empathy.get("question", ""),
        tool_intro=tool_intro,
    )

    tech_flag = detect_tech_support(combined)
    latency_ms = int(time.time() * 1000) - start_ms

    return AssistResponse(
        mode="operator",
        session_id=str(uuid.uuid4()),
        pipeline_stages_used=stages_used,
        is_offo_relevant=True,
        confidence_score=confidence,
        intent=intent,
        secondary_intent=secondary_intent,
        detected_vehicle=detected_vehicle,
        suggested_tool=suggested_tool or (tool_invite.tool if tool_invite_permitted else None),
        market_data=market_data,
        user_state=user_state,
        ownership_phase=phase,
        friction_tags=friction_tags,
        draft_reply_short=final["draft_reply_short"],
        draft_reply_long=final["draft_reply_long"],
        reply_plan=reply_plan,
        tool_blurb=get_tool_blurb_for(tool_invite.tool or "routine") if tool_invite_permitted else None,
        evroutine_invite=tool_invite,
        tech_support_flag=tech_flag if tech_flag.is_support_question else None,
        safety_flags=safety,
        latency_ms=latency_ms,
        debug=debug,
    )


# -------------------------
# Receipt mode pipeline (unchanged)
# -------------------------

REDDIT_DRAFT_SYSTEM_PROMPT = """You write Reddit posts for used-car buyers.
Given a receipt analysis, produce a reddit_draft JSON.

RULES:
- body_*: first-person buyer voice ("I plan to...", "I wasn't able to confirm..."). Never imperative.
- title: starts with year/make/model and price. 10-200 chars.
- body_facts: 1-5 items, 5-200 chars each. Concrete, specific, numbers where possible.
- body_uncertainty: 0-3 items, 5-200 chars each. Only genuine unknowns.
- body_next_steps: 0-3 items, 5-200 chars each.
- questions: EXACTLY 1 item. 10-200 chars. Must target the single biggest risk.
- Only 1 question mark total across ALL fields.
- No verdict language (good deal, bad deal, buy it, skip it, hard pass, avoid).
- No URLs. No smart quotes. No markdown * or _. Use "or" not "/".
- style.format: always "short_paragraph". style.max_questions: always 1.

Return ONLY a JSON object with key "reddit_draft" containing the fields:
title, body_facts, body_uncertainty, body_next_steps, questions, style."""


def _build_receipt_user_prompt(req: AssistRequest) -> str:
    lines = ["Generate a reddit_draft for this listing:\n"]
    if req.vehicle_label:
        lines.append(f"Vehicle: {req.vehicle_label}")
    if req.price_str:
        lines.append(f"Price: {req.price_str}")
    if req.verdict:
        lines.append(f"Verdict: {req.verdict}")
    if req.verdict_reason:
        lines.append(f"Verdict reason: {req.verdict_reason}")
    if req.risk_flags:
        lines.append("Risk flags:\n" + "\n".join(f"- {f}" for f in req.risk_flags))
    if req.must_answer_questions:
        lines.append("Must-ask questions:\n" + "\n".join(f"- {q}" for q in req.must_answer_questions))
    return "\n".join(lines)


def _parse_reddit_draft(raw: Optional[str]) -> Optional[RedditDraftOutput]:
    if not raw:
        return None
    try:
        data = json.loads(raw.strip())
    except json.JSONDecodeError:
        return None
    draft = data.get("reddit_draft") or data
    if not draft:
        return None
    try:
        return RedditDraftOutput(
            title=str(draft.get("title", ""))[:200],
            body_facts=list(draft.get("body_facts", []))[:5],
            body_uncertainty=list(draft.get("body_uncertainty", []))[:3],
            body_next_steps=list(draft.get("body_next_steps", []))[:3],
            questions=list(draft.get("questions", []))[:1],
            style=RedditDraftStyle(
                format=draft.get("style", {}).get("format", "short_paragraph"),
                max_questions=1,
            ),
        )
    except Exception:
        return None


def run_receipt_pipeline(req: AssistRequest) -> AssistResponse:
    start_ms = int(time.time() * 1000)
    stages_used: List[str] = []
    debug: dict = {}

    user_prompt = _build_receipt_user_prompt(req)
    t0 = int(time.time() * 1000)
    messages = [
        {"role": "system", "content": REDDIT_DRAFT_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    raw = call_gpt4o(messages, temperature=0.3, max_tokens=600, response_format={"type": "json_object"})
    debug["gpt4o_receipt_ms"] = int(time.time() * 1000) - t0
    stages_used.append("gpt4o_receipt")

    reddit_draft = _parse_reddit_draft(raw)

    combined_text = " ".join([
        req.vehicle_label or "",
        req.verdict_reason or "",
        " ".join(req.risk_flags or []),
    ])
    friction_tags = tag_frictions(combined_text)
    evroutine = decide_tool_invite(friction_tags, None, "listing_evaluation", combined_text)

    latency_ms = int(time.time() * 1000) - start_ms

    return AssistResponse(
        mode="receipt",
        session_id=str(uuid.uuid4()),
        pipeline_stages_used=stages_used,
        is_offo_relevant=True,
        confidence_score=100,
        friction_tags=friction_tags,
        reddit_draft=reddit_draft,
        evroutine_invite=evroutine,
        latency_ms=latency_ms,
        debug=debug,
    )


# -------------------------
# Main entrypoint
# -------------------------

def run_assist_pipeline(req: AssistRequest) -> AssistResponse:
    """Route to the correct pipeline based on mode."""
    if req.mode == "receipt":
        return run_receipt_pipeline(req)
    return run_operator_pipeline(req)
