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
st.caption("Multi-AI pipeline · Grok + Gemini + GPT-4o · EVRoutine funnel · Auto.dev market analytics")

# -------------------------
# Sidebar settings (shared)
# -------------------------

with st.sidebar:
    st.subheader("Settings")
    api_base = st.text_input("FastAPI base URL", value=API_BASE_DEFAULT)

    # Live health check
    try:
        _h = requests.get(f"{api_base}/health", timeout=3).json()
        clients = _h.get("ai_clients", {})
        market_ok = _h.get("market_analytics", False)
        _status_parts = []
        for name, ok in clients.items():
            _status_parts.append(f"{'✅' if ok else '❌'} {name}")
        _status_parts.append(f"{'✅' if market_ok else '⚠️'} auto.dev")
        st.caption("  \n".join(_status_parts))
    except Exception:
        st.caption("⚠️ API offline")

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
    "routine":   ("🧭", "offolab.com/routine",    "#2e86de"),
    "receipt":   ("🧾", "offolab.com/receipt",    "#10ac84"),
    "compare":   ("⚖️",  "offolab.com/compare",   "#ee5a24"),
    "dealer_qa": ("💬", "offolab.com/receipt",    "#8854d0"),
    "dealer":    ("🏢", "offolab.com/workspace",  "#fd9644"),
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


def _render_vehicle_card(dv: dict | None):
    """Render detected vehicle details as a compact info card."""
    if not dv:
        return
    parts = []
    year = dv.get("year")
    make = dv.get("make")
    model = dv.get("model")
    trim = dv.get("trim")
    price = dv.get("price_mentioned")
    mileage = dv.get("mileage_mentioned")
    if year or make or model:
        label = " ".join(filter(None, [str(year) if year else None, make, model, trim]))
        parts.append(f"🚗 **{label}**")
    if price:
        parts.append(f"💰 ${price:,}")
    if mileage:
        parts.append(f"📍 {mileage:,} mi")
    if parts:
        st.info("  ·  ".join(parts))


def _render_intent_badges(intent: str | None, secondary_intent: str | None, suggested_tool: str | None):
    """Render primary/secondary intent and suggested tool as inline badges."""
    badge_html = ""
    if intent:
        badge_html += f'<span style="background:#2e86de;color:#fff;padding:2px 10px;border-radius:4px;margin-right:6px;font-size:0.85em;">{intent}</span>'
    if secondary_intent:
        badge_html += f'<span style="background:#8854d0;color:#fff;padding:2px 10px;border-radius:4px;margin-right:6px;font-size:0.85em;">+{secondary_intent}</span>'
    if suggested_tool and suggested_tool != "none":
        icon = TOOL_LABELS.get(suggested_tool, ("🔧",))[0]
        badge_html += f'<span style="background:#f0f2f6;color:#333;padding:2px 10px;border-radius:4px;margin-right:6px;font-size:0.85em;">{icon} {suggested_tool}</span>'
    if badge_html:
        st.markdown(badge_html, unsafe_allow_html=True)


def _render_safety_flags(flags: list):
    if flags:
        st.markdown("### Safety / tone flags")
        for f in flags:
            st.warning(f"⚠️ {f}")


def _vehicle_label(dv: dict | None) -> str:
    """Return a compact string for a detected_vehicle dict."""
    if not dv:
        return ""
    parts = [str(dv["year"]) if dv.get("year") else None, dv.get("make"), dv.get("model")]
    label = " ".join(p for p in parts if p)
    if dv.get("price_mentioned"):
        label += f" ${dv['price_mentioned']:,}"
    return label


