"""
OFFO Reddit Community Operator Tool v2

FastAPI service for:
  POST /analyze              — v1 endpoint (backward compat, regex + templates)
  POST /assist               — v2 unified endpoint (multi-AI pipeline, operator + receipt modes)
  POST /social/generate-weekly — generate 10 posts per platform from knowledge base

Run with:
    uvicorn main:app --reload --port 8088
"""
from __future__ import annotations

import io
import os
import sys
from typing import List, Optional

# Force UTF-8 stdout/stderr on Windows to prevent cp1252 crashes on unicode chars
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

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
    version="2.2.0",
)

# CORS: allow local dev + production Next.js domain
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:8888",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "https://ev-risk.netlify.app",
    "https://offolab.com",
    "https://www.offolab.com",
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

@app.post("/reddit/scan")
def reddit_scan(post: RedditPostInput):
    """
    Accepts a Reddit post dict, runs server-side qualification, then the full /assist pipeline.
    Used by the PRAW scanner (scans subreddits every 5 min).
    Also callable manually via Streamlit or curl for testing.

    Returns { status: "skipped", reason } if qualification fails,
    or { status: "queued", session_id, score } on success.
    """
    from qualification_engine import qualify_post

    # Server-side qualification check (safety net even if scanner pre-qualified)
    score = qualify_post(post.title, post.selftext or "", post.subreddit or "")
    if not score.should_reply:
        return {"status": "skipped", "reason": score.disqualify_reason, "score": score.final_score}

    req = AssistRequest(
        mode="operator",
        source="reddit_scanner",
        subreddit=post.subreddit or None,
        post_title=post.title,
        post_body=post.selftext or "",
        reddit_post_id=post.post_id,
        reddit_post_url=post.url,
        qualification_score=post.qualification_score or score.final_score,
    )

    resp = run_assist_pipeline(req)

    try:
        session_id = save_assist_session(req, resp)
        resp.session_id = session_id or resp.session_id
    except Exception:
        pass

    return {
        "status": "queued",
        "session_id": resp.session_id,
        "score": score.final_score,
        "draft_reply_short": resp.draft_reply_short,
    }


# -------------------------
# Session outcome endpoint (used by Streamlit Approve & Post flow)
# -------------------------

class OutcomePayload(BaseModel):
    session_id: str
    outcome: str                    # 'posted' | 'edited' | 'skipped'
    upvotes: Optional[int] = None   # current Reddit post score
    reply_count: Optional[int] = None  # current comment count


@app.post("/sessions/{session_id}/outcome")
def record_outcome(session_id: str, body: OutcomePayload):
    """Record the operator outcome for a session (posted / edited / skipped).
    Optionally also saves upvotes and reply_count if provided."""
    try:
        save_posted_outcome(session_id, body.outcome, body.upvotes, body.reply_count)
    except Exception:
        pass
    return {"ok": True, "session_id": session_id, "outcome": body.outcome}


@app.get("/sessions/posted")
def get_posted_sessions(limit: int = 50):
    """Return sessions marked posted/edited that have a reddit_post_url.
    Used by the outcome tracker and Streamlit upvote refresh UI."""
    from db import get_posted_sessions_db
    return {"sessions": get_posted_sessions_db(limit)}


@app.get("/sessions/{session_id}/comments")
def get_session_comments(session_id: str, limit: int = 20):
    """Return stored comments for a specific posted session."""
    from db import get_comments_for_session
    comments = get_comments_for_session(session_id, limit=limit)
    return {"comments": comments}


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


# -------------------------
# Social post generation
# -------------------------

class SocialGenerateRequest(BaseModel):
    days: int = 7
    dry_run: bool = False


@app.post("/social/generate-weekly")
def social_generate_weekly(req: SocialGenerateRequest = SocialGenerateRequest()):
    """
    Generate 10 posts per platform (Reddit, X, LinkedIn, Facebook) from the
    top post-worthy items in offo_knowledge_base over the last `days` days.
    Saves results back to the knowledge base unless dry_run=True.
    """
    import traceback
    import json
    from fastapi.responses import JSONResponse
    try:
        from social_post_generator import generate_weekly_posts, fetch_post_worthy_items
        items = fetch_post_worthy_items(days=req.days, limit=40)
        result = generate_weekly_posts(days=req.days, dry_run=req.dry_run)
        payload = {
            "reddit": result.get("reddit", []),
            "x": result.get("x", []),
            "linkedin": result.get("linkedin", []),
            "facebook": result.get("facebook", []),
            "item_count": len(items),
            "dry_run": req.dry_run,
        }
        # encode/decode to strip surrogates; default=str handles non-serializable values
        safe = json.dumps(payload, default=str, ensure_ascii=False)
        return JSONResponse(content=json.loads(safe))
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[social-gen] EXCEPTION: {e}\n{tb}", file=sys.stderr)
        return JSONResponse(status_code=500, content={"error": f"{type(e).__name__}: {e}", "traceback": tb})


class VoicePreviewRequest(BaseModel):
    text: str
    filename: str = "preview"


@app.post("/social/voice-preview")
def social_voice_preview(req: VoicePreviewRequest):
    """
    Generate an MP3 voiceover from text via ElevenLabs TTS.
    Returns the output file path or an error message.
    Requires ELEVENLABS_API_KEY in environment.
    """
    from voice_generator import generate_voice
    path = generate_voice(req.text, req.filename)
    if path:
        return {"file_path": path}
    return {"error": "Voice generation failed — check ELEVENLABS_API_KEY and logs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8089)
