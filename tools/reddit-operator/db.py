"""
Supabase persistence for the OFFO Reddit Operator Tool v2.

Replaces the SQLite-based db.py. Function signatures are unchanged
so callers (main.py, pipeline.py) require no modifications.

Tables (see supabase_migrations.sql):
  - reddit_operator_sessions   -- all /analyze and /assist calls
  - reddit_operator_funnel_events -- EVRoutine funnel event log
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
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
    """No-op -- tables are created via supabase_migrations.sql, not at runtime."""
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
        "detected_vehicle": resp.detected_vehicle,  # JSONB -- stored as dict
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
        "market_data": resp.market_data,  # JSONB -- None if Stage 3.5 skipped/failed
        "total_latency_ms": resp.latency_ms,
        # Scanner metadata
        "reddit_post_id": getattr(req, "reddit_post_id", None),
        "reddit_post_url": getattr(req, "reddit_post_url", None),
        "qualification_score": getattr(req, "qualification_score", None),
        # Mark scanner-sourced sessions as pending approval
        "posted_outcome": "pending" if getattr(req, "source", "") == "reddit_scanner" else None,
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


def save_comments(session_id: str, post_id: str, comments: list) -> int:
    """
    Upsert comments for a posted session.
    Uses reddit_comment_id UNIQUE constraint to skip duplicates.
    Returns count of rows submitted.
    """
    if not comments:
        return 0
    rows = []
    for c in comments:
        rows.append({
            "session_id": session_id,
            "reddit_post_id": post_id,
            "reddit_comment_id": c["comment_id"],
            "comment_author": c.get("author"),
            "comment_body": c["body"],
            "comment_score": c.get("score", 0),
            "depth": c.get("depth", 0),
            "is_reply_to_op": c.get("is_reply_to_op", False),
            "comment_date": c.get("created_utc"),
        })
    try:
        _client().table("reddit_post_comments").upsert(
            rows, on_conflict="reddit_comment_id"
        ).execute()
        return len(rows)
    except Exception as e:
        print(f"  [WARN] save_comments failed: {e}")
        return 0


def get_comments_for_session(session_id: str, limit: int = 20) -> list:
    """Fetch stored comments for a given session, sorted by score desc."""
    result = (
        _client()
        .table("reddit_post_comments")
        .select("*")
        .eq("session_id", session_id)
        .order("comment_score", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


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
    """Log a funnel event (fire-and-forget -- errors are swallowed)."""
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


def get_posted_sessions_db(limit: int = 50) -> list:
    """
    Sessions marked posted/edited that have a reddit_post_url set.
    Used by outcome_tracker.py and GET /sessions/posted endpoint.
    """
    result = (
        _client()
        .table("reddit_operator_sessions")
        .select("id, created_at, subreddit, post_title, draft_reply_short, reddit_post_id, reddit_post_url, posted_outcome, upvotes, reply_count")
        .in_("posted_outcome", ["posted", "edited"])
        .not_.is_("reddit_post_url", "null")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


# -------------------------
# Knowledge base
# -------------------------

def upsert_knowledge_base(row: dict) -> str:
    """
    Upsert one item into offo_knowledge_base.
    `row` must contain `source` and `source_id` (the UNIQUE constraint key).
    Returns the id of the upserted row, or "" on error.
    """
    try:
        result = (
            _client()
            .table("offo_knowledge_base")
            .upsert(row, on_conflict="source,source_id")
            .execute()
        )
        rows = result.data or []
        return rows[0]["id"] if rows else ""
    except Exception as e:
        print(f"  [WARN] upsert_knowledge_base failed: {e}")
        return ""


def get_knowledge_base_items(
    post_worthy_only: bool = True,
    days: int = 7,
    limit: int = 50,
) -> list[dict]:
    """Fetch recent knowledge base items for social post generation."""
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    q = (
        _client()
        .table("offo_knowledge_base")
        .select("*")
        .gte("created_at", cutoff)
        .order("score", desc=True)
        .limit(limit)
    )
    if post_worthy_only:
        q = q.eq("post_worthy", True)
    result = q.execute()
    return result.data or []


def get_pending_scan_sessions(limit: int = 20) -> list:
    """
    Get scanner-sourced sessions awaiting human approval.
    Filters: source='reddit_scanner', posted_outcome='pending'.
    Ordered newest first.
    """
    result = (
        _client()
        .table("reddit_operator_sessions")
        .select("id, created_at, subreddit, post_title, post_body, draft_reply_short, qualification_score, reddit_post_url, reddit_post_id")
        .eq("source", "reddit_scanner")
        .eq("posted_outcome", "pending")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


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
