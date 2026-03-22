"""
OFFO Reddit Community Operator Tool v2 — Streamlit Dashboard

Three tabs:
  1. Analyze  — v1 /analyze endpoint (backward compat)
  2. Assist   — v2 /assist endpoint (multi-AI pipeline)
  3. Analytics — funnel metrics from /stats/funnel

Run with:
    streamlit run streamlit_app.py

Make sure the FastAPI server is running:
    uvicorn main:app --reload --port 8088
"""
import json
import requests
import streamlit as st

API_BASE_DEFAULT = "http://localhost:8088"

st.set_page_config(
    page_title="OFFO Reddit Operator v2",
    page_icon="⚡",
    layout="wide",
)

st.title("OFFO — Reddit Operator Tool v2")
st.caption("Multi-AI pipeline · Grok + Claude + GPT-4o · EVRoutine funnel")

# -------------------------
# Sidebar settings (shared)
# -------------------------

with st.sidebar:
    st.subheader("Settings")
    api_base = st.text_input("FastAPI base URL", value=API_BASE_DEFAULT)

    subreddit = st.text_input("Subreddit (optional)", value="", placeholder="e.g., ElectricVehicles")

    tone = st.selectbox(
        "Tone",
        ["ultra_short", "standard", "empathetic", "technical"],
        index=1,
        help="ultra_short: ≤520 chars | standard: ≤780 | empathetic: ≤950 | technical: ≤1000",
    )

    region_hint = st.selectbox("Region", ["AUTO", "US", "UK", "CA", "EU"], index=0)
    thread_type = st.text_input("Thread type (optional)", placeholder="e.g., first_ev, no_home_charging")

    st.markdown("---")
    st.subheader("Tone Guidelines")
    st.markdown("""
| Tone | Use When |
|------|----------|
| **ultra_short** | High-traffic threads |
| **standard** | Default voice |
| **empathetic** | Anxious/first-EV |
| **technical** | Engineering subs |
""")
    st.markdown("---")
    st.subheader("Reply Rules")
    st.markdown("""
- Validate → Hidden Tradeoff → Reframe → Question
- **Never** add tool mention if `tool_intro: no`
- EVRoutine invite only when genuinely helpful
""")


# -------------------------
# Helpers
# -------------------------

def _post(endpoint: str, payload: dict) -> dict:
    r = requests.post(f"{api_base}{endpoint}", json=payload, timeout=45)
    r.raise_for_status()
    return r.json()


def _get(endpoint: str, params: dict | None = None) -> dict:
    r = requests.get(f"{api_base}{endpoint}", params=params or {}, timeout=15)
    r.raise_for_status()
    return r.json()


def _render_friction_badges(tags: list):
    if not tags:
        st.write("— (none detected)")
        return
    tag_html = " ".join([
        f'<span style="background:#f0f2f6;padding:2px 8px;border-radius:4px;margin-right:4px;font-size:0.85em;">{t}</span>'
        for t in tags
    ])
    st.markdown(tag_html, unsafe_allow_html=True)


TOOL_LABELS = {
    "routine":  ("🧭", "offolab.com/routine",  "#2e86de"),
    "receipt":  ("🧾", "offolab.com/receipt",  "#10ac84"),
    "compare":  ("⚖️", "offolab.com/compare",  "#ee5a24"),
}

def _render_tool_invite(invite: dict):
    if not invite:
        return
    if invite.get("should_invite"):
        tool = invite.get("tool", "routine")
        trigger = invite.get("trigger_reason", "")
        icon, url, _ = TOOL_LABELS.get(tool, TOOL_LABELS["routine"])
        st.success(f"{icon} Invite → **{url}** | trigger: `{trigger}`")
        invite_text = invite.get("invite_text", "")
        if invite_text:
            st.text_area("Ready-to-append invite text", value=invite_text, height=75, key="invite_text_box")
    else:
        st.info("Tool invite: not triggered")


def _render_safety_flags(flags: list):
    if flags:
        st.markdown("### Safety / tone flags")
        for f in flags:
            st.warning(f"⚠️ {f}")


# -------------------------
# Tab 1: Analyze (v1 /analyze — backward compat)
# -------------------------

