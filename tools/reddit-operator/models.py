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
