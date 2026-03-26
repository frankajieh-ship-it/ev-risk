"""
OFFO Routine Impact News Engine

Daily pipeline:
  1. Fetch articles from RSS feeds + NewsData.io API
  2. Grok classifier scores each for routine impact (0-100)
  3. Deduplicate by URL hash, upsert to Supabase daily_routine_news table
  4. Print summary to stdout (for GitHub Actions logs)

Run:
    python daily_news_engine.py
    python daily_news_engine.py --dry-run   # score + print, skip Supabase write
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import sys
import time

# Force UTF-8 stdout/stderr on Windows (avoids cp1252 UnicodeEncodeError)
if sys.stdout and hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr and hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import feedparser
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GROK_API_KEY = os.getenv("GROK_API_KEY")
NEWSDATA_API_KEY = os.getenv("NEWSDATA_API_KEY")

MIN_IMPACT_SCORE = 65

RSS_FEEDS = [
    ("Electrek", "https://electrek.co/feed/"),
    ("InsideEVs", "https://insideevs.com/feed/"),
    ("Green Car Reports", "https://www.greencarreports.com/rss"),
    ("Electrive", "https://www.electrive.com/feed/"),
    ("EV Magazine", "https://evmagazine.com/feed/"),
]

GROK_CLASSIFIER_SYSTEM = """Analyze this EV news article headline and summary. Score how much it directly affects real EV owner daily routines: charging access, home charging feasibility, winter range behavior, battery degradation in normal use, charging infrastructure changes, recalls impacting ownership, range anxiety triggers, DCFC availability, software OTA changes affecting charging or range.

Score LOW (< 50) for:
- Pure spec announcements for future cars not yet on sale
- Company financials, stock prices, factory news
- General EV market trends without specific user impact
- Brand wars or opinion pieces
- Regulatory or political stories without direct ownership impact

Score HIGH (>= 65) for:
- Recalls affecting battery, charging port, or software
- Charging network outages, expansions, or reliability changes
- Real-world range or efficiency data from actual use
- Battery degradation findings from real-world fleet data
- Home charging or public charging infrastructure changes that affect access
- Regulatory changes directly affecting EV ownership costs