tab1, tab2, tab3 = st.tabs(["Analyze (v1)", "Assist (v2)", "Analytics"])

with tab1:
    st.subheader("v1 /analyze — regex + templates (backward compat)")
    st.caption("Uses the original pattern-based classifier and hardcoded templates.")

    col1, col2 = st.columns([1, 1])

    with col1:
        st.markdown("**Input**")
        post_title_v1 = st.text_input("Post title (optional)", key="v1_title")
        post_body_v1 = st.text_area("Post body", height=220, key="v1_body",
            placeholder="Paste the Reddit post text here…")
        c1v1 = st.text_area("Comment 1", height=70, key="v1_c1", placeholder="Optional comment…")
        c2v1 = st.text_area("Comment 2", height=70, key="v1_c2", placeholder="Optional comment…")
        c3v1 = st.text_area("Comment 3", height=70, key="v1_c3", placeholder="Optional comment…")
        analyze_v1 = st.button("Analyze →", type="primary", use_container_width=True, key="v1_btn")

    with col2:
        st.markdown("**Output**")
        output_v1 = st.empty()

    if analyze_v1:
        if not post_body_v1.strip() and not post_title_v1.strip():
            st.error("Please enter a title or body.")
        else:
            top_comments = [x.strip() for x in [c1v1, c2v1, c3v1] if x and x.strip()]
            payload = {
                "source": "reddit",
                "subreddit": subreddit or None,
                "thread_type": thread_type or None,
                "region_hint": region_hint,
                "tone": tone,
                "post_title": post_title_v1 or None,
                "post_body": post_body_v1 or "",
                "top_comment_context": top_comments,
            }
            try:
                with st.spinner("Analyzing (v1)..."):
                    data = _post("/analyze", payload)
                with output_v1.container():
                    st.markdown("### Classification")
                    cA, cB, cC = st.columns(3)
                    cA.metric("Intent", data.get("intent", "—"))
                    cB.metric("User state", data.get("user_state", "—"))
                    cC.metric("Phase", data.get("ownership_phase", "—"))
                    st.markdown("### Friction tags")
                    _render_friction_badges(data.get("friction_tags", []))
                    plan = data.get("reply_plan", {})
                    st.markdown("### Reply plan")
                    p1, p2 = st.columns(2)
                    with p1:
                        st.markdown("**Validate:**"); st.write(plan.get("validate_line", ""))
                        st.markdown("**Hidden tradeoff:**"); st.write(plan.get("hidden_tradeoff_line", ""))
                    with p2:
                        st.markdown("**Reframe:**"); st.write(plan.get("reframe_line", ""))
                        st.markdown("**Reflective question:**"); st.write(plan.get("reflective_question", ""))
                    tool_intro = plan.get("tool_intro", "no")
                    if tool_intro == "no":
                        st.warning("⚠️ Tool intro: NO")
                    else:
                        st.success(f"✓ Tool intro: {tool_intro}")
                    short = data.get("draft_reply_short", "")
                    st.markdown(f"### Short draft ({len(short)} chars)")
                    st.text_area("Copy/paste", value=short, height=110, key="v1_short")
                    long_ = data.get("draft_reply_long", "")
                    st.markdown(f"### Long draft ({len(long_)} chars)")
                    st.text_area("Copy/paste", value=long_, height=160, key="v1_long")
                    _render_safety_flags(data.get("safety_flags", []))
                    with st.expander("Raw JSON"):
                        st.code(json.dumps(data, indent=2), language="json")
            except requests.exceptions.ConnectionError:
                st.error("❌ Cannot connect. Is the FastAPI server running?")
            except requests.exceptions.Timeout:
                st.error("❌ Request timed out.")
            except requests.RequestException as e:
                st.error(f"❌ API error: {e}")


# -------------------------
# Tab 2: Assist (v2 /assist — multi-AI)
# -------------------------

