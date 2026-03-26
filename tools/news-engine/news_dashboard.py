"""
OFFO Daily Routine Impact News Dashboard

Streamlit UI for:
- Viewing today's scored articles sorted by impact score
- Running the pipeline manually (with live output)
- One-click post generation for X / Facebook / Reddit

Run:
    python -m streamlit run news_dashboard.py
"""
from __future__ import annotations

import os
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

st.set_page_config(
    page_title="OFFO News Engine",
    page_icon="📰",
    layout="wide",
)

EFFECT_EMOJI: dict[str, str] = {
    "charging": "⚡",
    "winter": "❄️",
    "battery_daily_use": "🔋",
    "recall": "🚨",
    "infrastructure": "🏗️",
    "range": "📍",
    "cost": "💰",
}


def score_color(score: int) -> str:
    if score >= 80:
        return "#22c55e"
    if score >= 65:
        return "#eab308"
    return "#ef4444"


def fetch_articles(hours_back: int = 48) -> list[dict]:
    if not SUPABASE_URL or not SUPABASE_KEY:
        st.error("Supabase credentials not configured in .env")
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
                "order": "impact_score.desc",
                "limit": 50,
                "select": "*",
            },
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        st.error(f"Failed to load articles: {e}")
        return []


def render_article_card(article: dict, idx: int) -> None:
    score = article.get("impact_score", 0)
    color = score_color(score)
    effects: list[str] = article.get("key_routine_effects") or []

    with st.container(border=True):
        col1, col2 = st.columns([0.85, 0.15])
        with col1:
            source = article.get("source", "")
            st.markdown(f"**{idx}. [{source}] {article['title']}**")
            if article.get("ai_summary"):
                st.caption(article["ai_summary"])
            if effects:
                effect_str = "  ".join(
                    f"{EFFECT_EMOJI.get(e, '•')} {e}" for e in effects
                )
                st.markdown(f"<span style='font-size:0.75rem;color:#888;'>{effect_str}</span>", unsafe_allow_html=True)
            st.markdown(f"[Read article ↗]({article['url']})")
        with col2:
            st.markdown(
                f"<div style='text-align:center;font-size:2rem;font-weight:bold;color:{color};'>{score}</div>"
                f"<div style='text-align:center;font-size:0.65rem;color:#aaa;'>impact score</div>",
                unsafe_allow_html=True,
            )


# ── Sidebar ───────────────────────────────────────────────────────────────────

with st.sidebar:
    st.title("📰 News Engine")
    st.caption("OFFO Routine Impact Digest")

    hours_back = st.slider("Show articles from last N hours", 12, 168, 48, step=12)

    st.divider()

    if st.button("▶ Run Pipeline Now", use_container_width=True, type="primary"):
        with st.spinner("Running daily pipeline (this takes ~2–3 minutes)..."):
            result = subprocess.run(
                [sys.executable, str(Path(__file__).parent / "daily_news_engine.py")],
                capture_output=True,
                text=True,
                timeout=300,
            )
        if result.returncode == 0:
            st.success("Pipeline completed!")
            st.code((result.stdout or "")[-3000:] or "(no output)")
        else:
            st.error("Pipeline failed")
            st.code((result.stderr or result.stdout or "")[-3000:] or "(no output)")
        st.rerun()

    if st.button("🔍 Dry Run (no save)", use_container_width=True):
        with st.spinner("Scoring articles (dry run, no Supabase write)..."):
            result = subprocess.run(
                [sys.executable, str(Path(__file__).parent / "daily_news_engine.py"), "--dry-run"],
                capture_output=True,
                text=True,
                timeout=300,
            )
        output = result.stdout or result.stderr or "(no output)"
        st.code(output[-4000:])

    st.divider()
    grok_ok = bool(os.getenv("GROK_API_KEY"))
    newsdata_ok = bool(os.getenv("NEWSDATA_API_KEY"))
    st.caption("API Status")
    st.markdown(f"{'✅' if grok_ok else '❌'} Grok")
    st.markdown(f"{'✅' if newsdata_ok else '⚠️'} NewsData.io (optional)")
    st.markdown(f"{'✅' if SUPABASE_URL else '❌'} Supabase")


# ── Main ──────────────────────────────────────────────────────────────────────

today_str = datetime.now(timezone.utc).strftime("%B %d, %Y")
st.title(f"📰 Daily Routine Impact Digest — {today_str}")

articles = fetch_articles(hours_back=hours_back)

if not articles:
    st.info("No articles found for this time range. Run the pipeline first using the sidebar button.")
    st.stop()

# Filter controls
col1, col2 = st.columns(2)
with col1:
    min_score = st.slider("Minimum impact score", 0, 100, 65)
with col2:
    post_worthy_only = st.checkbox("Post-worthy only", value=False)

filtered = [a for a in articles if a.get("impact_score", 0) >= min_score]
if post_worthy_only:
    filtered = [a for a in filtered if a.get("post_worthy")]

st.caption(f"Showing **{len(filtered)}** of **{len(articles)}** articles")

for i, article in enumerate(filtered, 1):
    render_article_card(article, i)

if not filtered:
    st.info("No articles match the current filters.")
    st.stop()

st.divider()

# ── Post Generation ───────────────────────────────────────────────────────────

st.subheader("🚀 Generate Posts")
st.caption("Uses the top N scored articles to generate X, Facebook, and Reddit content via Grok.")

top_n = st.slider("Use top N articles", 3, min(10, len(filtered)), min(5, len(filtered)))
top_articles = filtered[:top_n]

if st.button("✨ Generate X / Facebook / Reddit Posts", type="primary", use_container_width=True):
    with st.spinner("Generating posts with Grok..."):
        sys.path.insert(0, str(Path(__file__).parent))
        from post_generator import generate_posts
        posts = generate_posts(top_articles)

    if posts:
        tab1, tab2, tab3 = st.tabs(["𝕏 X Thread", "📘 Facebook", "💬 Reddit"])

        with tab1:
            thread = posts.get("x_thread") or []
            if thread:
                for tweet in thread:
                    text = tweet.get("text", "")
                    char_count = len(text)
                    color = "green" if char_count <= 280 else "red"
                    st.text_area(
                        f"Tweet {tweet.get('tweet', '')} ({char_count}/280)",
                        value=text,
                        height=110,
                        key=f"tweet_{tweet.get('tweet')}",
                    )
            else:
                st.warning("No X thread generated")

        with tab2:
            fb = posts.get("facebook") or {}
            st.text_area("Facebook Post", value=fb.get("text", ""), height=200)
            if fb.get("suggested_image_prompt"):
                st.info(f"📸 Suggested image prompt: {fb['suggested_image_prompt']}")

        with tab3:
            reddit = posts.get("reddit") or {}
            st.text_input("Reddit Title", value=reddit.get("title", ""))
            st.text_area("Reddit Body", value=reddit.get("body", ""), height=300)
    else:
        st.error("Post generation failed — check that GROK_API_KEY is set in .env")
