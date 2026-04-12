"""
OFFO News Engine — Multi-Category Edition

Daily pipeline:
  1. Fetch articles from RSS feeds across 4 categories
  2. Grok classifier scores each for impact + assigns category
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
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GROK_API_KEY = os.getenv("GROK_API_KEY")
NEWSDATA_API_KEY = os.getenv("NEWSDATA_API_KEY")

# Per-category minimum score thresholds
MIN_SCORE_BY_CATEGORY = {
    "recall": 50,           # recalls always matter even if low scored
    "routine_impact": 65,
    "used_market": 55,      # lowered — used EV content is sparse, cast wider net
    "charging_network": 60,
}

# RSS feeds organised by category hint (classifier may override)
RSS_FEEDS = [
    # ── Routine impact ──────────────────────────────────────────────────
    ("Electrek",          "https://electrek.co/feed/",                   "routine_impact"),
    ("InsideEVs",         "https://insideevs.com/feed/",                 "routine_impact"),
    ("Green Car Reports", "https://www.greencarreports.com/rss",         "routine_impact"),
    ("Electrive",         "https://www.electrive.com/feed/",             "routine_impact"),
    ("EV Magazine",       "https://evmagazine.com/feed/",                "routine_impact"),

    # ── Recalls ─────────────────────────────────────────────────────────
    ("Electrek Recalls",  "https://electrek.co/tag/recall/feed/",        "recall"),
    ("InsideEVs Recalls", "https://insideevs.com/tag/recall/feed/",      "recall"),
    ("NHTSA Recalls",     "https://www.nhtsa.gov/rss/recalls.xml",       "recall"),

    # ── Used EV market ───────────────────────────────────────────────────
    # Cox Automotive / Manheim: best source for used vehicle value index,
    # EV depreciation trends, off-lease volume, and wholesale market data
    ("Cox Automotive",    "https://www.coxautoinc.com/market-insights/feed/", "used_market"),
    # CarEdge: dealer-focused used car pricing and market analysis
    ("CarEdge",           "https://caredge.com/feed",                    "used_market"),
    # Car and Driver buying advice: CPO, depreciation, best used EVs
    ("Car and Driver",    "https://www.caranddriver.com/rss/all.xml/",   "used_market"),
    # Electrek used EV tag: used EV deals, prices, CPO announcements
    ("Electrek Used EV",  "https://electrek.co/tag/used-electric-vehicle/feed/", "used_market"),
    # InsideEVs used cars tag
    ("InsideEVs Used",    "https://insideevs.com/tag/used-cars/feed/",   "used_market"),

    # ── Charging network ─────────────────────────────────────────────────
    ("PlugShare Blog",    "https://blog.plugshare.com/feed/",            "charging_network"),
    ("ChargePoint",       "https://www.chargepoint.com/feed/",           "charging_network"),
    ("Electrek Charging", "https://electrek.co/tag/ev-charging/feed/",   "charging_network"),
]

# EV makes to query NHTSA API for recent recalls (supplements RSS)
NHTSA_EV_MAKES = [
    ("Tesla",      ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"]),
    ("Rivian",     ["R1T", "R1S"]),
    ("Chevrolet",  ["Bolt EV", "Bolt EUV", "Equinox EV", "Silverado EV"]),
    ("Ford",       ["Mustang Mach-E", "F-150 Lightning"]),
    ("Hyundai",    ["Ioniq 5", "Ioniq 6", "Kona Electric"]),
    ("Kia",        ["EV6", "EV9", "Niro EV"]),
    ("BMW",        ["i4", "iX", "i5"]),
    ("Volkswagen", ["ID.4"]),
    ("Nissan",     ["Leaf", "Ariya"]),
    ("Audi",       ["e-tron", "Q4 e-tron"]),
]

GROK_CLASSIFIER_SYSTEM = """You are classifying EV news articles into exactly one of four categories. Read the category rules carefully — most articles will NOT be "routine_impact".

