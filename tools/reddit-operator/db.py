"""
SQLite persistence for analysis logging.
Stores all analyses for learning and consistency tracking.
"""
from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

from models import AnalyzeRequest, AnalyzeResponse


# Database file location (in the same directory as the tool)
DB_PATH = Path(__file__).parent / "offo_operator.db"


def init_db() -> None:
    """Initialize the database and create tables if they don't exist."""
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        source TEXT,
        subreddit TEXT,
        thread_type TEXT,
        region_hint TEXT,
        tone TEXT,
        post_title TEXT,
        post_body TEXT NOT NULL,
        top_comment_context TEXT,
        intent TEXT,
        user_state TEXT,
        ownership_phase TEXT,
        friction_tags TEXT,
        tool_intro TEXT,
        draft_reply_short TEXT,
        draft_reply_long TEXT,
        safety_flags TEXT,
        operator_edit TEXT,
        posted_outcome TEXT,
        upvotes INTEGER,
        reply_count INTEGER
    )
    """)

    con.commit()
    con.close()


def save_analysis(req: AnalyzeRequest, resp: AnalyzeResponse) -> int:
    """
    Save an analysis to the database.

    Returns the ID of the inserted row.
    """
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    cur.execute("""
    INSERT INTO analyses (
        created_at,
        source,
        subreddit,
        thread_type,
        region_hint,
        tone,
        post_title,
        post_body,
        top_comment_context,
        intent,
        user_state,
        ownership_phase,
        friction_tags,
        tool_intro,
        draft_reply_short,
        draft_reply_long,
        safety_flags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        datetime.utcnow().isoformat(),
        req.source,
        req.subreddit,
        req.thread_type,
        req.region_hint,
        req.tone,
        req.post_title,
        req.post_body,
        ",".join(req.top_comment_context or []),
        resp.intent,
        resp.user_state,
        resp.ownership_phase,
        ",".join(resp.friction_tags),
        resp.reply_plan.tool_intro,
        resp.draft_reply_short,
        resp.draft_reply_long,
        ",".join(resp.safety_flags),
    ))

    row_id = cur.lastrowid
    con.commit()
    con.close()

    return row_id


def save_operator_edit(analysis_id: int, edited_reply: str) -> None:
    """
    Save an operator's edited reply for learning.

    Future feature: use this to learn operator style.
    """
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    cur.execute("""
    UPDATE analyses
    SET operator_edit = ?
    WHERE id = ?
    """, (edited_reply, analysis_id))

    con.commit()
    con.close()


def save_posted_outcome(
    analysis_id: int,
    outcome: str,
    upvotes: int | None = None,
    reply_count: int | None = None
) -> None:
    """
    Save the outcome of a posted reply.

    Future feature: track what actually resonates.
    """
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    cur.execute("""
    UPDATE analyses
    SET posted_outcome = ?, upvotes = ?, reply_count = ?
    WHERE id = ?
    """, (outcome, upvotes, reply_count, analysis_id))

    con.commit()
    con.close()


def get_recent_analyses(limit: int = 50) -> list:
    """
    Get recent analyses for review.

    Returns a list of dictionaries with analysis data.
    """
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    cur.execute("""
    SELECT * FROM analyses
    ORDER BY created_at DESC
    LIMIT ?
    """, (limit,))

    rows = cur.fetchall()
    con.close()

    return [dict(row) for row in rows]


def get_analyses_by_subreddit(subreddit: str, limit: int = 50) -> list:
    """
    Get analyses for a specific subreddit.

    Useful for understanding patterns in specific communities.
    """
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()

    cur.execute("""
    SELECT * FROM analyses
    WHERE subreddit = ?
    ORDER BY created_at DESC
    LIMIT ?
    """, (subreddit, limit))

    rows = cur.fetchall()
    con.close()

    return [dict(row) for row in rows]


def get_tag_frequency() -> dict:
    """
    Get frequency of friction tags across all analyses.

    Useful for understanding common friction patterns.
    """
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    cur.execute("SELECT friction_tags FROM analyses WHERE friction_tags IS NOT NULL")

    tag_counts: dict = {}
    for row in cur.fetchall():
        tags = row[0].split(",")
        for tag in tags:
            tag = tag.strip()
            if tag:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

    con.close()

    # Sort by frequency
    return dict(sorted(tag_counts.items(), key=lambda x: x[1], reverse=True))
