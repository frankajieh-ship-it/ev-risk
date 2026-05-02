"""
OFFO Outcome Tracker — fetches upvote/reply counts for posted Reddit sessions.

Queries Supabase for sessions marked posted/edited, fetches the parent post's
current score and comment count via PRAW, and writes them back to Supabase.

Tracks the parent post (not individual comment) as a proxy for thread engagement,
since we don't store the comment ID — just the post URL/ID.

Run manually or on a schedule (e.g. hourly cron):
    python outcome_tracker.py           # loop every hour
    python outcome_tracker.py --once    # single pass, then exit
    python outcome_tracker.py --limit 50
    python outcome_tracker.py --interval 1800  # every 30 min
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import datetime
from db import get_posted_sessions_db, save_posted_outcome, save_comments  # noqa: E402

DEFAULT_INTERVAL = 3600  # 1 hour


# -------------------------
# Reddit client (lazy)
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
            "ERROR: REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET must be set in .env\n"
            "Create a script app at https://www.reddit.com/prefs/apps"
        )
        sys.exit(1)

    return praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=user_agent,
    )


# -------------------------
# Post ID extraction
# -------------------------

def _extract_post_id(session: dict) -> str | None:
    """
    Get Reddit post ID from session.
    Tries reddit_post_id first, then parses from reddit_post_url.
    URL format: https://reddit.com/r/{sub}/comments/{id}/...
    """
    post_id = session.get("reddit_post_id")
    if post_id:
        return post_id

    url = session.get("reddit_post_url") or ""
    match = re.search(r"/comments/([a-z0-9]+)/", url, re.IGNORECASE)
    if match:
        return match.group(1)

    return None


# -------------------------
# Single tracking pass
# -------------------------

def track_once(reddit, limit: int = 100) -> dict:
    """
    Fetch upvote/reply counts for all posted sessions and write back.
    Returns counts: { checked, updated, skipped, errors }
    """
    sessions = get_posted_sessions_db(limit=limit)
    counts = {"checked": len(sessions), "updated": 0, "skipped": 0, "errors": 0}

    if not sessions:
        print("  No posted sessions with reddit_post_url found.")
        return counts

    for s in sessions:
        session_id = s.get("id", "")
        subreddit = s.get("subreddit") or "?"
        post_title = (s.get("post_title") or "")[:50]
        outcome = s.get("posted_outcome", "posted")
        post_id = _extract_post_id(s)

        if not post_id:
            print(f"  [SKIP] {session_id[:8]}… — no post ID extractable")
            counts["skipped"] += 1
            continue

        try:
            submission = reddit.submission(id=post_id)
            score = submission.score
            num_comments = submission.num_comments

            save_posted_outcome(session_id, outcome, upvotes=score, reply_count=num_comments)
            print(
                f"  [OK] {session_id[:8]}… r/{subreddit} "
                f"score={score:+d} comments={num_comments} | {post_title}"
            )
            counts["updated"] += 1

            # Scrape and store top-level comments for this post
            try:
                submission.comments.replace_more(limit=0)
                op_name = submission.author.name if submission.author else None
                comment_rows = []
                for c in submission.comments.list()[:20]:
                    if not hasattr(c, "body") or c.body in ("[deleted]", "[removed]"):
                        continue
                    is_reply_to_op = (
                        op_name is not None
                        and getattr(c, "parent_id", "").startswith("t1_")
                    )
                    comment_rows.append({
                        "comment_id": c.id,
                        "author": c.author.name if c.author else "[deleted]",
                        "body": c.body[:2000],
                        "score": c.score,
                        "depth": 0,
                        "is_reply_to_op": is_reply_to_op,
                        "created_utc": datetime.datetime.utcfromtimestamp(
                            c.created_utc
                        ).isoformat() + "Z",
                    })
                saved = save_comments(session_id, post_id, comment_rows)
                if saved:
                    print(f"  [COMMENTS] {saved} comments saved for {session_id[:8]}…")
            except Exception as ce:
                print(f"  [WARN] comment fetch failed for {session_id[:8]}…: {ce}")

        except Exception as e:
            err_str = str(e)
            if "404" in err_str or "NotFound" in err_str or "Forbidden" in err_str:
                print(f"  [GONE] {session_id[:8]}… post deleted/removed — skipping")
                counts["skipped"] += 1
            else:
                print(f"  [ERROR] {session_id[:8]}… {e}")
                counts["errors"] += 1

    return counts


# -------------------------
# Entry point
# -------------------------

def main():
    parser = argparse.ArgumentParser(description="OFFO Outcome Tracker")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    parser.add_argument("--limit", type=int, default=100, help="Max sessions to check per pass")
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL, help="Seconds between passes")
    args = parser.parse_args()

    print("OFFO Outcome Tracker starting")
    print(f"  Limit:    {args.limit} sessions per pass")
    print(f"  Interval: {args.interval}s" if not args.once else "  Mode:     single pass")
    print()

    reddit = _build_reddit()

    while True:
        print(f"[{time.strftime('%H:%M:%S')}] Checking posted sessions...")
        try:
            counts = track_once(reddit, limit=args.limit)
            print(
                f"  Done — checked={counts['checked']} updated={counts['updated']} "
                f"skipped={counts['skipped']} errors={counts['errors']}"
            )
        except Exception as e:
            print(f"  [ERROR] Pass failed: {e}")

        if args.once:
            break

        print(f"  Next check in {args.interval}s...\n")
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
