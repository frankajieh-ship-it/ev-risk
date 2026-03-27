"""
Chain Runner — generic task executor with timing, json_guard, and error capture.

Replaces the repetitive call-model → strip-fences → try-json-parse pattern
that appears in every stage of pipeline.py.

Usage (single task):
    from app.ai.chain_runner import run_task
    from app.ai.task_types import get_task

    result = run_task(get_task("classify"), messages)
    if result.status == "ok":
        data = result.parsed_output   # validated dict

Usage (sequential chain):
    results = run_chain(
        task_ids=["classify", "empathy", "polish_general"],
        context_builder=my_context_fn,  # fn(task_id, prev_results) -> list[dict]
    )

The existing pipeline.py continues to own domain routing (which task_id to pick
based on intent). chain_runner.py owns execution only.
"""
from __future__ import annotations

import sys
import time
from dataclasses import dataclass, field
from typing import Callable, Literal, Optional

from app.ai.task_types import AiTask, get_task
from app.ai.json_guard import parse_and_validate
from app.ai.prompt_registry import get_prompt


@dataclass
class TaskResult:
    task_id: str
    raw_output: Optional[str]
    parsed_output: Optional[dict]
    model_used: str
    duration_ms: int
    tokens_used: Optional[int]
    status: Literal["ok", "fallback", "error"]
    error: Optional[str] = None


def _call_model(task: AiTask, messages: list[dict]) -> tuple[Optional[str], Optional[int]]:
    """
    Dispatch to the right ai_clients function based on task.model.
    Returns (raw_text, tokens_used_or_None).
    """
    # Late import to avoid circular deps — ai_clients lives at root level
    if task.model == "grok":
        from ai_clients import call_grok
        raw = call_grok(messages, temperature=task.temperature, max_tokens=task.max_tokens)
        return raw, None

    if task.model == "gemini":
        from ai_clients import call_gemini
        # Gemini takes (system, user) separately; reconstruct from messages
        system = next((m["content"] for m in messages if m["role"] == "system"), "")
        user = next((m["content"] for m in messages if m["role"] == "user"), "")
        raw = call_gemini(system, user, temperature=task.temperature, max_tokens=task.max_tokens)
        return raw, None

    if task.model == "gpt4o":
        from ai_clients import call_gpt4o
        rf = {"type": "json_object"} if task.json_mode else None
        raw = call_gpt4o(messages, temperature=task.temperature, max_tokens=task.max_tokens,
                         response_format=rf)
        return raw, None

    # Unknown model — log and return None
    print(f"[chain_runner] Unknown model '{task.model}' for task '{task.task_id}'", file=sys.stderr)
    return None, None


def run_task(
    task: AiTask,
    messages: list[dict],
    fallback: Optional[dict] = None,
) -> TaskResult:
    """
    Execute a single AI task with timing, cache check, json_guard validation.

    Args:
        task:     AiTask definition (from task_types.TASKS)
        messages: Full messages list to send to the model
        fallback: Dict to return if model fails or returns invalid JSON

    Returns:
        TaskResult with status "ok", "fallback", or "error"
    """
    prompt = get_prompt(task.prompt_key)

    # --- Cache check ---
    if task.cache_ttl_s > 0:
        from app.services.cache import _cache
        cache_key = _cache.make_key(task.task_id, {"msgs": str(messages)})
        cached = _cache.get(cache_key)
        if cached is not None:
            return TaskResult(
                task_id=task.task_id,
                raw_output=None,
                parsed_output=cached,
                model_used=task.model + "(cached)",
                duration_ms=0,
                tokens_used=None,
                status="ok",
            )

    # --- Call model ---
    t0 = time.monotonic()
    try:
        raw, tokens = _call_model(task, messages)
    except Exception as e:
        duration_ms = int((time.monotonic() - t0) * 1000)
        print(f"[chain_runner] task={task.task_id} model_call exception: {e}", file=sys.stderr)
        return TaskResult(
            task_id=task.task_id,
            raw_output=None,
            parsed_output=fallback,
            model_used=task.model,
            duration_ms=duration_ms,
            tokens_used=None,
            status="error",
            error=str(e),
        )

    duration_ms = int((time.monotonic() - t0) * 1000)

    # --- No output ---
    if raw is None:
        return TaskResult(
            task_id=task.task_id,
            raw_output=None,
            parsed_output=fallback,
            model_used=task.model,
            duration_ms=duration_ms,
            tokens_used=tokens,
            status="fallback",
            error="model returned None",
        )

    # --- Parse + validate (prompts with expected_schema get JSON guard; others get raw) ---
    if prompt.expected_schema is not None:
        parsed = parse_and_validate(
            raw,
            schema=prompt.expected_schema,
            fallback=fallback,
            strict=False,
            context=task.task_id,
        )
        status: Literal["ok", "fallback", "error"] = "ok" if parsed else "fallback"
    else:
        # Plain-text prompt (e.g. NOT_FIT_SYSTEM) — wrap in {"text": raw}
        parsed = {"text": raw.strip()}
        status = "ok"

    # --- Store in cache ---
    if task.cache_ttl_s > 0 and parsed and status == "ok":
        from app.services.cache import _cache
        cache_key = _cache.make_key(task.task_id, {"msgs": str(messages)})
        _cache.set(cache_key, parsed, task.cache_ttl_s)

    return TaskResult(
        task_id=task.task_id,
        raw_output=raw,
        parsed_output=parsed,
        model_used=task.model,
        duration_ms=duration_ms,
        tokens_used=tokens,
        status=status,
    )


def run_chain(
    task_ids: list[str],
    context_builder: Callable[[str, list[TaskResult]], list[dict]],
    fallbacks: Optional[dict[str, dict]] = None,
) -> list[TaskResult]:
    """
    Run a sequence of tasks, passing previous results into context_builder.

    Args:
        task_ids:        Ordered list of task IDs to run.
        context_builder: fn(task_id, previous_results) → messages list for this task.
        fallbacks:       Optional dict of task_id → fallback dict.

    Returns:
        List of TaskResult in execution order.
    """
    results: list[TaskResult] = []
    fb = fallbacks or {}

    for task_id in task_ids:
        task = get_task(task_id)
        messages = context_builder(task_id, results)
        result = run_task(task, messages, fallback=fb.get(task_id))
        results.append(result)

        # Stop chain on hard error (model unavailable) only if no fallback
        if result.status == "error" and not result.parsed_output:
            print(
                f"[chain_runner] Chain aborted at task '{task_id}' — no fallback available",
                file=sys.stderr,
            )
            break

    return results
