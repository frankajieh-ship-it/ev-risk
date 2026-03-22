"""
One-time import script: loads Comment Insights CSV into reddit_comment_examples table.

Usage:
    python import_comments.py path/to/comment_insights.csv [--subreddit r/ElectricVehicles]

The script auto-classifies intent_tag from the post title using simple keyword matching.
If the CSV already has an 'intent_tag' column it will use that instead.

Expected CSV columns (from Reddit Comment Insights export):
    Date, Post Name, Total Views, Upvote Rate, Reply Count, Total Shares, Comment Published Date
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

TITLE_INTENT_MAP = [
    (["vs", "versus", "compare", "or ", "between", "which"], "comparison"),
    (["vin", "carfax", "listing", "dealer", "for sale", "good deal", "bad deal", "worth it", "should i buy this", "is this"], "listing_evaluation"),
    (["no home", "apartment", "no garage", "street parking", "public charg"], "charging_question"),
    (["battery", "degradation", "soh", "range loss", "battery health"], "battery_concern"),
    (["first ev", "first time", "buying my first", "new to ev", "thinking of getting", "looking for"], "purchase_advice"),
    (["winter", "cold", "snow", "freeze"], "purchase_advice"),
    (["charge", "charger", "charging", "level 2", "dcfc", "supercharg"], "charging_question"),
    (["routine", "fit check", "how important"], "purchase_advice"),
]


def infer_intent(title: str) -> str:
    t = title.lower()
    for keywords, intent in TITLE_INTENT_MAP:
        if any(kw in t for kw in keywords):
            return intent
    return "purchase_advice"


def parse_date(raw: str) -> str | None:
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(raw.strip(), fmt).date().isoformat()
        except ValueError:
            continue
    return None


def main():
    parser = argparse.ArgumentParser(description="Import Comment Insights CSV to Supabase")
    parser.add_argument("csv_file", help="Path to the Comment Insights CSV file")
    parser.add_argument("--subreddit", default=None, help="Subreddit name (e.g. r/ElectricVehicles)")
    parser.add_argument("--dry-run", action="store_true", help="Print rows without inserting")
    args = parser.parse_args()

    csv_path = Path(args.csv_file)
    if not csv_path.exists():
        print(f"ERROR: File not found: {csv_path}")
        sys.exit(1)

    # Load Supabase client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
        sys.exit(1)

    if not args.dry_run:
        from supabase import create_client
        sb = create_client(url, key)

    rows = []
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Map CSV columns → table columns
            post_title = (row.get("Post Name") or "").strip()
            if not post_title:
                continue

            # Skip rows with zero views AND upvote_rate < 0.5 (low-signal rows)
            try:
                views = int(row.get("Total Views") or 0)
                upvote_rate = float(row.get("Upvote Rate") or 1.0)
                reply_count = int(row.get("Reply Count") or 0)
            except (ValueError, TypeError):
                views, upvote_rate, reply_count = 0, 1.0, 0

            if views == 0 and upvote_rate < 0.5:
                continue

            # Build a synthetic successful_reply placeholder from post_title
            # (The CSV has no reply body column — real replies should be filled in manually or via
            # a subsequent Reddit API fetch. For now we store the post title as a reference anchor.)
            successful_reply = row.get("successful_reply") or f"[reply for: {post_title}]"

            intent_tag = row.get("intent_tag") or infer_intent(post_title)

            comment_date = parse_date(row.get("Comment Published Date") or "")

            record = {
                "post_title": post_title[:500],
                "post_body": None,
                "successful_reply": successful_reply[:2000],
                "upvotes": views,          # using views as proxy since upvote count not in CSV
                "upvote_rate": round(upvote_rate, 4),
                "reply_count": reply_count,
                "comment_date": comment_date,
                "intent_tag": intent_tag,
                "subreddit": args.subreddit,
            }
            rows.append(record)

    print(f"Parsed {len(rows)} rows from {csv_path.name}")

    if args.dry_run:
        for r in rows[:10]:
            print(r)
        print("--- dry run, nothing inserted ---")
        return

    # Batch insert in chunks of 100
    chunk_size = 100
    inserted = 0
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i:i + chunk_size]
        try:
            sb.table("reddit_comment_examples").insert(chunk).execute()
            inserted += len(chunk)
            print(f"  Inserted {inserted}/{len(rows)}...")
        except Exception as e:
            print(f"  ERROR on chunk {i}: {e}")

    print(f"Done. {inserted} rows inserted into reddit_comment_examples.")


if __name__ == "__main__":
    main()
