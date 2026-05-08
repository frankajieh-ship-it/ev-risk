"""
OFFO Social Post Generator

Pulls the top post-worthy items from offo_knowledge_base (last 7 days)
and generates 10 posts per platform: Reddit, X/Twitter, LinkedIn, Facebook.

Stores generated posts back into offo_knowledge_base.generated_posts JSONB.

Usage:
    python social_post_generator.py              # generate for this week
    python social_post_generator.py --days 14    # extend lookback window
    python social_post_generator.py --dry-run    # print without saving

FastAPI endpoint: POST /social/generate-weekly
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

GROK_API_KEY = os.getenv("GROK_API_KEY")

# ---------------------------------------------------------------------------
# System prompts per platform
# ---------------------------------------------------------------------------

VOICE_PREAMBLE = """You are OFFO's content writer. OFFO is an EV friction analysis platform at offolab.com.
OFFO voice: calm, analytical, never hype, never evangelical. Like a knowledgeable EV owner helping their community understand what actually matters in daily ownership — charging access, battery behaviour, real-world range, cost realities.

Rules for ALL platforms:
- Focus on how each story or data point affects real daily ownership, not specs or politics
- No hype. No "game changer". No "revolutionary". No "exciting". Just grounded, useful analysis.
- Include offolab.com/receipt or offolab.com/routine at most ONCE across the entire batch of posts (not per post)
- Each post must stand alone — assume the reader hasn't seen the others
"""

PLATFORM_PROMPTS: dict[str, str] = {
    "reddit": VOICE_PREAMBLE + """
Platform: Reddit (r/electricvehicles, r/EVRoutine, r/UsedCars)
Tone: first-person community voice, not a brand, not marketing. Sound like a knowledgeable owner.
Format per post:
  { "title": "...", "body": "...", "subreddit": "r/electricvehicles" }
Body: 80-200 words, conversational, ends with an open question to the community.
Generate exactly 10 posts. Output ONLY valid JSON array, no markdown fences:
[{ "title": "...", "body": "...", "subreddit": "..." }, ...]
""",

    "x": VOICE_PREAMBLE + """
Platform: X (Twitter)
Tone: punchy, data-driven, one clear insight per post. Under 280 chars each.
No hashtag spam (max 1 relevant hashtag per tweet, optional).
Format per post: { "text": "..." }
Generate exactly 10 posts. Output ONLY valid JSON array, no markdown fences:
[{ "text": "..." }, ...]
""",

    "linkedin": VOICE_PREAMBLE + """
Platform: LinkedIn
Tone: professional insight framing. Owner/buyer/industry perspective. 3-5 short paragraphs.
Audience: EV-curious professionals, fleet managers, sustainable commuters.
Start with a concrete observation or data point, not a question.
Format per post: { "text": "..." }
Length: 120-250 words per post.
Generate exactly 10 posts. Output ONLY valid JSON array, no markdown fences:
[{ "text": "..." }, ...]
""",

    "facebook": VOICE_PREAMBLE + """