def _render_market_card(md: dict | None):
    """Render Auto.dev market analytics as a compact metrics card."""
    if not md:
        return
    avg = md.get("average_price")
    spread = md.get("price_spread")
    n = md.get("sample_size", 0)
    percentile = md.get("price_percentile")
    if not avg or not n:
        return

    st.markdown("#### 📊 Market Context (Auto.dev)")
    mc1, mc2, mc3 = st.columns(3)
    mc1.metric("Local avg price", f"${avg:,}", help=f"{n} comparable listings")
    if percentile is not None:
        delta_label = "below avg" if percentile <= 45 else ("at avg" if percentile <= 60 else "above avg")
        mc2.metric("Price percentile", f"{percentile}th", delta=delta_label,
                   delta_color="normal" if percentile <= 45 else "inverse")
    if spread:
        mc3.metric("Local range", spread)

    comps = md.get("local_comps") or []
    if comps:
        with st.expander(f"Comparable listings ({n} found)"):
            import pandas as pd
            df_comps = pd.DataFrame([{
                "year":    c.get("year", ""),
                "trim":    c.get("trim", ""),
                "price":   f"${c['price']:,}" if c.get("price") else "",
                "mileage": f"{c['mileage']:,}" if c.get("mileage") else "",
                "seller":  c.get("dealer_type", ""),
            } for c in comps])
            st.dataframe(df_comps, use_container_width=True)


# -------------------------
# Tab 1: Analyze (v1 /analyze — backward compat)
# -------------------------

tab1, tab2, tab3, tab4 = st.tabs(["Analyze (v1)", "Assist (v2)", "Analytics", "Scan Feed"])

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

                    # v2: Intent badges + suggested tool
                    _render_intent_badges(
                        data.get("intent"),
                        data.get("secondary_intent"),
                        data.get("suggested_tool"),
                    )

                    # v2: Detected vehicle card
                    _render_vehicle_card(data.get("detected_vehicle") or data.get("debug", {}).get("detected_vehicle"))

                    # v2: Market analytics card (Stage 3.5 — only present for listing/pricing/compare)
                    _render_market_card(data.get("market_data"))

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

                    # ── Approve & Post flow ────────────────────────────────
                    session_id = data.get("session_id", "")
                    if session_id:
                        st.markdown("---")
                        st.markdown("### Approve & Post")
                        with st.form(key=f"approve_form_{session_id}"):
                            edited = st.text_area(
                                "Edit before posting (or leave as-is):",
                                value=data.get("draft_reply_short", ""),
                                height=140,
                                key="approve_edit",
                            )
                            col_post, col_edit, col_skip = st.columns(3)
                            with col_post:
                                posted = st.form_submit_button("✅ Mark as Posted", use_container_width=True)
                            with col_edit:
                                edited_posted = st.form_submit_button("✏️ Edit then Post", use_container_width=True)
                            with col_skip:
                                skipped = st.form_submit_button("⏭️ Skip", use_container_width=True)

                        if posted or edited_posted or skipped:
                            outcome = "posted" if posted else ("edited" if edited_posted else "skipped")
                            try:
                                payload_outcome = {
                                    "session_id": session_id,
                                    "outcome": outcome,
                                }
                                _post(f"/sessions/{session_id}/outcome", payload_outcome)
                                st.success(f"Saved outcome: **{outcome}**")
                            except Exception:
                                st.success(f"Outcome recorded locally: **{outcome}** (API save optional)")

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
        import pandas as pd
        with st.spinner("Loading metrics..."):
            stats = _get("/stats/funnel")

        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Total sessions", stats.get("total_sessions", 0))
        col2.metric("EVRoutine invites shown", stats.get("invites_shown", 0))
        col3.metric("Invites accepted", stats.get("invites_accepted", 0))
        acceptance_pct = round(stats.get("acceptance_rate", 0) * 100, 1)
        col4.metric("Acceptance rate", f"{acceptance_pct}%")

        st.metric("Replies posted", stats.get("posted_count", 0))

        # Recent sessions table (with v2 columns)
        st.markdown("### Recent sessions")
        recent_data = _get("/stats/recent", {"limit": 50})
        sessions = recent_data.get("analyses", [])
        if sessions:
            df_sessions = pd.DataFrame([{
                "created_at": s.get("created_at", "")[:19],
                "mode": s.get("mode", ""),
                "subreddit": s.get("subreddit", ""),
                "intent": s.get("intent", ""),
                "secondary_intent": s.get("secondary_intent", ""),
                "suggested_tool": s.get("suggested_tool", ""),
                "vehicle": _vehicle_label(s.get("detected_vehicle")),
                "user_state": s.get("user_state", ""),
                "invited": s.get("evroutine_invited", False),
                "outcome": s.get("posted_outcome", ""),
                "upvotes": s.get("upvotes", ""),
                "replies": s.get("reply_count", ""),
                "latency_ms": s.get("total_latency_ms", ""),
            } for s in sessions])
            st.dataframe(df_sessions, use_container_width=True)

            # ── Intent distribution chart ───────────────────────────────
            st.markdown("### Intent distribution")
            intent_counts = df_sessions["intent"].value_counts().reset_index()
            intent_counts.columns = ["Intent", "Count"]
            if not intent_counts.empty:
                st.bar_chart(intent_counts.set_index("Intent"))

            # ── Suggested tool distribution chart ─────────────────────
            st.markdown("### Suggested tool routing")
            tool_counts = df_sessions[df_sessions["suggested_tool"] != ""]["suggested_tool"].value_counts().reset_index()
            tool_counts.columns = ["Tool", "Count"]
            if not tool_counts.empty:
                tool_counts["Icon"] = tool_counts["Tool"].apply(
                    lambda t: f"{TOOL_LABELS.get(t, ('🔧',))[0]} {t}"
                )
                st.bar_chart(tool_counts.set_index("Icon")["Count"])
            else:
                st.info("No tool routing data yet (requires v2 sessions).")

            # ── Detected vehicles table ────────────────────────────────
            vehicle_rows = [s.get("detected_vehicle") for s in sessions if s.get("detected_vehicle")]
            if vehicle_rows:
                st.markdown("### Detected vehicles (recent)")
                df_vehicles = pd.DataFrame([{
                    "year":  v.get("year", ""),
                    "make":  v.get("make", ""),
                    "model": v.get("model", ""),
                    "price": f"${v['price_mentioned']:,}" if v.get("price_mentioned") else "",
                    "mileage": f"{v['mileage_mentioned']:,}" if v.get("mileage_mentioned") else "",
                } for v in vehicle_rows])
                st.dataframe(df_vehicles, use_container_width=True)
        else:
            st.info("No sessions recorded yet.")

        # Friction tag frequency bar chart
        tag_freq = stats.get("tag_frequency", {})
        if tag_freq:
            st.markdown("### Friction tag frequency")
            df_tags = pd.DataFrame(
                list(tag_freq.items()), columns=["Friction Tag", "Count"]
            ).sort_values("Count", ascending=False)
            st.bar_chart(df_tags.set_index("Friction Tag"))
        else:
            st.info("No friction tag data yet.")

    except requests.exceptions.ConnectionError:
        st.warning("⚠️ Cannot connect to API — analytics unavailable.")
    except requests.RequestException as e:
        st.error(f"❌ Analytics error: {e}")


