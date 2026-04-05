"""
OFFO Reddit Scanner — standalone PRAW process.

Scans target subreddits every 5 minutes for buying-intent posts,
qualifies them with the QualificationEngine, and POSTs qualifying
posts to the FastAPI /reddit/scan endpoint for full pipeline processing.

Run separately from the FastAPI server:
    python reddit_scanner.py

Optional flags:
    --dry-run    Print qualifying posts without POSTing to the API
    --once       Scan once and exit (useful for testing)
    --interval N Override the 300s scan interval (seconds)
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from qualification_engine import qualify_post  # noqa: E402 — after dotenv

# -------------------------
# Config
# -------------------------

SUBREDDITS = [
    "electricvehicles",
    "electriccars",
    "whatcarshouldIbuy",
    "askcarsales",
]

SEEN_IDS_FILE = Path(__file__).parent / ".seen_post_ids.txt"
API_BASE = os.getenv("REDDIT_OPERATOR_URL", "http://localhost:8088")
DEFAULT_INTERVAL = 300  # seconds between scans


# -------------------------
# Seen-ID persistence
# -------------------------

def load_seen_ids() -> set:
    if SEEN_IDS_FILE.exists():
        return set(SEEN_IDS_FILE.read_text().splitlines())
    return set()


def save_seen_id(post_id: str, seen: set) -> None:
    seen.add(post_id)
    # Keep last 5000 IDs to prevent unbounded file growth
    ids = list(seen)[-5000:]
    SEEN_IDS_FILE.write_text("\n".join(ids))


# -------------------------
# Reddit client (lazy init)
# -------------------------

def _build_reddit():
    try:
        import praw
    except ImportError:
        print("ERROR: praw not installed. Run: pip install praw>=7.7.0")
        sys.exit(1)

    client_id = os.getenv("REDDIT_CLIENT_ID")
    client_secret = os.getenv("REDDIT_CLIENT_SECRET")
    user_agent = os.getenv("REDDIT_USER_AGENT", "offo-ev-assistant/1.0")

    if not client_id or not client_secret:
        print(
            "ERROR: REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET must be set.\n"
            "Create a script app at https://www.reddit.com/prefs/apps"
        )
        sys.exit(1)

    return praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=user_agent,
    )


# -------------------------
# Single scan pass
# -------------------------

def scan_once(reddit, dry_run: bool = False) -> dict:
    """
    Scan all configured subreddits once.
    Returns counts: { scanned, qualified, posted, skipped, errors }
    """
    seen = load_seen_ids()
    counts = {"scanned": 0, "qualified": 0, "posted": 0, "skipped": 0, "errors": 0}

    for sub_name in SUBREDDITS:
        try:
            sub = reddit.subreddit(sub_name)
            posts = list(sub.new(limit=50))
        except Exception as e:
            print(f"  [ERROR] Failed to fetch r/{sub_name}: {e}")
            counts["errors"] += 1
            continue

        for post in posts:
            counts["scanned"] += 1

            if post.id in seen:
                continue
            save_seen_id(post.id, seen)

            score = qualify_post(post.title, post.selftext or "", sub_name)

            if not score.should_reply:
                counts["skipped"] += 1
                continue

            counts["qualified"] += 1
            post_url = f"https://reddit.com{post.permalink}"

            if dry_run:
                print(
                    f"  [DRY RUN] Would post: r/{sub_name} score={score.final_score:.2f}\n"
                    f"    Title: {post.title[:80]}\n"
                    f"    URL:   {post_url}"
                )
                counts["posted"] += 1
                continue

            # POST to FastAPI /reddit/scan
            try:
                resp = httpx.post(
                    f"{API_BASE}/reddit/scan",
                    json={
                        "title": post.title,
                        "selftext": post.selftext or "",
                        "subreddit": sub_name,
                        "post_id": post.id,
                        "author": str(post.author) if post.author else None,
                        "url": post_url,
                        "qualification_score": score.final_score,
                    },
                    timeout=45,
                )
                if resp.status_code == 200:
                    counts["posted"] += 1
                    data = resp.json()
                    session_id = data.get("session_id", "")
                    print(
                        f"  [QUEUED] r/{sub_name} score={score.final_score:.2f} "
                        f"session={session_id[:8]}… | {post.title[:60]}"
                    )
                else:
                    print(f"  [WARN] API returned {resp.status_code} for post {post.id}")
                    counts["errors"] += 1
            except httpx.TimeoutException:
                print(f"  [WARN] Timeout posting {post.id} to API — will retry next scan")
                counts["errors"] += 1
            except httpx.RequestError as e:
                print(f"  [ERROR] Could not reach API at {API_BASE}: {e}")
                counts["errors"] += 1

    return counts


# -------------------------
# Entry point
# -------------------------

def main():
    parser = argparse.ArgumentParser(description="OFFO Reddit Scanner")
    parser.add_argument("--dry-run", action="store_true", help="Print qualifying posts without POSTing")
    parser.add_argument("--once", action="store_true", help="Scan once and exit")
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL, help="Seconds between scans")
    args = parser.parse_args()

    subs_display = ", ".join(f"r/{s}" for s in SUBREDDITS)
    print(f"OFFO Reddit Scanner starting")
    print(f"  Subreddits: {subs_display}")
    print(f"  API base:   {API_BASE}")
    print(f"  Interval:   {args.interval}s")
    if args.dry_run:
        print("  Mode:       DRY RUN (no API calls)")
    print()

    reddit = _build_reddit()

    while True:
        print(f"[{time.strftime('%H:%M:%S')}] Scanning...")
        try:
            counts = scan_once(reddit, dry_run=args.dry_run)
            print(
                f"  Done — scanned={counts['scanned']} qualified={counts['qualified']} "
                f"posted={counts['posted']} skipped={counts['skipped']} errors={counts['errors']}"
            )
        except Exception as e:
            print(f"  [ERROR] Scan failed: {e}")

        if args.once:
            break

        print(f"  Next scan in {args.interval}s...\n")
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
