"""
OFFO Reddit Community Operator Tool v2

FastAPI service for:
  POST /analyze  — v1 endpoint (backward compat, regex + templates)
  POST /assist   — v2 unified endpoint (multi-AI pipeline, operator + receipt modes)

Run with:
    uvicorn main:app --reload --port 8088
"""
from __future__ import annotations

import asyncio
import os
from typing import Any, List, Optional

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
from app.ai.chain_runner import run_task
from app.ai.task_types import get_task
from app.ai.prompt_registry import get_prompt
from app.jobs.ai_jobs import job_queue


# -------------------------
# App setup
# -------------------------

app = FastAPI(
    title="OFFO Reddit Community Operator Tool",
    description="v2 — Multi-AI pipeline for Reddit operator replies and receipt drafts",
    version="2.1.0",
)


@app.on_event("startup")
async def _startup():
    """Start background job worker on app startup."""
    asyncio.create_task(job_queue.start_worker())

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
# Layer 2: Dealer Intelligence endpoints
# -------------------------

class ChatSignalsRequest(BaseModel):
    transcript: str                    # dealer-buyer conversation text
    context: Optional[str] = None      # optional deal context (vehicle, price, etc.)


@app.post("/dealer/chat-signals")
def dealer_chat_signals(req: ChatSignalsRequest):
    """
    Extract buying signals, objections, and urgency from a dealer-buyer conversation.
    Returns actionable intelligence for the dealer.
    """
    if not req.transcript.strip():
        raise HTTPException(status_code=400, detail="transcript is required")

    task = get_task("dealer_signals")
    prompt = get_prompt(task.prompt_key)
    user_content = req.transcript
    if req.context:
        user_content = f"Deal context: {req.context}\n\nConversation:\n{req.transcript}"

    messages = [
        {"role": "system", "content": prompt.system_template},
        {"role": "user", "content": user_content[:4000]},
    ]
    result = run_task(task, messages)
    if result.status == "error" and not result.parsed_output:
        raise HTTPException(status_code=503, detail="AI service unavailable")
    return {"status": result.status, "signals": result.parsed_output, "duration_ms": result.duration_ms}


class BuyerProfileRequest(BaseModel):
    interests: List[str]               # vehicle types / brands the buyer mentioned
    budget_min_usd: Optional[int] = None
    budget_max_usd: Optional[int] = None
    usage_pattern: Optional[str] = None   # e.g. "daily commute 40 miles, weekend road trips"
    charging_situation: Optional[str] = None  # e.g. "has home charger, Level 2"
    notes: Optional[str] = None


@app.post("/dealer/buyer-profile")
def dealer_buyer_profile(req: BuyerProfileRequest):
    """
    Generate a structured buyer persona from interests, budget, and usage data.
    Helps dealers tailor their approach and match inventory.
    """
    task = get_task("buyer_profile")
    prompt = get_prompt(task.prompt_key)

    budget_str = ""
    if req.budget_min_usd or req.budget_max_usd:
        budget_str = f"Budget: ${req.budget_min_usd or 0:,} – ${req.budget_max_usd or '?'}"

    user_content = "\n".join(filter(None, [
        f"Vehicle interests: {', '.join(req.interests)}" if req.interests else None,
        budget_str,
        f"Usage pattern: {req.usage_pattern}" if req.usage_pattern else None,
        f"Charging situation: {req.charging_situation}" if req.charging_situation else None,
        f"Additional notes: {req.notes}" if req.notes else None,
    ]))

    if not user_content.strip():
        raise HTTPException(status_code=400, detail="At least one buyer signal (interests, budget, usage) is required")

    messages = [
        {"role": "system", "content": prompt.system_template},
        {"role": "user", "content": user_content},
    ]
    result = run_task(task, messages)
    if result.status == "error" and not result.parsed_output:
        raise HTTPException(status_code=503, detail="AI service unavailable")
    return {"status": result.status, "profile": result.parsed_output, "duration_ms": result.duration_ms}


class PricingInsightRequest(BaseModel):
    make: str
    model: str
    year: int
    mileage: Optional[int] = None
    asking_price_usd: int
    trim: Optional[str] = None
    condition: Optional[str] = None   # "good" | "fair" | "excellent"
    zip_code: Optional[str] = None