# -------------------------
# Tab 4: Scan Feed
# -------------------------

with tab4:
    st.subheader("Scan Feed — Auto-detected posts")
    st.caption("Posts found by the PRAW scanner awaiting human review before posting.")

    col_refresh, col_info = st.columns([1, 3])
    with col_refresh:
        refresh_scan = st.button("Refresh feed", key="refresh_scan")
    with col_info:
        st.markdown(
            "Start the scanner: `python reddit_scanner.py` &nbsp;&nbsp; "
            "Dry-run test: `python reddit_scanner.py --dry-run --once`",
            unsafe_allow_html=True,
        )

    try:
        # Load pending sessions from the /stats/recent endpoint filtered client-side,
        # or call db directly via a dedicated endpoint if available.
        # We hit /stats/recent with a large limit and filter locally for now.
        recent_data = _get("/stats/recent", {"limit": 100})
        all_sessions = recent_data.get("analyses", [])
        pending = [
            s for s in all_sessions
            if s.get("source") == "reddit_scanner" and s.get("posted_outcome") == "pending"
        ]

        if not pending:
            st.info(
                "No pending posts found.\n\n"
                "Run `python reddit_scanner.py` to start scanning subreddits, "
                "or test with `python reddit_scanner.py --dry-run --once`."
            )
        else:
            st.markdown(f"**{len(pending)} post(s) awaiting review**")
            st.markdown("---")

            for idx, session in enumerate(pending):
                session_id = session.get("id", "")
                subreddit = session.get("subreddit") or "unknown"
                post_title = session.get("post_title") or "(no title)"
                post_body = session.get("post_body") or ""
                draft = session.get("draft_reply_short") or ""
                score = session.get("qualification_score")
                post_url = session.get("reddit_post_url")
                created_at = session.get("created_at", "")[:16].replace("T", " ")

                # Score badge color
                if score is not None:
                    if score >= 0.80:
                        score_color = "#10ac84"
                    elif score >= 0.65:
                        score_color = "#f9ca24"
                    else:
                        score_color = "#ee5a24"
                    score_badge = (
                        f'<span style="background:{score_color};color:#fff;'
                        f'padding:2px 10px;border-radius:4px;font-size:0.85em;font-weight:700;">'
                        f'Score: {score:.2f}</span>'
                    )
                else:
                    score_badge = ""

                with st.container():
                    # Header row
                    h1, h2 = st.columns([3, 1])
                    with h1:
                        st.markdown(
                            f'**r/{subreddit}** &nbsp; {score_badge} &nbsp; '
                            f'<span style="color:#999;font-size:0.8em;">{created_at}</span>',
                            unsafe_allow_html=True,
                        )
                    with h2:
                        if post_url:
                            st.markdown(f"[Open on Reddit ↗]({post_url})")

                    st.markdown(f"**{post_title}**")

                    if post_body:
                        with st.expander("Post body"):
                            st.write(post_body[:1000] + ("…" if len(post_body) > 1000 else ""))

                    # Editable draft reply
                    edited_draft = st.text_area(
                        "Draft reply (edit before posting):",
                        value=draft,
                        height=120,
                        key=f"draft_{session_id}_{idx}",
                    )

                    # Action buttons
                    btn_col1, btn_col2, btn_col3, _ = st.columns([1, 1, 1, 3])
                    with btn_col1:
                        do_post = st.button("✅ Post", key=f"post_{session_id}_{idx}", use_container_width=True)
                    with btn_col2:
                        do_edit_post = st.button("✏️ Edit + Post", key=f"editpost_{session_id}_{idx}", use_container_width=True)
                    with btn_col3:
                        do_skip = st.button("❌ Skip", key=f"skip_{session_id}_{idx}", use_container_width=True)

                    if do_post or do_edit_post or do_skip:
                        outcome = "posted" if do_post else ("edited" if do_edit_post else "skipped")
                        try:
                            _post(f"/sessions/{session_id}/outcome", {
                                "session_id": session_id,
                                "outcome": outcome,
                            })
                            st.success(f"Saved: **{outcome}** — refresh feed to update.")
                        except Exception:
                            st.warning(f"Outcome '{outcome}' recorded (API save optional).")

                    # Manual upvote entry (for sessions already marked posted)
                    existing_upvotes = session.get("upvotes")
                    existing_replies = session.get("reply_count")
                    if session.get("posted_outcome") in ("posted", "edited") or do_post or do_edit_post:
                        with st.expander(
                            f"↻ Log upvotes" + (f" (current: {existing_upvotes} ▲)" if existing_upvotes is not None else "")
                        ):
                            uv_col, rc_col, sv_col = st.columns([1, 1, 1])
                            with uv_col:
                                manual_upvotes = st.number_input(
                                    "Post score (upvotes)",
                                    min_value=0, value=existing_upvotes or 0,
                                    key=f"uv_{session_id}_{idx}",
                                )
                            with rc_col:
                                manual_replies = st.number_input(
                                    "Comment count",
                                    min_value=0, value=existing_replies or 0,
                                    key=f"rc_{session_id}_{idx}",
                                )
                            with sv_col:
                                st.markdown("<br>", unsafe_allow_html=True)
                                if st.button("Save", key=f"save_uv_{session_id}_{idx}", use_container_width=True):
                                    try:
                                        _post(f"/sessions/{session_id}/outcome", {
                                            "session_id": session_id,
                                            "outcome": session.get("posted_outcome", "posted"),
                                            "upvotes": manual_upvotes,
                                            "reply_count": manual_replies,
                                        })
                                        st.success("Upvotes saved.")
                                    except Exception:
                                        st.warning("Saved locally (API optional).")
                            st.caption("Or run `python outcome_tracker.py --once` to auto-fetch from Reddit.")

                    st.markdown("---")

    except requests.exceptions.ConnectionError:
        st.warning("⚠️ Cannot connect to API. Is the FastAPI server running?")
    except requests.RequestException as e:
        st.error(f"❌ Scan Feed error: {e}")