STEP 1 — Assign a category using these STRICT rules (first match wins):

  "recall" — Use this if the article mentions ANY of: NHTSA recall, safety defect, fire risk, OTA fix for a safety issue, lawsuit over vehicle defects, battery defect notice. Examples: "Nissan recalls LEAF", "GM faces lawsuit over Lyriq defects", "Tesla OTA update fixes brake issue".

  "charging_network" — Use this if the article is primarily about EV charging infrastructure, networks, or stations: charger reliability studies, network expansions, new charging partnerships, charger pricing changes, outages, Tesla Supercharger access for other brands, charging success rates, off-grid chargers, number of public chargers. Examples: "BMW integrates Tesla Superchargers", "Study: Tesla Rivian networks most reliable", "California has more chargers than gas nozzles", "GM-Pilot charging network expands", "Free off-grid fast chargers".

  "used_market" — Use this if the article is primarily about used/pre-owned EV pricing, depreciation, CPO programs, auction results, trade-in values, residual value trends, off-lease EV volume, wholesale market data, Manheim index, battery health reports for used EVs, or EV resale value impacts. Examples: "Used EV prices drop 30%", "Best CPO electric cars 2025", "EV depreciation study", "Manheim Used Vehicle Value Index", "500,000 off-lease EVs hitting market", "EV sales data affecting resale".

  "routine_impact" — Use this ONLY if the article does not fit the above three categories AND it affects daily EV ownership: battery health/degradation, real-world range data, home charging costs, winter range, efficiency data, fuel savings comparisons, infrastructure changes not related to charging networks.

STEP 2 — Score how directly it affects real EV owner daily routines (0-100):
Score LOW (< 50) for:
- Pure spec announcements for future cars not yet on sale
- Company financials, stock prices, factory news without ownership impact
- Brand wars or pure opinion pieces
- Regulatory/political stories with no direct ownership consequence

Score HIGH (>= 60) for:
- Recalls affecting battery, charging port, or software
- Charging network outages, expansions, or reliability changes
- Real-world range or efficiency data from actual use
- Battery degradation findings from real-world fleet data
- Used EV price movements, depreciation data, or off-lease volume (affects buyers directly)
- Manheim/wholesale index reports showing used EV value trends
- Home charging or public charging infrastructure changes
- EV sales data that directly impacts used market supply/demand

STEP 3 — List key routine effects (choose from):
  charging, winter, battery_daily_use, recall, infrastructure, range, cost, software, used_pricing, depreciation, network_reliability