@app.post("/dealer/pricing")
def dealer_pricing(req: PricingInsightRequest):
    """
    Assess a vehicle's asking price vs market.
    Uses Grok + optionally Auto.dev market data if available.
    """
    task = get_task("pricing_insight")
    prompt = get_prompt(task.prompt_key)

    vehicle_desc = f"{req.year} {req.make} {req.model}"
    if req.trim:
        vehicle_desc += f" {req.trim}"

    user_content = "\n".join(filter(None, [
        f"Vehicle: {vehicle_desc}",
        f"Asking price: ${req.asking_price_usd:,}",
        f"Mileage: {req.mileage:,} miles" if req.mileage else None,
        f"Condition: {req.condition}" if req.condition else None,
        f"Location: {req.zip_code}" if req.zip_code else None,
    ]))

    # Optionally inject real market data
    market_context = ""
    try:
        from services.market_analytics import get_market_analytics, format_market_context
        market_data = get_market_analytics(
            vin=None,
            zip_code=req.zip_code,
            listing_price=req.asking_price_usd,
            make=req.make,
            model=req.model,
            year=req.year,
        )
        if market_data:
            market_context = format_market_context(market_data)
            user_content += f"\n\nReal-time market data:\n{market_context}"
    except Exception:
        pass  # market data is optional

    messages = [
        {"role": "system", "content": prompt.system_template},
        {"role": "user", "content": user_content},
    ]
    result = run_task(task, messages)
    if result.status == "error" and not result.parsed_output:
        raise HTTPException(status_code=503, detail="AI service unavailable")
    return {
        "status": result.status,
        "insight": result.parsed_output,
        "market_data_used": bool(market_context),
        "duration_ms": result.duration_ms,
    }


class InventoryMatchRequest(BaseModel):
    buyer_profile: dict          # output from /dealer/buyer-profile
    inventory: List[dict]        # list of vehicle records
    max_results: int = 10


@app.post("/dealer/inventory-match")
async def dealer_inventory_match(req: InventoryMatchRequest):
    """
    Async: match a buyer profile against dealer inventory.
    Returns job_id immediately; poll GET /jobs/{job_id} for results.
    """
    if not req.buyer_profile:
        raise HTTPException(status_code=400, detail="buyer_profile is required")

    job_id = await job_queue.enqueue("dealer_inventory_match", {
        "buyer_profile": req.buyer_profile,
        "inventory": req.inventory,
        "max_results": req.max_results,
    })
    return {"job_id": job_id, "status": "queued"}


# -------------------------
# Layer 3: Copart endpoints
# -------------------------

class CopartAnalyzeRequest(BaseModel):
    lot_number: str


@app.post("/copart/analyze")
def copart_analyze(req: CopartAnalyzeRequest):
    """
    Analyze a single Copart lot: damage summary, repair estimate, ARV, max safe bid.
    Results are cached 24h per lot number.
    """
    if not req.lot_number.strip():
        raise HTTPException(status_code=400, detail="lot_number is required")

    import asyncio as _asyncio
    from app.jobs.ai_jobs import _fetch_copart_lot

    # Fetch lot data synchronously (run async helper in event loop)
    try:
        loop = _asyncio.get_event_loop()
        lot_text = loop.run_until_complete(_fetch_copart_lot(req.lot_number.strip()))
    except RuntimeError:
        # Already in async context — shouldn't happen on sync endpoint but guard it
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            lot_text = pool.submit(
                lambda: _asyncio.run(_fetch_copart_lot(req.lot_number.strip()))
            ).result()

    task = get_task("copart_analyze")
    prompt = get_prompt(task.prompt_key)

    messages = [
        {"role": "system", "content": prompt.system_template},
        {"role": "user", "content": f"Lot number: {req.lot_number}\n\n{lot_text}"},
    ]

    result = run_task(task, messages)
    if result.status == "error" and not result.parsed_output:
        raise HTTPException(status_code=503, detail="AI service unavailable")

    return {
        "lot_number": req.lot_number,
        "status": result.status,
        "cached": "(cached)" in result.model_used,
        "analysis": result.parsed_output,
        "duration_ms": result.duration_ms,
    }


class BatchCopartRequest(BaseModel):
    lot_numbers: List[str]


@app.post("/copart/batch-scan")
async def copart_batch_scan(req: BatchCopartRequest):
    """
    Async: scan multiple Copart lots in one job.
    Returns job_id immediately; poll GET /jobs/{job_id} for all results.
    """
    if not req.lot_numbers:
        raise HTTPException(status_code=400, detail="lot_numbers list is required")
    if len(req.lot_numbers) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 lots per batch")

    job_id = await job_queue.enqueue("batch_copart_scan", {
        "lot_numbers": [ln.strip() for ln in req.lot_numbers if ln.strip()],
    })
    return {"job_id": job_id, "status": "queued", "lot_count": len(req.lot_numbers)}


# -------------------------
# Job status endpoint
# -------------------------

@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Poll the status and result of an async job (inventory-match, batch-scan)."""
    record = await job_queue.get_status(job_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": record.job_id,
        "job_type": record.job_type,
        "status": record.status,
        "result": record.result,
        "error": record.error,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8088)
