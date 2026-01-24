"""
Reply generator with OFFO-style templates.
Constructs calm, validating replies with reflective questions.
Supports multiple tones: ultra_short, standard, empathetic, technical.
"""
from __future__ import annotations

from typing import List, Dict

from models import Intent, ReplyPlan, ToolIntro, Tone
from friction_tagger import get_primary_friction


# -------------------------
# Tone-specific templates
# -------------------------

TONE_TEMPLATES = {
    "ultra_short": {
        "validate_default": "Makes sense.",
        "validate_no_home": "Totally fair — public charging can work if it's predictable.",
        "validate_comparison": "Good question — two EVs can feel very different week to week.",
        "validate_seasonal": "Good question — winter is where setups that 'work' start requiring planning.",
        "validate_battery": "Reasonable concern — battery uncertainty tends to keep resurfacing.",
        "reframe_default": "This is mostly about how often you have to think about charging.",
        "reframe_home": "With a reliable home/work anchor, most EV friction fades.",
        "hidden_default": "The hidden tradeoff is predictability vs availability.",
        "hidden_seasonal": "The hidden tradeoff is seasonal buffer — winter is where it shows.",
        "hidden_battery": "The hidden tradeoff is confidence buffer.",
        "question_default": "Where would charging *actually* happen in a normal week?",
        "question_no_home": "Do you have a reliable Plan B charger within ~10–15 minutes?",
        "question_comparison": "Do you have reliable home/work charging — and how variable are your weeks?",
        "tool_line": " If you want, I can share a 30s routine sanity-check.",
        "max_short_chars": 520,
    },
    "standard": {
        "validate_default": "That makes sense — you're thinking about the part of ownership that usually matters more than headline specs.",
        "validate_no_home": "Totally fair — public-charging setups can work, but only when they become predictable enough to fade into the background.",
        "validate_comparison": "You're asking the right question — two EVs can look similar on paper but feel very different week to week.",
        "validate_seasonal": "Good question — winter is where many setups that 'work on paper' start requiring more active management.",
        "validate_battery": "That's a reasonable concern — battery uncertainty is one of the things that can keep resurfacing mentally even when the numbers look fine.",
        "reframe_default": "This isn't really about the car — it's about how often you have to think about charging.",
        "reframe_home": "With a reliable home/work anchor, most EV friction disappears — the edge cases are what reveal fit.",
        "hidden_default": "The hidden tradeoff is usually predictability vs availability: it's not how many chargers exist, it's whether charging becomes a repeatable anchor.",
        "hidden_seasonal": "The hidden tradeoff is seasonal buffer: winter months (or disrupted weeks) are where setups that 'work' start resurfacing mentally.",
        "hidden_battery": "The hidden tradeoff is confidence buffer: it's less about the number and more about how often you'll second-guess 'did I top up enough?'",
        "question_default": "In a normal week, where would charging actually happen — as part of something you're already doing, or as a separate errand?",
        "question_no_home": "Do you have one reliable 'Plan B' location you can count on within ~10–15 minutes when a week goes sideways?",
        "question_comparison": "Do you have reliable home/work charging, and how often do you hit disrupted weeks or 150–200+ mile days?",
        "tool_line": " Happy to share a quick routine sanity-check if you want structure.",
        "max_short_chars": 780,
    },
    "empathetic": {
        "validate_default": "Totally get why you're thinking about this — EV ownership is easy when it fades into the background, and stressful when it keeps resurfacing.",
        "validate_no_home": "That's completely fair. Plenty of people make public charging work — the difference is whether it's predictable enough to stop feeling like a separate task.",
        "validate_comparison": "You're not overthinking it — the day-to-day feel can differ a lot even when two options look similar on paper.",
        "validate_seasonal": "That's a fair concern — winter is where a lot of people start noticing the mental overhead that didn't exist in summer.",
        "validate_battery": "I hear you — battery uncertainty is one of those things that can keep circling back mentally, even when the actual numbers suggest it's fine.",
        "reframe_default": "Nothing is 'broken' when it feels annoying — it's usually the routine doing extra work.",
        "reframe_home": "If you've got a stable anchor (home/work), most of the anxiety disappears and it becomes buffer management.",
        "hidden_default": "The hidden tradeoff is usually predictability vs availability.",
        "hidden_seasonal": "The hidden tradeoff is seasonal buffer: winter is when routines that 'work' start requiring conscious attention again.",
        "hidden_battery": "The hidden tradeoff is confidence buffer — the feeling of 'is this enough?' matters as much as the actual number.",
        "question_default": "What would make charging feel boring for you — one consistent anchor, or hopping between options?",
        "question_no_home": "What's your Plan B when your usual chargers are busy or out of service?",
        "question_comparison": "What's your charging anchor, and how much do your weeks change (late nights, weekend trips, unpredictable days)?",
        "tool_line": " If you want a bit of structure, we built a short routine sanity-check (not a recommendation tool). Happy to share.",
        "max_short_chars": 950,
    },
    "technical": {
        "validate_default": "Reasonable question — the experience is mostly determined by predictability, buffer, and how often you need to intervene.",
        "validate_no_home": "Public charging can work if you have stable anchors (repeatable locations, known uptime/queue patterns, predictable dwell time).",
        "validate_comparison": "Comparison is valid — two vehicles can differ mainly in charging curve, winter efficiency, and service/software maturity.",
        "validate_seasonal": "Valid concern — winter introduces variables: cabin heating load, battery preconditioning, reduced regen, and potential charger queueing.",
        "validate_battery": "Fair question — degradation curves vary by chemistry, thermal management, and charging patterns. The uncertainty is often worse than the actual number.",
        "reframe_default": "The key variable is intervention frequency: how often you must actively plan/stop to maintain buffer.",
        "reframe_home": "A home/work AC anchor typically converts the problem into low-frequency buffer top-ups.",
        "hidden_default": "The hidden tradeoff: charger density ≠ charger reliability. Availability matters less than predictable uptime at your anchors.",
        "hidden_seasonal": "The hidden tradeoff is seasonal buffer compression: 15-30% winter range reduction compounds with existing margin.",
        "hidden_battery": "The hidden tradeoff is confidence vs actuals — perceived degradation often exceeds measured SoH impact on usable range.",
        "question_default": "What are your weekly miles, charging anchors (home/work/public), and how often do disrupted days occur?",
        "question_no_home": "What's the nearest reliable backup site, and what's the typical queue/downtime pattern there?",
        "question_comparison": "Do you have home/work charging, winter conditions, and how often you do >150–200-mile days?",
        "tool_line": " If you want structure, we built a quick sanity-check focused on charging predictability and routine friction (not specs). Happy to share.",
        "max_short_chars": 1000,
    },
}