Output ONLY valid JSON (no markdown, no explanation):
{
  "category": "recall" | "used_market" | "charging_network" | "routine_impact",
  "is_routine_impact": true or false,
  "impact_score": 0-100,
  "key_routine_effects": ["charging", "recall", ...],
  "one_sentence_summary": "One sentence: how this specifically affects an EV owner.",
  "post_worthy": true or false,
  "reasoning": "One sentence explaining the score and category."
}"""


def _grok_classify(title: str, summary: str) -> Optional[dict]:
    """Call Grok to score and categorize a single article."""
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
                "max_tokens": 350,
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


def fetch_rss(feed_name: str, feed_url: str, feed_category: str) -> list[dict]:
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
                    "feed_category_hint": feed_category,  # hint for classifier, may be overridden
                    "published_at": published[:30] if published else None,
                })
        print(f"[news-engine] {feed_name}: {len(articles)} articles fetched")
    except Exception as e:
        print(f"[news-engine] RSS error ({feed_name}): {e}", file=sys.stderr)
    return articles


def _fetch_nhtsa_single(make: str, model: str, year: int) -> list[dict]:
    """Fetch recalls for one make/model/year combination. Used by thread pool."""
    try:
        resp = requests.get(
            "https://api.nhtsa.gov/recalls/recallsByVehicle",
            params={"make": make, "model": model, "modelYear": str(year)},
            timeout=8,
        )
        if resp.status_code != 200:
            return []
        results = resp.json().get("results") or []
        articles = []
        for rec in results:
            campaign = rec.get("NHTSACampaignNumber", "")
            if not campaign:
                continue
            summary = rec.get("Summary") or rec.get("Consequence") or ""
            remedy = rec.get("Remedy") or ""
            component = rec.get("Component") or ""
            report_date = rec.get("ReportReceivedDate") or ""
            title = f"{make} {model} recall: {component} (NHTSA {campaign})"
            full_summary = f"{summary} Remedy: {remedy}".strip()
            url = f"https://www.nhtsa.gov/vehicle-safety/recalls?nhtsaId={campaign}"
            articles.append({
                "article_id": _article_id(f"nhtsa-{campaign}"),
                "title": title[:500],
                "summary": full_summary[:1000],
                "url": url,
                "source": "NHTSA API",
                "feed_category_hint": "recall",
                "published_at": report_date[:30] if report_date else None,
                "_campaign": campaign,  # for dedup across threads
            })
        return articles
    except Exception as e:
        print(f"[news-engine] NHTSA API error ({make} {model} {year}): {e}", file=sys.stderr)
        return []


def fetch_nhtsa_recalls() -> list[dict]:
    """
    Pull recent recalls from the NHTSA API for all major EV makes/models.
    Uses a thread pool for parallel fetches to stay well within the 15-min CI timeout.
    Only queries current year + prior year (2 years) — the RSS feed covers older recalls.
    """
    current_year = datetime.now(timezone.utc).year
    # Build list of (make, model, year) tasks — current + prior year only
    tasks = [
        (make, model, year)
        for make, models in NHTSA_EV_MAKES
        for model in models
        for year in [current_year, current_year - 1]
    ]

    raw_articles: list[dict] = []
    # 10 workers — NHTSA API is public, no auth, tolerates moderate concurrency
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {pool.submit(_fetch_nhtsa_single, make, model, year): (make, model, year)
                   for make, model, year in tasks}
        for future in as_completed(futures):
            raw_articles.extend(future.result())

    # Deduplicate by campaign number (same recall may appear across model years)
    seen_campaigns: set[str] = set()
    articles = []
    for a in raw_articles:
        campaign = a.pop("_campaign", "")
        if campaign and campaign not in seen_campaigns:
            seen_campaigns.add(campaign)
            articles.append(a)

    print(f"[news-engine] NHTSA API: {len(articles)} recall records fetched ({len(tasks)} requests parallelized)")
    return articles


def fetch_newsdata(query: str = "electric vehicle EV charging recall used market", limit: int = 10) -> list[dict]:
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
                "size": min(limit, 10),
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
                    "feed_category_hint": "routine_impact",
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


# Keyword overrides — applied after Grok scoring to correct systematic misclassification.
# Grok-3-mini consistently calls charging infrastructure articles "routine_impact".
_CHARGING_NETWORK_KEYWORDS = [
    "supercharger", "charging network", "charging station", "fast charger", "dcfc",
    "ev charger", "charging infrastructure", "charging point", "plugshare", "chargepoint",
    "electrify america", "blink charging", "evgo", "charging reliability", "charging success",
    "charging outage", "charger availability", "public charger", "charging expansion",
]
_RECALL_KEYWORDS = [
    "recall", "nhtsa", "safety defect", "fire risk", "lawsuit over", "battery defect",
    "ota fix", "safety issue", "safety investigation",
]
_USED_MARKET_KEYWORDS = [
    "used ev", "used electric", "pre-owned", "cpo ", "depreciation", "resale value",
    "trade-in value", "residual value", "auction result", "used car price",
    "off-lease", "off lease", "wholesale", "manheim", "vehicle value index",
    "used vehicle", "certified pre", "second-hand ev", "secondhand ev",
    "ev prices drop", "ev prices fall", "ev price", "used market",
    "battery health report", "recurrent", "fleet ev", "fleet electric",
]


def _keyword_override_category(title: str, summary: str, grok_category: str) -> str:
    """Override Grok category when strong keyword signals are present."""
    text = (title + " " + summary).lower()
    # Only override if Grok returned routine_impact (Grok rarely mis-IDs recall/used_market)
    if grok_category != "routine_impact":
        return grok_category
    if any(kw in text for kw in _RECALL_KEYWORDS):
        return "recall"
    if any(kw in text for kw in _CHARGING_NETWORK_KEYWORDS):
        return "charging_network"
    if any(kw in text for kw in _USED_MARKET_KEYWORDS):
        return "used_market"
    return grok_category


def score_articles(articles: list[dict]) -> list[dict]:
    """
    Run Grok classifier on each article.
    Applies per-category minimum score thresholds.
    Articles that fail scoring are dropped (not saved).
    """
    scored = []
    for i, article in enumerate(articles):
        print(f"[news-engine] Scoring {i+1}/{len(articles)}: {article['title'][:60]}...")
        result = _grok_classify(article["title"], article["summary"])
        if result:
            score = int(result.get("impact_score", 0))
            # Classifier category takes precedence over feed hint
            category = result.get("category") or article.get("feed_category_hint", "routine_impact")
            # Validate category value
            valid_cats = {"routine_impact", "recall", "used_market", "charging_network"}
            if category not in valid_cats:
                category = article.get("feed_category_hint", "routine_impact")
            # Keyword override — corrects systematic Grok misclassification
            category = _keyword_override_category(article["title"], article.get("summary", ""), category)

            min_score = MIN_SCORE_BY_CATEGORY.get(category, 65)
            if score >= min_score:
                article["impact_score"] = score
                article["category"] = category
                article["is_routine_impact"] = bool(result.get("is_routine_impact", False))
                article["key_routine_effects"] = result.get("key_routine_effects") or []
                article["ai_summary"] = result.get("one_sentence_summary") or ""
                article["post_worthy"] = bool(result.get("post_worthy", False))
                article["scored_at"] = datetime.now(timezone.utc).isoformat()
                scored.append(article)
                print(f"  [KEPT] Score {score} | Category: {category}")
            else:
                print(f"  [SKIP] Score {score} < threshold {min_score} for {category}")
        else:
            print(f"  [SKIP] Grok unavailable")
        time.sleep(0.3)  # rate limit protection
    return scored


def fetch_existing_article_ids() -> set[str]:
    """Fetch article_ids already stored in Supabase (last 14 days) to skip re-scoring."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return set()
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/daily_routine_news",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Range": "0-999",
            },
            params={
                "select": "article_id",
                "scored_at": f"gte.{(datetime.now(timezone.utc).replace(hour=0, minute=0, second=0).isoformat()[:10] + 'T00:00:00Z')}",
            },
            timeout=10,
        )
        if resp.status_code == 200:
            ids = {row["article_id"] for row in resp.json()}
            print(f"[news-engine] Found {len(ids)} articles already in Supabase today — will skip re-scoring")
            return ids
    except Exception as e:
        print(f"[news-engine] Could not fetch existing article IDs: {e}", file=sys.stderr)
    return set()


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
            "category": a.get("category", "routine_impact"),
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
    for name, url, category in RSS_FEEDS:
        articles += fetch_rss(name, url, category)
    articles += fetch_nhtsa_recalls()
    articles += fetch_newsdata()

    before_dedup = len(articles)
    articles = deduplicate(articles)
    print(f"[news-engine] Total fetched: {before_dedup} | After dedup: {len(articles)}")

    # Skip articles already stored in Supabase today (avoids re-scoring on manual re-runs)
    if not dry_run:
        existing_ids = fetch_existing_article_ids()
        if existing_ids:
            articles = [a for a in articles if a["article_id"] not in existing_ids]
            print(f"[news-engine] After skipping already-stored: {len(articles)} to score")

    # Step 2: AI scoring + categorization
    scored = score_articles(articles)
    print(f"[news-engine] Scored above threshold: {len(scored)}")

    # Print per-category breakdown
    from collections import Counter
    cats = Counter(a.get("category", "routine_impact") for a in scored)
    for cat, count in sorted(cats.items()):
        print(f"  {cat}: {count}")

    if dry_run:
        print("\n[news-engine] DRY RUN -- not saving to Supabase\n")
        for a in sorted(scored, key=lambda x: x.get("impact_score", 0), reverse=True):
            print(f"  [{a['impact_score']:3d}] [{a.get('category','?'):17s}] {a['title'][:70]}")
            if a.get("ai_summary"):
                print(f"        → {a['ai_summary']}")
        return

    # Step 3: Persist
    saved = save_to_supabase(scored)
    print(f"[news-engine] Done — {saved} articles saved to Supabase")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OFFO Multi-Category News Engine")
    parser.add_argument("--dry-run", action="store_true", help="Score and print without saving to Supabase")
    args = parser.parse_args()
    run_daily_digest(dry_run=args.dry_run)
