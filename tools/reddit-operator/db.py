"""
Supabase persistence for the OFFO Reddit Operator Tool v2.

Replaces the SQLite-based db.py. Function signatures are unchanged
so callers (main.py, pipeline.py) require no modifications.

Tables (see supabase_migrations.sql):
  - reddit_operator_sessions   — all /analyze and /assist calls
  - reddit_operator_funnel_events — EVRoutine funnel event log
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")


# -------------------------
# Supabase client (lazy)
# -------------------------

_sb = None


def _client():
    """Return a lazy-initialized Supabase client."""
    global _sb
    if _sb is not None:
        return _sb

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in "
            "tools/reddit-operator/.env"
        )

    from supabase import create_client
    _sb = create_client(url, key)
    return _sb


# -------------------------
# Backward-compat stub (init_db no longer needed)
# -------------------------

def init_db() -> None:
    """No-op — tables are created via supabase_migrations.sql, not at runtime."""
    pass


# -------------------------
# /analyze backward-compat (mode = 'analyze_v1')
# -------------------------

def save_analysis(req: Any, resp: Any) -> str:
    """
    Save a v1 /analyze call.

    Maps AnalyzeRequest + AnalyzeResponse to reddit_operator_sessions
    with mode='analyze_v1'. Returns the UUID of the inserted row.
    """
    row = {
        "mode": "analyze_v1",
        "source": getattr(req, "source", "reddit"),
        "subreddit": getattr(req, "subreddit", None),
        "thread_type": getattr(req, "thread_type", None),
        "region_hint": getattr(req, "region_hint", "AUTO"),
        "tone": getattr(req, "tone", "standard"),
        "post_title": getattr(req, "post_title", None),
        "post_body": getattr(req, "post_body", ""),
        "top_comment_context": list(getattr(req, "top_comment_context", None) or []),
        "intent": resp.intent,
        "user_state": resp.user_state,
        "ownership_phase": resp.ownership_phase,
        "friction_tags": list(resp.friction_tags),
        "tool_intro": resp.reply_plan.tool_intro if resp.reply_plan else None,
        "draft_reply_short": resp.draft_reply_short,
        "draft_reply_long": resp.draft_reply_long,
        "safety_flags": list(resp.safety_flags),
    }

    result = _client().table("reddit_operator_sessions").insert(row).execute()
    rows = result.data
    return rows[0]["id"] if rows else ""


# -------------------------
# /assist sessions
# -------------------------

def save_assist_session(req: Any, resp: Any) -> str:
    """
    Save a v2 /assist call.

    Maps AssistRequest + AssistResponse to reddit_operator_sessions.
    Returns the UUID of the inserted row.
    """
    row: dict = {
        "mode": req.mode,
        "source": getattr(req, "source", "reddit"),
        "subreddit": getattr(req, "subreddit", None),
        "thread_type": getattr(req, "thread_type", None),
        "region_hint": getattr(req, "region_hint", "AUTO"),
        "tone": getattr(req, "tone", "standard"),
        "post_title": getattr(req, "post_title", None),
        "post_body": getattr(req, "post_body", None),
        "top_comment_context": list(getattr(req, "top_comment_context", None) or []),
        "receipt_id": getattr(req, "receipt_id", None),
        "intent": resp.intent,
        "secondary_intent": resp.secondary_intent,
        "detected_vehicle": resp.detected_vehicle,  # JSONB — stored as dict
        "suggested_tool": resp.suggested_tool,
        "user_state": resp.user_state,
        "ownership_phase": resp.ownership_phase,
        "friction_tags": list(resp.friction_tags or []),
        "pipeline_stages": list(resp.pipeline_stages_used or []),
        "draft_reply_short": resp.draft_reply_short,
        "draft_reply_long": resp.draft_reply_long,
        "reddit_draft_json": (
            resp.reddit_draft.model_dump() if resp.reddit_draft else None
        ),
        "safety_flags": list(resp.safety_flags or []),
        "evroutine_invited": (
            resp.evroutine_invite.should_invite if resp.evroutine_invite else False
        ),
        "invite_trigger": (
            resp.evroutine_invite.trigger_reason if resp.evroutine_invite else None
        ),
        "offer_by_permission": bool(
            resp.evroutine_invite.should_invite if resp.evroutine_invite else False
        ),
        "market_data": resp.market_data,  # JSONB — None if Stage 3.5 skipped/failed
        "total_latency_ms": resp.latency_ms,
    }

    # Add per-stage latencies if present in debug
    debug = getattr(resp, "debug", {}) or {}
    for stage_key in ("grok_classify_ms", "claude_empathy_ms", "gpt4o_technical_ms", "grok_polish_ms"):
        if stage_key in debug:
            row[stage_key] = debug[stage_key]

    result = _client().table("reddit_operator_sessions").insert(row).execute()
    rows = result.data
    session_id = rows[0]["id"] if rows else ""

    # If EVRoutine invite was shown, log the funnel event
    if resp.evroutine_invite and resp.evroutine_invite.should_invite and session_id:
        log_funnel_event(session_id, "invite_shown", {
            "trigger": resp.evroutine_invite.trigger_reason,
        })

    return session_id


# -------------------------
# Operator feedback
# -------------------------

def save_operator_edit(analysis_id: str, edited_reply: str) -> None:
    """Save an operator's edited reply for learning."""
    _client().table("reddit_operator_sessions").update(
        {"operator_edit": edited_reply}
    ).eq("id", analysis_id).execute()