with tab2:
    st.subheader("v2 /assist — Multi-AI pipeline")
    st.caption("Grok classifies · Claude writes empathy · GPT-4o checks facts · Grok polishes")

    col1, col2 = st.columns([1, 1])

    with col1:
        st.markdown("**Input**")
        post_title_v2 = st.text_input("Post title (optional)", key="v2_title")
        post_body_v2 = st.text_area("Post body", height=220, key="v2_body",
            placeholder="Paste the Reddit post text here…")
        c1v2 = st.text_area("Comment 1", height=70, key="v2_c1", placeholder="Optional comment…")
        c2v2 = st.text_area("Comment 2", height=70, key="v2_c2", placeholder="Optional comment…")
        c3v2 = st.text_area("Comment 3", height=70, key="v2_c3", placeholder="Optional comment…")
        assist_btn = st.button("Run Pipeline →", type="primary", use_container_width=True, key="v2_btn")

    with col2:
        st.markdown("**Output**")
        output_v2 = st.empty()

    if assist_btn:
        if not post_body_v2.strip() and not post_title_v2.strip():
            st.error("Please enter a title or body.")
        else:
            top_comments = [x.strip() for x in [c1v2, c2v2, c3v2] if x and x.strip()]
            payload = {
                "mode": "operator",
                "source": "reddit",
                "subreddit": subreddit or None,
                "thread_type": thread_type or None,
                "region_hint": region_hint,
                "tone": tone,
                "post_title": post_title_v2 or None,
                "post_body": post_body_v2 or "",
                "top_comment_context": top_comments,
            }
            try:
                with st.spinner("Running multi-AI pipeline... (Grok → Claude → GPT-4o → Grok)"):
                    data = _post("/assist", payload)

                with output_v2.container():
                    # Pipeline stages used
                    stages = data.get("pipeline_stages_used", [])
                    st.caption(f"Pipeline: {' → '.join(stages)}")

                    # ── Fit Score badge + relevance gate ──────────────────────
                    is_relevant = data.get("is_offo_relevant", True)
                    confidence = data.get("confidence_score", 100)

                    score_col, _, latency_col = st.columns([1, 2, 1])
                    with score_col:
                        if confidence >= 80:
                            color = "#10ac84"
                        elif confidence >= 60:
                            color = "#f9ca24"
                        else:
                            color = "#ee5a24"
                        st.markdown(
                            f'<div style="background:{color};color:#fff;padding:6px 14px;'
                            f'border-radius:8px;display:inline-block;font-weight:700;font-size:1.1em;">'
                            f'Fit Score: {confidence}/100</div>',
                            unsafe_allow_html=True,
                        )
                    with latency_col:
                        st.caption(f"Latency: {data.get('latency_ms', 0)}ms")

                    if not is_relevant:
                        st.error(
                            "Not a good fit for OFFO analysis — post is outside EV lifestyle/fit scope. "
                            "A neutral reply has been generated. Do NOT mention any OFFO tools."
                        )
                        neutral = data.get("draft_reply_short", "")
                        if neutral:
                            st.markdown("### Neutral reply (no tool mention)")
                            st.text_area("Copy/paste", value=neutral, height=120, key="v2_neutral")
                        _render_safety_flags(data.get("safety_flags", []))
                        with st.expander("Raw JSON"):
                            st.code(json.dumps(data, indent=2), language="json")
                        st.stop()

                    # ── Normal pipeline output ────────────────────────────────

                    # Classification
                    st.markdown("### Classification")
                    cA, cB, cC = st.columns(3)
                    cA.metric("Intent", data.get("intent", "—"))
                    cB.metric("User state", data.get("user_state", "—"))
                    cC.metric("Phase", data.get("ownership_phase", "—"))

                    # Key concern
                    key_concern = data.get("debug", {}).get("key_concern") or ""
                    if key_concern:
                        st.info(f"Key concern: {key_concern}")

                    # Friction tags
                    st.markdown("### Friction tags")
                    _render_friction_badges(data.get("friction_tags", []))

                    # Reply plan
                    plan = data.get("reply_plan") or {}
                    if plan:
                        st.markdown("### Reply plan")
                        p1, p2 = st.columns(2)
                        with p1:
                            st.markdown("**Validate (Gemini):**")
                            st.write(plan.get("validate_line", ""))
                            st.markdown("**Hidden tradeoff (GPT-4o):**")
                            st.write(plan.get("hidden_tradeoff_line", ""))
                        with p2:
                            st.markdown("**Reframe (Gemini):**")
                            st.write(plan.get("reframe_line", ""))
                            st.markdown("**Reflective question:**")
                            st.write(plan.get("reflective_question", ""))

                    # Tool intro
                    tool_intro = (plan.get("tool_intro") or "no") if plan else "no"
                    if tool_intro == "no":
                        st.warning("⚠️ Tool intro: NO — Do not add tool mention")
                    else:
                        st.success(f"✓ Tool intro: {tool_intro}")

                    # Tool invite (Routine / Receipt / Compare)
                    _render_tool_invite(data.get("evroutine_invite", {}))

                    # Tech support flag
                    tsf = data.get("tech_support_flag")
                    if tsf and tsf.get("is_support_question"):
                        st.info(f"🔧 Tech support detected ({tsf.get('support_type')}) — {tsf.get('suggested_reply_suffix', '')}")

                    # Draft replies
                    short = data.get("draft_reply_short", "")
                    st.markdown(f"### Short draft ({len(short)} chars) — Grok polished")
                    st.text_area("Copy/paste", value=short, height=130, key="v2_short")

                    long_ = data.get("draft_reply_long", "")
                    st.markdown(f"### Long draft ({len(long_)} chars)")
                    st.text_area("Copy/paste", value=long_, height=170, key="v2_long")

                    # Tool blurb
                    blurb = data.get("tool_blurb")
                    if blurb:
                        st.markdown("### EVRoutine blurb (only if appropriate)")
                        st.info(blurb)

                    _render_safety_flags(data.get("safety_flags", []))

                    with st.expander("Raw JSON"):
                        st.code(json.dumps(data, indent=2), language="json")

            except requests.exceptions.ConnectionError:
                st.error("❌ Cannot connect. Is the FastAPI server running?\n\n`uvicorn main:app --reload --port 8088`")
            except requests.exceptions.Timeout:
                st.error("❌ Pipeline timed out (multi-AI calls can take 10-15s). Try again.")
            except requests.RequestException as e:
                st.error(f"❌ API error: {e}")


