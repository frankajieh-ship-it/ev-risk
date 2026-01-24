"""
OFFO Reddit Community Operator Tool - Streamlit UI

Paste a Reddit thread, get friction tags + tight OFFO-style reply.
Tool mention only when allowed.

Run with:
    streamlit run streamlit_app.py

Make sure the FastAPI server is running first:
    uvicorn main:app --reload --port 8088
"""
import json
import requests
import streamlit as st

API_URL_DEFAULT = "http://localhost:8088/analyze"

st.set_page_config(
    page_title="OFFO Reddit Operator",
    page_icon="⚡",
    layout="wide",
)

st.title("OFFO — Reddit Community Operator Tool")
st.caption("Paste a thread. Get friction tags + a tight OFFO-style reply. Tool mention only when allowed.")

# -------------------------
# Sidebar settings
# -------------------------

with st.sidebar:
    st.subheader("Request Settings")

    api_url = st.text_input("FastAPI /analyze endpoint", value=API_URL_DEFAULT)
    subreddit = st.text_input("Subreddit (optional)", value="", placeholder="e.g., ElectricVehicles")

    tone = st.selectbox(
        "Tone",
        ["ultra_short", "standard", "empathetic", "technical"],
        index=1,
        help="ultra_short: tight, native Reddit feel | standard: default founder voice | empathetic: extra validation | technical: engineering-minded"
    )

    region_hint = st.selectbox("Region hint", ["AUTO", "US", "UK", "CA", "EU"], index=0)
    thread_type = st.text_input("Thread type (optional)", value="", placeholder="e.g., first_ev, no_home_charging")

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

    st.subheader("Tips")
    st.markdown("""
    - Paste title + body + key comments
    - Keep edits founder-voice: calm, non-salesy
    - **Never** add tool mention if `tool_intro: no`
    """)

# -------------------------
# Main content area
# -------------------------

col1, col2 = st.columns([1, 1])

with col1:
    st.subheader("Input")

    post_title = st.text_input("Post title (optional)", value="", placeholder="Reddit post title...")

    post_body = st.text_area(
        "Post body / thread text",
        height=220,
        placeholder="Paste the Reddit post text here…",
    )

    st.markdown("**Top comment context (optional)**")
    c1 = st.text_area("Comment 1", height=80, placeholder="Paste a key comment…", key="c1")
    c2 = st.text_area("Comment 2", height=80, placeholder="Paste another…", key="c2")
    c3 = st.text_area("Comment 3", height=80, placeholder="Paste another…", key="c3")

    analyze = st.button("Analyze →", type="primary", use_container_width=True)

with col2:
    st.subheader("Output")
    output_placeholder = st.empty()


def call_api(payload: dict) -> dict:
    """Call the FastAPI analyze endpoint."""
    r = requests.post(api_url, json=payload, timeout=30)
    r.raise_for_status()
    return r.json()


if analyze:
    if not post_body.strip() and not post_title.strip():
        st.error("Please paste at least a title or body.")
    else:
        top_comments = [x.strip() for x in [c1, c2, c3] if x and x.strip()]
        payload = {
            "source": "reddit",
            "subreddit": subreddit or None,
            "thread_type": thread_type or None,
            "region_hint": region_hint,
            "tone": tone,
            "post_title": post_title or None,
            "post_body": post_body or "",
            "top_comment_context": top_comments,
        }

        try:
            with st.spinner("Analyzing..."):
                data = call_api(payload)

            with output_placeholder.container():
                # Tone indicator
                st.caption(f"Tone: **{tone}** | Max chars: {{'ultra_short': 520, 'standard': 780, 'empathetic': 950, 'technical': 1000}[tone]}")

                # High-level classification
                st.markdown("### Classification")
                cA, cB, cC = st.columns(3)
                cA.metric("Intent", data.get("intent", "unknown"))
                cB.metric("User state", data.get("user_state", "unknown"))
                cC.metric("Phase", data.get("ownership_phase", "unknown"))

                # Friction tags
                st.markdown("### Friction tags")
                tags = data.get("friction_tags", [])
                if tags:
                    tag_html = " ".join([f'<span style="background-color: #f0f2f6; padding: 2px 8px; border-radius: 4px; margin-right: 4px; font-size: 0.85em;">{tag}</span>' for tag in tags])
                    st.markdown(tag_html, unsafe_allow_html=True)
                else:
                    st.write("— (none detected)")

                # Reply plan
                st.markdown("### Reply plan")
                plan = data.get("reply_plan", {})

                col_plan1, col_plan2 = st.columns(2)
                with col_plan1:
                    st.markdown("**Validate:**")
                    st.write(plan.get("validate_line", ""))
                    st.markdown("**Hidden tradeoff:**")
                    st.write(plan.get("hidden_tradeoff_line", ""))
                with col_plan2:
                    st.markdown("**Reframe:**")
                    st.write(plan.get("reframe_line", ""))
                    st.markdown("**Reflective question:**")
                    st.write(plan.get("reflective_question", ""))

                # Tool intro status
                tool_intro = plan.get("tool_intro", "no")
                if tool_intro == "no":
                    st.warning("⚠️ **Tool intro: NO** — Do not add tool mention to your reply")
                elif tool_intro == "offer_by_permission":
                    st.success("✓ **Tool intro: offer_by_permission** — Can mention tool (user uncertain)")
                else:
                    st.success("✓ **Tool intro: asked_directly** — Can mention tool (user asked)")

                # Draft replies
                st.markdown("### Draft reply (short)")
                short_reply = data.get("draft_reply_short", "")
                st.text_area(
                    label=f"Copy/paste ({len(short_reply)} chars)",
                    value=short_reply,
                    height=120,
                    key="short_reply",
                )

                st.markdown("### Draft reply (long)")
                long_reply = data.get("draft_reply_long", "")
                st.text_area(
                    label=f"Copy/paste ({len(long_reply)} chars)",
                    value=long_reply,
                    height=180,
                    key="long_reply",
                )

                # Tool blurb (only when allowed)
                tool_blurb = data.get("tool_blurb")
                if tool_blurb:
                    st.markdown("### Tool blurb (only if appropriate)")
                    st.info(tool_blurb)

                # Safety flags
                flags = data.get("safety_flags", [])
                if flags:
                    st.markdown("### Safety / tone flags")
                    for f in flags:
                        st.warning(f"⚠️ {f}")

                # Debug + raw JSON
                with st.expander("Raw JSON"):
                    st.code(json.dumps(data, indent=2), language="json")

        except requests.exceptions.ConnectionError:
            st.error("❌ Cannot connect to API. Make sure the FastAPI server is running:\n\n`uvicorn main:app --reload --port 8088`")
        except requests.exceptions.Timeout:
            st.error("❌ API request timed out. Try again.")
        except requests.RequestException as e:
            st.error(f"❌ API call failed: {e}")