def save_posted_outcome(
    analysis_id: str,
    outcome: str,
    upvotes: Optional[int] = None,
    reply_count: Optional[int] = None,
) -> None:
    """Save the outcome of a posted reply."""
    update = {"posted_outcome": outcome}
    if upvotes is not None:
        update["upvotes"] = upvotes
    if reply_count is not None:
        update["reply_count"] = reply_count

    _client().table("reddit_operator_sessions").update(update).eq(
        "id", analysis_id
    ).execute()


def save_invite_outcome(session_id: str, accepted: bool) -> None:
    """Record whether the EVRoutine invite was accepted."""
    _client().table("reddit_operator_sessions").update(
        {"invite_accepted": accepted}
    ).eq("id", session_id).execute()

    log_funnel_event(session_id, "invite_accepted" if accepted else "invite_skipped", {})


# -------------------------
# Funnel event log
# -------------------------

def log_funnel_event(session_id: str, event_name: str, event_data: dict) -> None:
    """Log a funnel event (fire-and-forget — errors are swallowed)."""
    try:
        _client().table("reddit_operator_funnel_events").insert({
            "session_id": session_id,
            "event_name": event_name,
            "event_data": event_data,
        }).execute()
    except Exception:
        pass  # Never block the main response for analytics


# -------------------------
# Query helpers
# -------------------------

def get_recent_analyses(limit: int = 50) -> list:
    """Get recent sessions for review (newest first)."""
    result = (
        _client()
        .table("reddit_operator_sessions")
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def get_analyses_by_subreddit(subreddit: str, limit: int = 50) -> list:
    """Get sessions for a specific subreddit."""
    result = (
        _client()
        .table("reddit_operator_sessions")
        .select("*")
        .eq("subreddit", subreddit)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def get_tag_frequency() -> dict:
    """Get friction tag frequency across all sessions (sorted by count)."""
    result = (
        _client()
        .table("reddit_operator_sessions")
        .select("friction_tags")
        .not_.is_("friction_tags", "null")
        .execute()
    )

    tag_counts: dict = {}
    for row in result.data or []:
        tags = row.get("friction_tags") or []
        for tag in tags:
            tag = tag.strip()
            if tag:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

    return dict(sorted(tag_counts.items(), key=lambda x: x[1], reverse=True))


def get_few_shot_examples(intent_tag: str, limit: int = 3) -> list[dict]:
    """
    Fetch high-signal example replies from reddit_comment_examples.

    Used by Stage 2 (Gemini) and Stage 3 (GPT-4o) prompts as few-shot context.
    Returns up to `limit` rows with post_title + successful_reply.
    Falls back to a broader set if the specific intent_tag has no examples.
    """
    try:
        result = (
            _client()
            .table("reddit_comment_examples")
            .select("post_title, post_body, successful_reply, upvote_rate")
            .eq("intent_tag", intent_tag)
            .order("upvote_rate", desc=True)
            .limit(limit)
            .execute()
        )
        rows = result.data or []

        # If insufficient for this intent, fill from generic pool
        if len(rows) < limit:
            generic = (
                _client()
                .table("reddit_comment_examples")
                .select("post_title, post_body, successful_reply, upvote_rate")
                .neq("intent_tag", intent_tag)
                .order("upvote_rate", desc=True)
                .limit(limit - len(rows))
                .execute()
            )
            rows.extend(generic.data or [])

        return rows[:limit]
    except Exception:
        return []


def get_funnel_stats() -> dict:
    """
    Aggregate funnel metrics for the Streamlit analytics tab.

    Returns:
      - total_sessions: int
      - invites_shown: int
      - invites_accepted: int
      - acceptance_rate: float (0-1)
      - posted_count: int
      - tag_frequency: dict
    """
    total_result = (
        _client()
        .table("reddit_operator_sessions")
        .select("id", count="exact")
        .execute()
    )
    total = total_result.count or 0

    invited_result = (
        _client()
        .table("reddit_operator_sessions")
        .select("id", count="exact")
        .eq("evroutine_invited", True)
        .execute()
    )
    invited = invited_result.count or 0

    accepted_result = (
        _client()
        .table("reddit_operator_sessions")
        .select("id", count="exact")
        .eq("invite_accepted", True)
        .execute()
    )
    accepted = accepted_result.count or 0

    posted_result = (
        _client()
        .table("reddit_operator_sessions")
        .select("id", count="exact")
        .eq("posted_outcome", "posted")
        .execute()
    )
    posted = posted_result.count or 0

    return {
        "total_sessions": total,
        "invites_shown": invited,
        "invites_accepted": accepted,
        "acceptance_rate": round(accepted / invited, 3) if invited > 0 else 0.0,
        "posted_count": posted,
        "tag_frequency": get_tag_frequency(),
    }
