"""
Domain models for the Reddit Community Operator Tool.
Pydantic models for request/response validation.
"""
from __future__ import annotations

from typing import List, Literal, Optional, Dict, Any

from pydantic import BaseModel, Field


# -------------------------
# Type definitions
# -------------------------

Intent = Literal[
    "purchase_advice",
    "ownership_support",
    "charging_question",
    "debate",
    "news",
    "comparison",
    "unknown",
]

UserState = Literal[
    "uncertain",
    "confident",
    "frustrated",
    "excited",
    "skeptical",
    "unknown",
]

OwnershipPhase = Literal[
    "buyer",
    "0_3",
    "4_12",
    "12_plus",
    "unknown",
]

ToolIntro = Literal[
    "no",
    "offer_by_permission",
    "asked_directly",
]

Tone = Literal[
    "ultra_short",
    "standard",
    "empathetic",
    "technical",
]

FrictionTag = Literal[
    "PREDICTABILITY_LOW",
    "PREDICTABILITY_HIGH",
    "NO_HOME_CHARGING",
    "HOME_CHARGING_AVAILABLE",
    "PUBLIC_ANCHOR_PRESENT",
    "SEASONAL_SENSITIVITY",
    "PLANNING_TOLERANCE_LOW",
    "PLANNING_TOLERANCE_HIGH",
    "ROUTINE_VARIABILITY_HIGH",
    "COMPARING_TWO_OPTIONS",
    "BATTERY_HEALTH_ANXIETY",
    "SOFTWARE_TOLERANCE_UNKNOWN",
    "BRAND_WAR_RISK",
]


# -------------------------
# Request model
# -------------------------

class AnalyzeRequest(BaseModel):
    """Input for analyzing a Reddit post/comment."""
    source: str = "reddit"
    subreddit: Optional[str] = None
    thread_type: Optional[str] = None  # first_ev, no_home_charging, comparison, winter, battery_health
    region_hint: Optional[str] = "AUTO"  # US|UK|CA|EU|AUTO
    tone: Tone = "standard"  # ultra_short|standard|empathetic|technical
    post_title: Optional[str] = None
    post_body: str
    top_comment_context: Optional[List[str]] = Field(default_factory=list)


# -------------------------
# Response models
# -------------------------

class ReplyPlan(BaseModel):
    """Structured reply plan with OFFO-style components."""
    validate_line: str
    hidden_tradeoff_line: str
    reframe_line: str
    reflective_question: str
    tool_intro: ToolIntro


class AnalyzeResponse(BaseModel):
    """Full analysis output for a Reddit post."""
    intent: Intent
    user_state: UserState
    ownership_phase: OwnershipPhase
    friction_tags: List[str]
    reply_plan: ReplyPlan
    draft_reply_short: str  # ≤800 chars
    draft_reply_long: str   # ≤2500 chars
    tool_blurb: Optional[str] = None  # Only if tool_intro != "no"
    safety_flags: List[str] = Field(default_factory=list)
    debug: Dict[str, Any] = Field(default_factory=dict)


# -------------------------
# v2 /assist models
# -------------------------

AssistMode = Literal["operator", "receipt"]


class AssistRequest(BaseModel):
    """Unified input for both operator mode (Reddit thread) and receipt mode."""
    mode: AssistMode

    # Operator mode fields (Reddit thread analysis)
    source: str = "reddit"
    subreddit: Optional[str] = None
    thread_type: Optional[str] = None
    region_hint: Optional[str] = "AUTO"   # US|UK|CA|EU|AUTO
    tone: Tone = "standard"
    post_title: Optional[str] = None
    post_body: Optional[str] = None
    top_comment_context: Optional[List[str]] = Field(default_factory=list)

    # Receipt mode fields (receipt-to-Reddit-draft)
    receipt_id: Optional[str] = None
    vehicle_label: Optional[str] = None   # e.g. "2019 Honda Civic EX"
    price_str: Optional[str] = None       # e.g. "$14,500"
    verdict: Optional[str] = None         # "GREEN" | "YELLOW" | "RED"
    verdict_reason: Optional[str] = None
    risk_flags: Optional[List[str]] = Field(default_factory=list)
    must_answer_questions: Optional[List[str]] = Field(default_factory=list)

    # Shared options
    skip_cache: bool = False
    debug_mode: bool = False


class EVRoutineInviteDecision(BaseModel):
    """
    Result of the smart tool invite logic.
    Routes to the right offolab.com tool based on context.
    """
    should_invite: bool
    tool: Optional[str] = None           # 'routine' | 'receipt' | 'compare'
    invite_text: Optional[str] = None    # Ready-to-append reply text with URL
    trigger_reason: Optional[str] = None # e.g. 'friction_tag:NO_HOME_CHARGING' | 'user_uncertain' | 'comparing_two_options' | 'specific_listing'


class TechSupportFlag(BaseModel):
    """Detected tool-related support question."""
    is_support_question: bool
    support_type: Optional[str] = None            # 'extraction_fail'|'my_garage'|'general'
    suggested_reply_suffix: Optional[str] = None  # Text to append to the reply


class RedditDraftStyle(BaseModel):
    """Style config for a Reddit draft — must match TypeScript RedditDraftStyle."""
    format: str = "short_paragraph"   # "short_paragraph" | "standard" | "bullets"
    max_questions: int = 1


class RedditDraftOutput(BaseModel):
    """
    Structured Reddit draft for receipt mode.
    Field constraints mirror the TypeScript RedditDraftSchema Zod schema exactly
    so the Next.js safeParse() call always passes.
    """
    title: str               # 10-200 chars, starts with year/make/model
    body_facts: List[str]    # 1-5 items, 5-200 chars each
    body_uncertainty: List[str]   # 0-3 items, 5-200 chars each
    body_next_steps: List[str]    # 0-3 items, 5-200 chars each
    questions: List[str]     # exactly 1 item, 10-200 chars
    style: RedditDraftStyle


class AssistResponse(BaseModel):
    """Unified output for /assist — covers both operator and receipt modes."""
    mode: AssistMode
    session_id: str                       # UUID from Supabase insert
    pipeline_stages_used: List[str]       # which stages ran (for debug/transparency)

    # OFFO relevance gate (from Stage 1 Grok)
    is_offo_relevant: bool = True         # False = not an EV fit/friction topic
    confidence_score: int = 100           # 0-100 — Grok's confidence this is relevant

    # Classification (always present for operator mode; also present in receipt mode)
    intent: Optional[Intent] = None
    user_state: Optional[UserState] = None
    ownership_phase: Optional[OwnershipPhase] = None
    friction_tags: List[str] = Field(default_factory=list)

    # Operator mode primary output
    draft_reply_short: Optional[str] = None   # ≤800 chars, Grok-polished
    draft_reply_long: Optional[str] = None    # ≤2500 chars
    reply_plan: Optional[ReplyPlan] = None
    tool_blurb: Optional[str] = None

    # Receipt mode primary output
    reddit_draft: Optional[RedditDraftOutput] = None

    # EVRoutine invite decision (always present)
    evroutine_invite: EVRoutineInviteDecision = Field(
        default_factory=lambda: EVRoutineInviteDecision(should_invite=False)
    )

    # Tech support funnel
    tech_support_flag: Optional[TechSupportFlag] = None

    # Safety
    safety_flags: List[str] = Field(default_factory=list)

    # Metadata
    latency_ms: int = 0
    debug: Dict[str, Any] = Field(default_factory=dict)
