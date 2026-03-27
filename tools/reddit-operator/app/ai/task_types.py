"""
Task Types — declarative definitions for every AI task in the pipeline.

Each AiTask maps a task_id to:
  - which prompt key to use (from prompt_registry)
  - which model to call
  - temperature + max_tokens
  - timeout budget
  - cache TTL (0 = no cache)

Adding a new task is a data change here, not a code change in pipeline.py.

Usage:
    from app.ai.task_types import get_task, TASKS

    task = get_task("classify")
    print(task.model, task.temperature)
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class AiTask:
    task_id: str
    prompt_key: str       # must exist in prompt_registry.REGISTRY
    model: str            # "grok" | "gemini" | "gpt4o"
    temperature: float
    max_tokens: int
    timeout_s: float = 10.0
    cache_ttl_s: int = 0  # 0 = never cache; >0 = cache for this many seconds
    json_mode: bool = False  # pass response_format={"type":"json_object"} to GPT-4o


# ---------------------------------------------------------------------------
# Task registry
# ---------------------------------------------------------------------------

TASKS: dict[str, AiTask] = {
    # --- Existing pipeline stages ---
    "classify": AiTask(
        task_id="classify",
        prompt_key="GROK_CLASSIFY",
        model="grok",
        temperature=0.0,
        max_tokens=900,
        timeout_s=12.0,
        cache_ttl_s=0,
    ),
    "empathy": AiTask(
        task_id="empathy",
        prompt_key="GEMINI_EMPATHY",
        model="gemini",
        temperature=0.7,
        max_tokens=400,
        timeout_s=12.0,
        cache_ttl_s=0,
    ),
    "polish_general": AiTask(
        task_id="polish_general",
        prompt_key="GPT4O_POLISH_GENERAL",
        model="gpt4o",
        temperature=0.3,
        max_tokens=1600,
        timeout_s=20.0,
        json_mode=True,
    ),
    "polish_listing": AiTask(
        task_id="polish_listing",
        prompt_key="GPT4O_POLISH_LISTING",
        model="gpt4o",
        temperature=0.3,
        max_tokens=1600,
        timeout_s=20.0,
        json_mode=True,
    ),
    "polish_dealer": AiTask(
        task_id="polish_dealer",
        prompt_key="GPT4O_POLISH_DEALER",
        model="gpt4o",
        temperature=0.3,
        max_tokens=1600,
        timeout_s=20.0,
        json_mode=True,
    ),
    "tone_check": AiTask(
        task_id="tone_check",
        prompt_key="GROK_TONE_CHECK",
        model="grok",
        temperature=0.3,
        max_tokens=800,
        timeout_s=12.0,
    ),
    "tone_check_market": AiTask(
        task_id="tone_check_market",
        prompt_key="GROK_TONE_CHECK_MARKET",
        model="grok",
        temperature=0.3,
        max_tokens=800,
        timeout_s=12.0,
    ),

    # --- Dealer intelligence (Phase 2) ---
    "dealer_signals": AiTask(
        task_id="dealer_signals",
        prompt_key="DEALER_CHAT_SIGNALS",
        model="gpt4o",
        temperature=0.3,
        max_tokens=1000,
        timeout_s=15.0,
        json_mode=True,
    ),
    "buyer_profile": AiTask(
        task_id="buyer_profile",
        prompt_key="BUYER_PROFILE_BUILDER",
        model="gemini",
        temperature=0.5,
        max_tokens=1200,
        timeout_s=15.0,
    ),
    "pricing_insight": AiTask(
        task_id="pricing_insight",
        prompt_key="PRICING_INSIGHT",
        model="grok",
        temperature=0.2,
        max_tokens=800,
        timeout_s=12.0,
    ),

    # --- Copart (Phase 3) ---
    "copart_analyze": AiTask(
        task_id="copart_analyze",
        prompt_key="COPART_LOT_ANALYSIS",
        model="gpt4o",
        temperature=0.2,
        max_tokens=1500,
        timeout_s=20.0,
        cache_ttl_s=86400,  # 24h — lot data doesn't change once archived
        json_mode=True,
    ),
}


def get_task(task_id: str) -> AiTask:
    """Return an AiTask by ID. Raises KeyError if not found."""
    if task_id not in TASKS:
        raise KeyError(f"Task '{task_id}' not in registry. Available: {list(TASKS.keys())}")
    return TASKS[task_id]