Platform: Facebook (EV owner community groups)
Tone: conversational, warm, accessible. Like a helpful neighbour who owns an EV.
Length: 60-120 words. Can include a relatable scenario.
Format per post: { "text": "..." }
Generate exactly 10 posts. Output ONLY valid JSON array, no markdown fences:
[{ "text": "..." }, ...]
""",
}


# ---------------------------------------------------------------------------
# Knowledge base fetch
# ---------------------------------------------------------------------------

def fetch_post_worthy_items(days: int = 7, limit: int = 40) -> list[dict]:
    """Fetch top post-worthy knowledge base items via the db module."""
    from db import get_knowledge_base_items
    return get_knowledge_base_items(post_worthy_only=True, days=days, limit=limit)


def build_context_block(items: list[dict]) -> str:
    """Summarize knowledge base items into a compact context string for Grok."""
    lines = ["Here are this week's top OFFO data points (receipts analyzed, news scored, community interactions):"]
    for i, item in enumerate(items[:30], 1):
        source = item.get("source", "?")
        summary = item.get("summary", "")
        tags = ", ".join(item.get("tags") or [])
        verdict = item.get("verdict", "")
        score = item.get("score")
        score_str = f" (score {score})" if score else ""
        tag_str = f" [{tags}]" if tags else ""
        lines.append(f"{i}. [{source.upper()}]{score_str} {verdict} — {summary}{tag_str}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Grok call
# ---------------------------------------------------------------------------

def generate_posts_for_platform(
    platform: str,
    context: str,
    target: int = 10,
) -> list[dict]:
    """Call Grok to generate posts for one platform. Returns list of post dicts."""
    if not GROK_API_KEY:
        print(f"  [WARN] GROK_API_KEY not set — skipping {platform}", file=sys.stderr)
        return []

    from openai import OpenAI
    client = OpenAI(api_key=GROK_API_KEY, base_url="https://api.x.ai/v1")

    system_prompt = PLATFORM_PROMPTS[platform]
    user_prompt = (
        f"Generate {target} {platform} posts based on the following OFFO data points.\n\n"
        f"{context}\n\n"
        f"Remember: max one offolab.com link in the entire batch."
    )

    try:
        response = client.chat.completions.create(
            model="grok-3",
            temperature=0.6,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=4000,
        )
        raw = response.choices[0].message.content or ""
        # Strip markdown fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = "\n".join(raw.split("\n")[1:])
            raw = raw.rsplit("```", 1)[0].strip()
        posts = json.loads(raw)
        if isinstance(posts, list):
            return posts[:target]
        print(f"  [WARN] {platform}: unexpected JSON shape", file=sys.stderr)
        return []
    except json.JSONDecodeError as e:
        print(f"  [WARN] {platform}: JSON parse error — {e}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"  [WARN] {platform}: Grok error — {e}", file=sys.stderr)
        return []


# ---------------------------------------------------------------------------
# Save generated posts back to knowledge base
# ---------------------------------------------------------------------------

def save_generated_posts(items: list[dict], all_posts: dict[str, list]) -> None:
    """Store generated posts onto the source items that contributed context."""
    if not items:
        return
    from db import _client
    now = datetime.now(timezone.utc).isoformat()
    # Store the full batch on the top item (first post-worthy receipt or news item)
    primary = items[0]
    try:
        _client().table("offo_knowledge_base").update({
            "generated_posts": all_posts,
            "posts_generated_at": now,
        }).eq("id", primary["id"]).execute()
        print(f"  Saved generated posts to knowledge base item {primary['id']}")
    except Exception as e:
        print(f"  [WARN] save_generated_posts failed: {e}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

def generate_weekly_posts(
    days: int = 7,
    dry_run: bool = False,
) -> dict[str, list]:
    """
    Generate 10 posts per platform from the past `days` of knowledge base items.
    Returns { reddit: [...], x: [...], linkedin: [...], facebook: [...] }
    """
    print(f"[social-gen] Fetching post-worthy items (last {days} days)...")
    items = fetch_post_worthy_items(days=days, limit=40)
    if not items:
        print("[social-gen] No post-worthy items found — nothing to generate")
        return {"reddit": [], "x": [], "linkedin": [], "facebook": []}

    print(f"[social-gen] {len(items)} items: "
          f"{sum(1 for i in items if i.get('source') == 'receipt')} receipts, "
          f"{sum(1 for i in items if i.get('source') == 'news')} news, "
          f"{sum(1 for i in items if i.get('source') == 'reddit_session')} reddit sessions")

    context = build_context_block(items)

    all_posts: dict[str, list] = {}
    for platform in ("reddit", "x", "linkedin", "facebook"):
        print(f"[social-gen] Generating {platform} posts...")
        posts = generate_posts_for_platform(platform, context)
        all_posts[platform] = posts
        print(f"[social-gen]   → {len(posts)} posts generated")

    if not dry_run:
        save_generated_posts(items, all_posts)

    return all_posts


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OFFO Weekly Social Post Generator")
    parser.add_argument("--days", type=int, default=7, help="Lookback window in days")
    parser.add_argument("--dry-run", action="store_true", help="Generate but do not save")
    parser.add_argument("--voice", action="store_true", help="Generate MP3 voiceover for best Facebook post via ElevenLabs")
    args = parser.parse_args()

    result = generate_weekly_posts(days=args.days, dry_run=args.dry_run)

    print("\n=== GENERATED POSTS ===")
    for platform, posts in result.items():
        print(f"\n--- {platform.upper()} ({len(posts)} posts) ---")
        for i, p in enumerate(posts, 1):
            if platform == "reddit":
                print(f"\n[{i}] {p.get('title', '')}")
                print(f"     r/{p.get('subreddit', '?')}")
                print(f"     {(p.get('body', '') or '')[:200]}...")
            elif platform == "x":
                print(f"[{i}] {p.get('text', '')}")
            else:
                text = (p.get("text") or "")[:200]
                print(f"[{i}] {text}...")

    if args.voice:
        facebook_posts = result.get("facebook", [])
        if facebook_posts:
            from voice_generator import generate_voice
            import datetime
            best = facebook_posts[0]
            script = (best.get("text") or "").strip()
            slug = f"facebook_{datetime.date.today().strftime('%Y_%m_%d')}_001"
            print(f"\n[voice] Generating voiceover for best Facebook post → {slug}.mp3")
            path = generate_voice(script, slug)
            if path:
                print(f"[voice] Audio ready: {path}")
            else:
                print("[voice] Voiceover generation failed — check ELEVENLABS_API_KEY")