Output ONLY valid JSON (no markdown, no explanation):
{
  "is_routine_impact": true or false,
  "impact_score": 0-100,
  "key_routine_effects": ["charging", "winter", "battery_daily_use", "recall", "infrastructure", "range", "cost"],
  "one_sentence_summary": "One sentence: how this specifically affects an EV owner's daily routine.",
  "post_worthy": true or false,
  "reasoning": "One sentence explaining the score."
}"""


def _grok_classify(title: str, summary: str) -> Optional[dict]:
    """Call Grok to score a single article for routine impact."""
    if not GROK_API_KEY:
        print("[news-engine] WARNING: GROK_API_KEY not set — skipping AI scoring", file=sys.stderr)
        return None

    text = f"Headline: {title}\n\nSummary: {summary[:600]}"
    try:
        resp = requests.post(
            "https://api.x.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROK_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "grok-3-mini",
                "temperature": 0.0,
                "max_tokens": 300,
                "messages": [
                    {"role": "system", "content": GROK_CLASSIFIER_SYSTEM},
                    {"role": "user", "content": text},
                ],
            },
            timeout=20,
        )
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"].strip()
        # Strip markdown fences if Grok wraps output
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
        return json.loads(raw)
    except Exception as e:
        print(f"[news-engine] Grok classify error: {e}", file=sys.stderr)
        return None


def _article_id(url: str) -> str:
    """Stable dedup key from URL — first 16 chars of sha256."""
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def fetch_rss(feed_name: str, feed_url: str) -> list[dict]:
    """Fetch articles from a single RSS feed. Caps at 20 articles."""
    articles = []
    try:
        feed = feedparser.parse(feed_url)
        for entry in feed.entries[:20]:
            title = getattr(entry, "title", "")
            summary = getattr(entry, "summary", "") or getattr(entry, "description", "")
            url = getattr(entry, "link", "")
            published = getattr(entry, "published", "") or getattr(entry, "updated", "")
            if title and url:
                articles.append({
                    "article_id": _article_id(url),
                    "title": title[:500],
                    "summary": summary[:1000] if summary else "",
                    "url": url,
                    "source": feed_name,
                    "published_at": published[:30] if published else None,
                })
        print(f"[news-engine] {feed_name}: {len(articles)} articles fetched")
    except Exception as e:
        print(f"[news-engine] RSS error ({feed_name}): {e}", file=sys.stderr)
    return articles


def fetch_newsdata(query: str = "electric vehicle EV charging recall", limit: int = 10) -> list[dict]:
    """Fetch from NewsData.io API. Skips gracefully if key not set."""
    if not NEWSDATA_API_KEY:
        print("[news-engine] NEWSDATA_API_KEY not set — skipping NewsData.io fetch")
        return []
    try:
        resp = requests.get(
            "https://newsdata.io/api/1/news",
            params={
                "apikey": NEWSDATA_API_KEY,
                "q": query,
                "language": "en",
                "category": "technology,science",
                "size": min(limit, 10),  # free tier max 10 per call
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        articles = []
        for item in (data.get("results") or []):
            url = item.get("link") or item.get("source_url") or ""
            title = item.get("title") or ""
            summary = item.get("description") or item.get("content") or ""
            if title and url:
                articles.append({
                    "article_id": _article_id(url),
                    "title": title[:500],
                    "summary": summary[:1000],
                    "url": url,
                    "source": item.get("source_id") or "newsdata",
                    "published_at": (item.get("pubDate") or "")[:30],
                })
        print(f"[news-engine] NewsData.io: {len(articles)} articles fetched")
        return articles
    except Exception as e:
        print(f"[news-engine] NewsData.io error: {e}", file=sys.stderr)
        return []


def deduplicate(articles: list[dict]) -> list[dict]:
    """Deduplicate by article_id (stable URL hash)."""
    seen: set[str] = set()
    out = []
    for a in articles:
        if a["article_id"] not in seen:
            seen.add(a["article_id"])
            out.append(a)
    return out


def score_articles(articles: list[dict]) -> list[dict]:
    """
    Run Grok classifier on each article.
    Returns only those scoring >= MIN_IMPACT_SCORE, annotated with AI fields.
    Articles that fail scoring are dropped (not saved).
    """
    scored = []
    for i, article in enumerate(articles):
        print(f"[news-engine] Scoring {i+1}/{len(articles)}: {article['title'][:60]}...")
        result = _grok_classify(article["title"], article["summary"])
        if result:
            score = int(result.get("impact_score", 0))
            if score >= MIN_IMPACT_SCORE:
                article["impact_score"] = score
                article["is_routine_impact"] = bool(result.get("is_routine_impact", False))
                article["key_routine_effects"] = result.get("key_routine_effects") or []
                article["ai_summary"] = result.get("one_sentence_summary") or ""
                article["post_worthy"] = bool(result.get("post_worthy", False))
                article["scored_at"] = datetime.now(timezone.utc).isoformat()
                scored.append(article)
                print(f"  [KEPT] Score {score}")
            else:
                print(f"  [SKIP] Score {score} -- below threshold")
        else:
            print(f"  [SKIP] Grok unavailable")
        time.sleep(0.3)  # rate limit protection
    return scored


def save_to_supabase(articles: list[dict]) -> int:
    """Upsert scored articles to Supabase daily_routine_news table."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[news-engine] ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set", file=sys.stderr)
        return 0

    rows = []
    for a in articles:
        rows.append({
            "article_id": a["article_id"],
            "title": a["title"],
            "summary": a.get("summary", ""),
            "url": a["url"],
            "source": a["source"],
            "published_at": a.get("published_at"),
            "impact_score": a.get("impact_score", 0),
            "is_routine_impact": a.get("is_routine_impact", False),
            "key_routine_effects": a.get("key_routine_effects", []),
            "ai_summary": a.get("ai_summary", ""),
            "post_worthy": a.get("post_worthy", False),
            "scored_at": a.get("scored_at"),
        })

    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/daily_routine_news?on_conflict=article_id",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates",
            },
            json=rows,
            timeout=30,
        )
        resp.raise_for_status()
        print(f"[news-engine] Saved {len(rows)} articles to Supabase")
        return len(rows)
    except Exception as e:
        print(f"[news-engine] Supabase save error: {e}", file=sys.stderr)
        if hasattr(e, "response") and e.response is not None:
            print(f"  Response body: {e.response.text[:500]}", file=sys.stderr)
        return 0


def run_daily_digest(dry_run: bool = False) -> None:
    print(f"[news-engine] Starting daily digest — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")

    # Step 1: Fetch from all sources
    articles: list[dict] = []
    for name, url in RSS_FEEDS:
        articles += fetch_rss(name, url)
    articles += fetch_newsdata()

    before_dedup = len(articles)
    articles = deduplicate(articles)
    print(f"[news-engine] Total fetched: {before_dedup} | After dedup: {len(articles)}")

    # Step 2: AI scoring
    scored = score_articles(articles)
    print(f"[news-engine] Scored above threshold ({MIN_IMPACT_SCORE}): {len(scored)}")

    if dry_run:
        print("\n[news-engine] DRY RUN -- not saving to Supabase\n")
        for a in sorted(scored, key=lambda x: x.get("impact_score", 0), reverse=True):
            print(f"  [{a['impact_score']:3d}] {a['title'][:80]}")
            if a.get("ai_summary"):
                print(f"        → {a['ai_summary']}")
        return

    # Step 3: Persist
    saved = save_to_supabase(scored)
    print(f"[news-engine] Done — {saved} articles saved to Supabase")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OFFO Daily Routine Impact News Engine")
    parser.add_argument("--dry-run", action="store_true", help="Score and print without saving to Supabase")
    args = parser.parse_args()
    run_daily_digest(dry_run=args.dry_run)
