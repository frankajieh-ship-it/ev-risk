"""
OFFO Reddit Community Operator Tool

FastAPI service for analyzing Reddit posts and generating on-brand replies.

Run with:
    uvicorn main:app --reload --port 8088
"""
from __future__ import annotations

from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import AnalyzeRequest, AnalyzeResponse
from classifier import detect_intent, detect_user_state, detect_phase, decide_tool_intro
from friction_tagger import tag_frictions
from reply_generator import build_reply_plan, build_drafts, get_tool_blurb
from db import init_db, save_analysis, get_recent_analyses, get_tag_frequency


# -------------------------
# App setup
# -------------------------

app = FastAPI(
    title="OFFO Reddit Community Operator Tool",
    description="Analyze Reddit posts and generate on-brand OFFO-style replies",
    version="0.1.0",
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    """Initialize database on startup."""
    init_db()


# -------------------------
# Main analyze endpoint
# -------------------------

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    """
    Analyze a Reddit post and generate a reply plan.

    Returns:
    - Classification (intent, user_state, ownership_phase)
    - Friction tags
    - Reply plan with OFFO-style components
    - Draft replies (short and long versions)
    - Tool blurb (only if tool_intro is not "no")
    - Safety flags
    """
    # Combine all text for analysis
    combined = "\n".join(filter(None, [
        req.post_title or "",
        req.post_body,
        "\n".join(req.top_comment_context or []),
    ]))

    if not combined.strip():
        raise HTTPException(status_code=400, detail="post_body is required")

    # Run classification
    intent = detect_intent(combined)
    user_state = detect_user_state(combined)
    phase = detect_phase(combined)
    tags = tag_frictions(combined)

    # Determine tool introduction permission
    tool_intro = decide_tool_intro(combined, user_state)

    # Build safety flags
    safety: List[str] = []
    if "BRAND_WAR_RISK" in tags:
        safety.append("Potential brand-war tone — keep neutral, avoid dunking or evangelism.")
    if intent == "debate":
        safety.append("Debate context detected — focus on education, not winning.")
    if user_state == "frustrated":
        safety.append("User seems frustrated — lead with validation, be extra empathetic.")

    # Build reply plan and drafts (tone-aware)
    plan = build_reply_plan(tags, intent, tool_intro, req.tone)
    drafts = build_drafts(plan, req.tone)

    # Build response
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

    # Save to database
    save_analysis(req, resp)

    return resp


# -------------------------
# Admin/stats endpoints
# -------------------------

@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "offo-reddit-operator"}


@app.get("/stats/recent")
def stats_recent(limit: int = 20):
    """Get recent analyses for review."""
    return {"analyses": get_recent_analyses(limit)}


@app.get("/stats/tags")
def stats_tags():
    """Get friction tag frequency across all analyses."""
    return {"tag_frequency": get_tag_frequency()}


# -------------------------
# Interactive docs
# -------------------------

# FastAPI automatically generates:
# - Swagger UI at /docs
# - ReDoc at /redoc


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8088)
