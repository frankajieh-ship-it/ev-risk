"""
OFFO Post Generator

Turn today's top routine-impact news into X/Facebook/Reddit posts.
Called by the Streamlit dashboard "Generate Posts" button.

Uses Grok (grok-3-mini) with OFFO voice:
  calm, analytical, never hype, never evangelical.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GROK_API_KEY = os.getenv("GROK_API_KEY")

POST_SYSTEM = """You are OFFO's content writer. OFFO is an EV friction analysis platform at offolab.com that helps people understand real-world EV ownership challenges: charging access, battery daily use, routine fit.

OFFO voice: calm, analytical, never hype, never evangelical. Like a knowledgeable EV owner helping their community understand what actually matters in daily ownership.

Given today's top routine-impact EV news, write:
1. An X (Twitter) thread: 3-5 tweets, max 280 chars each
2. A Facebook post: warm, helpful tone, 100-200 words
3. A Reddit post: title + body for r/electricvehicles or r/EVRoutine (first-person community voice, not marketing)

Rules:
- Focus on how each story affects real daily ownership — not specs or politics
- Include offolab.com/receipt or offolab.com/routine only when it naturally solves the problem described (max once total across all three posts)
- No hype. No "game changer". No "revolutionary". No "exciting news". Just useful, grounded analysis.
- Reddit body should sound like a community member, not a brand

Output ONLY valid JSON (no markdown fences):
{
  "x_thread": [
    {"tweet": 1, "text": "..."},
    {"tweet": 2, "text": "..."}
  ],
  "facebook": {
    "text": "...",
    "suggested_image_prompt": "..."
  },
  "reddit": {
    "title": "...",
    "body": "..."
  }
}"""


def _call_grok(messages: list, max_tokens: int = 1500) -> Optional[str]:
    """Call Grok and return raw text. Returns None on any error."""
    if not GROK_API_KEY:
        print("[post-gen] GROK_API_KEY not set", file=sys.stderr)
        return None
    try:
        resp = requests.post(
            "https://api.x.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROK_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "grok-3-mini",
                "temperature": 0.4,
                "max_tokens": max_tokens,
                "messages": messages,
            },
            timeout=30,
        )
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"].strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
        return raw
    except Exception as e:
        print(f"[post-gen] Grok error: {e}", file=sys.stderr)
        return None


def generate_posts(top_articles: list[dict]) -> Optional[dict]:
    """
    Generate X/FB/Reddit posts from the top scored articles.
    Returns parsed dict or None if generation fails.
    """
    if not top_articles:
        return None

    # Build compact digest of top articles
    digest_lines = []
    for i, a in enumerate(top_articles[:10], 1):
        summary = a.get("ai_summary") or a.get("summary", "")[:150]
        digest_lines.append(
            f"{i}. [{a.get('impact_score', 0)}/100] {a['title']}\n"
            f"   Routine effect: {summary}"
        )
    digest = "\n\n".join(digest_lines)

    user_msg = f"Today's top routine-impact EV news (sorted by impact score):\n\n{digest}"

    messages = [
        {"role": "system", "content": POST_SYSTEM},
        {"role": "user", "content": user_msg},
    ]

    raw = _call_grok(messages, max_tokens=1500)
    if not raw:
        return None

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[post-gen] JSON parse error: {e}\nRaw: {raw[:300]}", file=sys.stderr)
        return None


def fetch_top_articles(limit: int = 10, hours_back: int = 24) -> list[dict]:
    """Fetch today's top scored articles from Supabase."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[post-gen] Supabase credentials not set", file=sys.stderr)
        return []

    since = (datetime.now(timezone.utc) - timedelta(hours=hours_back)).isoformat()

    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/daily_routine_news",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
            },
            params={
                "scored_at": f"gte.{since}",
                "is_routine_impact": "eq.true",
                "order": "impact_score.desc",
                "limit": limit,
                "select": "title,url,source,impact_score,ai_summary,key_routine_effects,post_worthy",
            },
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[post-gen] Fetch error: {e}", file=sys.stderr)
        return []