# -------------------------
# Legacy templates (fallback for friction-specific content)
# -------------------------

HIDDEN_TRADEOFF_TEMPLATES = {
    "default": "The hidden tradeoff is usually predictability vs availability: it's not how many chargers exist, it's whether charging becomes a repeatable anchor.",
    "NO_HOME_CHARGING": "The hidden tradeoff is that public charging can work, but it needs to become a predictable anchor — not a hunt every time.",
    "PREDICTABILITY_LOW": "The hidden tradeoff is that charger density doesn't matter much if the ones you need are unreliable or crowded when you need them.",
    "SEASONAL_SENSITIVITY": "The hidden tradeoff is seasonal buffer: winter months (or disrupted weeks) are where setups that 'work' start resurfacing mentally.",
    "BATTERY_HEALTH_ANXIETY": "The hidden tradeoff is confidence buffer: it's less about the number and more about how often you'll second-guess 'did I top up enough?'",
    "COMPARING_TWO_OPTIONS": "The hidden tradeoff is usually routine fit: specs matter less than whether the car fits your actual charging pattern.",
    "PLANNING_TOLERANCE_LOW": "The hidden tradeoff is mental overhead: some setups work fine but require you to think about charging more often than you'd like.",
    "ROUTINE_VARIABILITY_HIGH": "The hidden tradeoff is edge-case handling: variable weeks are where the 'it works most of the time' qualifier shows up.",
}

