"""
OFFO Reddit Community Operator Tool v2

FastAPI service for:
  POST /analyze  — v1 endpoint (backward compat, regex + templates)
  POST /assist   — v2 unified endpoint (multi-AI pipeline, operator + receipt modes)

Run with:
    uvicorn main:app --reload --port 8088
"""
from __future__ import annotations

import os
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import AnalyzeRequest, AnalyzeResponse, AssistRequest, AssistResponse, RedditPostInput
from classifier import detect_intent, detect_user_state, detect_phase, decide_tool_intro
from friction_tagger import tag_frictions
from reply_generator import build_reply_plan, build_drafts, get_tool_blurb
from db import save_analysis, save_assist_session, save_posted_outcome, get_recent_analyses, get_tag_frequency, get_funnel_stats
from pipeline import run_assist_pipeline
from ai_clients import clients_available


# -------------------------
# App setup
# -------------------------

app = FastAPI(
    title="OFFO Reddit Community Operator Tool",
    description="v2 — Multi-AI pipeline for Reddit operator replies and receipt drafts",
    version="2.0.0",
)

# CORS: allow local dev + production Next.js domain
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://ev-risk.netlify.app",
    os.getenv("NEXTJS_ORIGIN", ""),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in ALLOWED_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------
# v2 /assist endpoint
# -------------------------

@app.post("/assist", response_model=AssistResponse)
def assist(req: AssistRequest):
    """
    Unified endpoint for the v2 multi-AI pipeline.

    Modes:
    - operator: Analyze a Reddit thread → generate reply plan + short/long drafts
    - receipt:  Generate a structured Reddit draft from a car-purchase receipt

    Both modes apply the EVRoutine invite logic and tech support detection.
    """
    # Validate required fields per mode
    if req.mode == "operator" and not (req.post_body or "").strip() and not (req.post_title or "").strip():
        raise HTTPException(status_code=400, detail="operator mode requires post_body or post_title")
    if req.mode == "receipt" and not req.vehicle_label:
        raise HTTPException(status_code=400, detail="receipt mode requires vehicle_label")

    resp = run_assist_pipeline(req)

    # Persist asynchronously (errors are swallowed so they never block the response)
    try:
        session_id = save_assist_session(req, resp)
        resp.session_id = session_id or resp.session_id
    except Exception:
        pass

    return resp


# -------------------------
# v1 /analyze endpoint (backward compat — unchanged)
# -------------------------

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    """
    v1 endpoint: regex + template-based reply generation.
    Kept for backward compatibility with existing integrations.
    """
    combined = "\n".join(filter(None, [
        req.post_title or "",
        req.post_body,
        "\n".join(req.top_comment_context or []),
    ]))

    if not combined.strip():
        raise HTTPException(status_code=400, detail="post_body is required")

    intent = detect_intent(combined)
    user_state = detect_user_state(combined)
    phase = detect_phase(combined)
    tags = tag_frictions(combined)
    tool_intro = decide_tool_intro(combined, user_state)

    safety: List[str] = []
    if "BRAND_WAR_RISK" in tags:
        safety.append("Potential brand-war tone — keep neutral, avoid dunking or evangelism.")
    if intent == "debate":
        safety.append("Debate context detected — focus on education, not winning.")
    if user_state == "frustrated":
        safety.append("User seems frustrated — lead with validation, be extra empathetic.")

    plan = build_reply_plan(tags, intent, tool_intro, req.tone)
    drafts = build_drafts(plan, req.tone)

    resp = AnalyzeResponse(
        intent=intent,
        user_state=user_state,
        ownership_phase=phase,
        friction_tags=tags,
        reply_plan=plan,
        draft_reply_short=drafts["short"],
        draft_reply_long=drafts["long"],
        tool_blurb=get_tool_blurb() if tool_intro != "no" else None,
        safety_flags=safety,
        debug={"combined_len": len(combined), "tone": req.tone},
    )

    try:
        save_analysis(req, resp)
    except Exception:
        pass

    return resp


# -------------------------
# /reddit/scan endpoint (PRAW scanner hook)
# -------------------------

@app.post("/reddit/scan", response_model=AssistResponse)
def reddit_scan(post: RedditPostInput):
    """
    Accepts a Reddit post dict and runs the full /assist pipeline.
    Used by the PRAW scanner (scans subreddits every 5 min).
    Currently callable manually via Streamlit or curl for testing.

    The actual PRAW scanner is a separate process that POSTs here.
    """
    req = AssistRequest(
        mode="operator",
        source="reddit",
        subreddit=post.subreddit or None,
        post_title=post.title,
        post_body=post.selftext,
    )

    resp = run_assist_pipeline(req)

    try:
        session_id = save_assist_session(req, resp)
        resp.session_id = session_id or resp.session_id
    except Exception:
        pass

    return resp


# -------------------------
# Session outcome endpoint (used by Streamlit Approve & Post flow)
# -------------------------

class OutcomePayload(BaseModel):
    session_id: str
    outcome: str   # 'posted' | 'edited' | 'skipped'


@app.post("/sessions/{session_id}/outcome")
def record_outcome(session_id: str, body: OutcomePayload):
    """Record the operator outcome for a session (posted / edited / skipped)."""
    try:
        save_posted_outcome(session_id, body.outcome)
    except Exception:
        pass
    return {"ok": True, "session_id": session_id, "outcome": body.outcome}


# -------------------------
# Health + stats endpoints
# -------------------------

@app.get("/health")
def health():
    """Health check — also reports which AI clients are available."""
    import os
    return {
        "status": "ok",
        "version": "2.1.0",
        "service": "offo-reddit-operator",
        "ai_clients": clients_available(),
        "market_analytics": bool(os.getenv("AUTO_DEV_API_KEY")),
    }


@app.get("/stats/recent")
def stats_recent(limit: int = 20):
    """Get recent sessions for review."""
    return {"analyses": get_recent_analyses(limit)}


@app.get("/stats/tags")
def stats_tags():
    """Get friction tag frequency across all sessions."""
    return {"tag_frequency": get_tag_frequency()}


@app.get("/stats/funnel")
def stats_funnel():
    """
    Aggregate funnel metrics for the Streamlit analytics tab.
    Returns: total_sessions, invites_shown, invites_accepted, acceptance_rate,
             posted_count, tag_frequency.
    """
    return get_funnel_stats()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8088)
