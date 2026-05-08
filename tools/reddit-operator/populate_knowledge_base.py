"""
OFFO Knowledge Base — Pre-population Script

Reads from three Supabase sources and upserts into offo_knowledge_base:
  1. receipts          — last 90 days, generation_status='full', not internal
  2. daily_routine_news — last 30 days, impact_score >= 65
  3. reddit_operator_sessions — last 30 days, outcome='posted'

Run once after deploying migration-offo-knowledge-base.sql:
    python populate_knowledge_base.py

Then each service maintains its own rows going forward via upsert_knowledge_base().
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")

from supabase import create_client
sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def cutoff(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def upsert_batch(rows: list[dict]) -> int:
    if not rows:
        return 0
    sb.table("offo_knowledge_base").upsert(
        rows, on_conflict="source,source_id"
    ).execute()
    return len(rows)


# ---------------------------------------------------------------------------
# 1. Receipts (last 90 days, full, not internal)
# ---------------------------------------------------------------------------

def populate_receipts() -> int:
    print("[receipts] Fetching...")
    result = (
        sb.table("receipts")
        .select(
            "id, created_at, listing_url, url_domain,"
            " output_json, is_internal, is_pro"
        )
        .eq("generation_status", "full")
        .gte("created_at", cutoff(90))
        .neq("is_internal", True)
        .order("created_at", desc=True)
        .limit(2000)
        .execute()
    )
    rows_raw = result.data or []
    print(f"[receipts] {len(rows_raw)} rows fetched")

    kb_rows = []
    for r in rows_raw:
        out = r.get("output_json") or {}
        ls = out.get("listing_summary") or {}
        verdict = out.get("verdict")
        fit_score = out.get("fit_score")

        make = ls.get("make")
        model = ls.get("model")
        year_val = ls.get("year")
        price = ls.get("price")
        mileage = ls.get("mileage")

        # Build a short human-readable summary
        label_parts = []
        if year_val:
            label_parts.append(str(year_val))
        if make:
            label_parts.append(make)
        if model:
            label_parts.append(model)
        vehicle = " ".join(label_parts) or "EV"

        price_label = (out.get("price_sanity") or {}).get("label", "")
        summary = f"{vehicle}: {verdict} verdict, fit score {fit_score}"
        if price:
            summary += f", ${price:,}"
        if mileage:
            summary += f", {mileage:,} mi"
        if price_label:
            summary += f", price {price_label}"

        # Post-worthy: clear verdicts with decent evidence
        evidence_score = out.get("evidence_score") or 0
        post_worthy = bool(
            verdict in ("GREEN", "RED")
            and (fit_score or 0) >= 65
            and evidence_score >= 40
        )

        kb_rows.append({
            "source": "receipt",
            "source_id": str(r["id"]),
            "created_at": r["created_at"],
            "make": make,
            "model": model,
            "year": year_val,
            "verdict": verdict,
            "score": fit_score,
            "summary": summary,
            "tags": [],
            "url": r.get("listing_url"),
            "post_worthy": post_worthy,
        })

    count = upsert_batch(kb_rows)
    post_worthy_count = sum(1 for r in kb_rows if r["post_worthy"])
    print(f"[receipts] Upserted {count} rows ({post_worthy_count} post-worthy)")
    return count


# ---------------------------------------------------------------------------
# 2. News articles (last 30 days, impact_score >= 65)
# ---------------------------------------------------------------------------

def populate_news() -> int:
    print("[news] Fetching...")
    result = (
        sb.table("daily_routine_news")
        .select(
            "article_id, scored_at, title, url, source, impact_score,"
            " category, ai_summary, key_routine_effects, post_worthy"
        )
        .gte("scored_at", cutoff(30))
        .gte("impact_score", 65)
        .order("impact_score", desc=True)
        .limit(1000)
        .execute()
    )
    rows_raw = result.data or []
    print(f"[news] {len(rows_raw)} rows fetched")

    kb_rows = []
    for r in rows_raw:
        kb_rows.append({
            "source": "news",
            "source_id": r["article_id"],
            "created_at": r.get("scored_at"),
            "make": None,
            "model": None,
            "year": None,
            "verdict": r.get("category"),
            "score": r.get("impact_score"),
            "summary": r.get("ai_summary") or r.get("title"),
            "tags": r.get("key_routine_effects") or [],
            "url": r.get("url"),
            "post_worthy": bool(r.get("post_worthy")),
        })

    count = upsert_batch(kb_rows)
    post_worthy_count = sum(1 for r in kb_rows if r["post_worthy"])
    print(f"[news] Upserted {count} rows ({post_worthy_count} post-worthy)")
    return count


# ---------------------------------------------------------------------------
# 3. Reddit sessions (last 30 days, outcome='posted')
# ---------------------------------------------------------------------------

def populate_reddit_sessions() -> int:
    print("[reddit_sessions] Fetching...")
    result = (
        sb.table("reddit_operator_sessions")
        .select(
            "id, created_at, subreddit, post_title, intent,"
            " friction_tags, draft_reply_short, reddit_post_url"
        )
        .in_("posted_outcome", ["posted", "edited"])
        .gte("created_at", cutoff(30))
        .order("created_at", desc=True)
        .limit(500)
        .execute()
    )
    rows_raw = result.data or []
    print(f"[reddit_sessions] {len(rows_raw)} rows fetched")

    kb_rows = []
    for r in rows_raw:
        title = r.get("post_title") or ""
        summary = f"r/{r.get('subreddit') or 'EV'}: {title[:120]}"
        if r.get("intent"):
            summary += f" [{r['intent']}]"

        kb_rows.append({
            "source": "reddit_session",
            "source_id": str(r["id"]),
            "created_at": r["created_at"],
            "make": None,
            "model": None,
            "year": None,
            "verdict": r.get("intent"),
            "score": None,
            "summary": summary,
            "tags": r.get("friction_tags") or [],
            "url": r.get("reddit_post_url"),
            "post_worthy": True,  # posted sessions are inherently post-worthy
        })

    count = upsert_batch(kb_rows)
    print(f"[reddit_sessions] Upserted {count} rows")
    return count


# ---------------------------------------------------------------------------
# 4. Historical Reddit CSV import
# ---------------------------------------------------------------------------

def populate_reddit_csv(csv_path: str) -> int:
    """
    Import historical Reddit posts from a CSV export into offo_knowledge_base.

    Expected columns (any order, extra columns ignored):
      id / post_id         — Reddit post ID (used as source_id)
      title                — Post title
      selftext / body      — Post body text
      subreddit            — Subreddit name (without r/)
      score / upvotes      — Reddit score (upvotes)
      url / permalink      — Link to post
      created_utc / date   — Unix timestamp or ISO date string

    Posts are imported with source='reddit_session' and post_worthy=TRUE.
    Existing rows (same source_id) are skipped via UPSERT on_conflict.
    """
    import csv
    from datetime import datetime, timezone

    print(f"[reddit_csv] Reading {csv_path}...")
    kb_rows = []
    skipped = 0

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        # Normalise header names to lowercase with underscores
        for raw_row in reader:
            row = {k.strip().lower().replace(" ", "_"): v for k, v in raw_row.items()}

            # Resolve post ID
            post_id = row.get("id") or row.get("post_id") or row.get("reddit_id")
            if not post_id:
                skipped += 1
                continue

            # Resolve title / body
            title = row.get("title") or ""
            body = row.get("selftext") or row.get("body") or ""
            subreddit = row.get("subreddit", "").lstrip("r/")

            # Resolve score
            score_raw = row.get("score") or row.get("upvotes") or row.get("ups") or "0"
            try:
                score = int(float(str(score_raw).replace(",", "")))
            except (ValueError, TypeError):
                score = 0

            # Resolve URL
            url = row.get("url") or row.get("permalink") or row.get("full_link")
            if url and url.startswith("/r/"):
                url = f"https://www.reddit.com{url}"

            # Resolve created_at
            created_raw = row.get("created_utc") or row.get("date") or row.get("created") or ""
            try:
                ts = float(created_raw)
                created_at = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
            except (ValueError, TypeError):
                # Try ISO string
                try:
                    created_at = datetime.fromisoformat(str(created_raw).replace("Z", "+00:00")).isoformat()
                except (ValueError, TypeError):
                    created_at = None

            summary = f"r/{subreddit}: {title[:120]}" if subreddit else title[:120]
            if body:
                summary += f" — {body[:100].strip()}"

            kb_rows.append({
                "source": "reddit_session",
                "source_id": f"csv_{post_id}",
                "created_at": created_at,
                "make": None,
                "model": None,
                "year": None,
                "verdict": None,
                "score": score,
                "summary": summary,
                "tags": [],
                "url": url,
                "post_worthy": True,
            })

    print(f"[reddit_csv] {len(kb_rows)} posts parsed, {skipped} skipped (missing id)")
    count = upsert_batch(kb_rows)
    print(f"[reddit_csv] Upserted {count} rows")
    return count


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Populate OFFO knowledge base")
    parser.add_argument(
        "--csv",
        metavar="PATH",
        help="Path to Reddit CSV export to import as historical posts",
    )
    parser.add_argument(
        "--csv-only",
        action="store_true",
        help="Only run CSV import (skip receipts/news/sessions)",
    )
    args = parser.parse_args()

    total = 0

    if not args.csv_only:
        total += populate_receipts()
        total += populate_news()
        total += populate_reddit_sessions()

    if args.csv:
        total += populate_reddit_csv(args.csv)

    print(f"\nDone. Total rows upserted: {total}")