# Tool blurb (only used when tool_intro is not "no")
TOOL_BLURB = "If you want, we built a quick EV routine sanity-check (30 seconds, no signup) that surfaces where charging will fade into the background vs keep resurfacing."


# -------------------------
# Reply building functions
# -------------------------

def build_reply_plan(tags: List[str], intent: Intent, tool_intro: ToolIntro, tone: Tone = "standard") -> ReplyPlan:
    """
    Build a structured reply plan based on friction tags, intent, and tone.

    Selects the most appropriate template for each component.
    """
    tpl = TONE_TEMPLATES[tone]
    primary = get_primary_friction(tags)

    # Select validation line based on friction tags and tone
    validate = tpl["validate_default"]
    if "NO_HOME_CHARGING" in tags:
        validate = tpl["validate_no_home"]
    elif "SEASONAL_SENSITIVITY" in tags:
        validate = tpl["validate_seasonal"]
    elif "BATTERY_HEALTH_ANXIETY" in tags:
        validate = tpl["validate_battery"]
    elif intent == "comparison" or "COMPARING_TWO_OPTIONS" in tags:
        validate = tpl["validate_comparison"]

    # Select hidden tradeoff line
    hidden = tpl["hidden_default"]
    if "SEASONAL_SENSITIVITY" in tags:
        hidden = tpl["hidden_seasonal"]
    elif "BATTERY_HEALTH_ANXIETY" in tags:
        hidden = tpl["hidden_battery"]
    elif primary in HIDDEN_TRADEOFF_TEMPLATES:
        # Use legacy template for friction-specific content not in tone templates
        hidden = HIDDEN_TRADEOFF_TEMPLATES[primary]

    # Select reframe line
    reframe = tpl["reframe_default"]
    if "HOME_CHARGING_AVAILABLE" in tags:
        reframe = tpl["reframe_home"]

    # Select reflective question
    question = tpl["question_default"]
    if "NO_HOME_CHARGING" in tags:
        question = tpl["question_no_home"]
    elif intent == "comparison" or "COMPARING_TWO_OPTIONS" in tags:
        question = tpl["question_comparison"]

    return ReplyPlan(
        validate_line=validate,
        hidden_tradeoff_line=hidden,
        reframe_line=reframe,
        reflective_question=question,
        tool_intro=tool_intro,
    )


def build_drafts(plan: ReplyPlan, tone: Tone = "standard") -> Dict[str, str]:
    """
    Build short and long draft replies from a reply plan.

    Short: Character limit varies by tone (520-1000 chars)
    Long: ≤2500 chars (for detailed responses)
    """
    tpl = TONE_TEMPLATES[tone]

    # Build short version
    tool_line = ""
    if plan.tool_intro in ("offer_by_permission", "asked_directly"):
        tool_line = tpl["tool_line"]

    short = (
        f"{plan.validate_line} "
        f"{plan.hidden_tradeoff_line} "
        f"{plan.reframe_line} "
        f"{plan.reflective_question}"
        f"{tool_line}"
    )

    # Truncate based on tone's max chars
    max_chars = int(tpl["max_short_chars"])
    short = short.strip()
    if len(short) > max_chars:
        short = short[:max_chars - 1].rstrip() + "…"

    # Build long version
    long_parts = [
        plan.validate_line,
        "",
        plan.hidden_tradeoff_line,
        plan.reframe_line,
        "",
        plan.reflective_question,
    ]

    if plan.tool_intro in ("offer_by_permission", "asked_directly"):
        long_parts.append("")
        if tone in ("technical", "standard"):
            long_parts.append("If you want structure, we built a quick sanity-check focused on charging predictability and routine friction (not specs). Happy to share.")
        else:
            long_parts.append("If you want a bit of structure, we built a short routine sanity-check (not a recommendation tool). Happy to share.")

    long = "\n".join(long_parts)

    # Truncate if over 2500 chars
    if len(long) > 2500:
        long = long[:2497] + "..."

    return {"short": short, "long": long}


def get_tool_blurb() -> str:
    """Get the standard tool introduction blurb."""
    return TOOL_BLURB