# -------------------------
# Tab 3: Analytics
# -------------------------

with tab3:
    st.subheader("Funnel Analytics")
    st.caption("Live metrics from Supabase — updated on each page refresh.")

    refresh = st.button("Refresh metrics", key="refresh_analytics")

    try:
        with st.spinner("Loading metrics..."):
            stats = _get("/stats/funnel")

        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Total sessions", stats.get("total_sessions", 0))
        col2.metric("EVRoutine invites shown", stats.get("invites_shown", 0))
        col3.metric("Invites accepted", stats.get("invites_accepted", 0))
        acceptance_pct = round(stats.get("acceptance_rate", 0) * 100, 1)
        col4.metric("Acceptance rate", f"{acceptance_pct}%")

        st.metric("Replies posted", stats.get("posted_count", 0))

        # Friction tag frequency bar chart
        tag_freq = stats.get("tag_frequency", {})
        if tag_freq:
            st.markdown("### Friction tag frequency")
            import pandas as pd
            df = pd.DataFrame(
                list(tag_freq.items()), columns=["Friction Tag", "Count"]
            ).sort_values("Count", ascending=False)
            st.bar_chart(df.set_index("Friction Tag"))
        else:
            st.info("No friction tag data yet.")

        # Recent sessions table
        st.markdown("### Recent sessions")
        recent_data = _get("/stats/recent", {"limit": 20})
        sessions = recent_data.get("analyses", [])
        if sessions:
            import pandas as pd
            df2 = pd.DataFrame([{
                "created_at": s.get("created_at", ""),
                "mode": s.get("mode", ""),
                "subreddit": s.get("subreddit", ""),
                "intent": s.get("intent", ""),
                "user_state": s.get("user_state", ""),
                "invited": s.get("evroutine_invited", False),
                "outcome": s.get("posted_outcome", ""),
                "latency_ms": s.get("total_latency_ms", ""),
            } for s in sessions])
            st.dataframe(df2, use_container_width=True)
        else:
            st.info("No sessions recorded yet.")

    except requests.exceptions.ConnectionError:
        st.warning("⚠️ Cannot connect to API — analytics unavailable.")
    except requests.RequestException as e:
        st.error(f"❌ Analytics error: {e}")
