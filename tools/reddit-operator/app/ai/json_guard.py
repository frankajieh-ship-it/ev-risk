"""
JSON Guard — validates LLM JSON output against an expected schema.

Replaces scattered try/except json.loads() calls throughout pipeline.py
with a single validated parse that logs warnings on schema violations
instead of silently returning garbage or crashing.

Usage:
    from app.ai.json_guard import parse_and_validate, strip_fences

    raw = call_grok(messages)
    data = parse_and_validate(raw, schema=REGISTRY["GROK_CLASSIFY"].expected_schema,
                               fallback={"intent": "other", "confidence": 0})
"""
from __future__ import annotations

import json
import re
import sys
from typing import Optional


class JsonGuardError(Exception):
    """Raised when strict=True and validation fails."""
    pass


def strip_fences(raw: str) -> str:
    """Remove markdown code fences that some models wrap around JSON output."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
    return raw.strip()


def parse_and_validate(
    raw: Optional[str],
    schema: Optional[dict] = None,
    fallback: Optional[dict] = None,
    strict: bool = False,
    context: str = "",
) -> dict:
    """
    Parse raw LLM output as JSON and optionally validate against a JSON Schema.

    Args:
        raw:      Raw string from the model. None triggers fallback.
        schema:   JSON Schema dict. If None, schema validation is skipped.
        fallback: Dict to return when parsing fails and strict=False.
        strict:   If True, raise JsonGuardError instead of returning fallback.
        context:  Label for log messages (e.g. "GROK_CLASSIFY stage1").

    Returns:
        Parsed + validated dict.

    Raises:
        JsonGuardError: if strict=True and parsing/validation fails.
    """
    tag = f"[json_guard{' ' + context if context else ''}]"

    # --- Step 1: handle None ---
    if raw is None:
        msg = f"{tag} raw output is None"
        if strict:
            raise JsonGuardError(msg)
        print(msg, file=sys.stderr)
        return fallback or {}

    # --- Step 2: strip fences and parse ---
    cleaned = strip_fences(raw)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        msg = f"{tag} JSON parse failed: {e} | raw (first 200): {cleaned[:200]!r}"
        if strict:
            raise JsonGuardError(msg) from e
        print(msg, file=sys.stderr)
        return fallback or {}

    if not isinstance(data, dict):
        msg = f"{tag} parsed value is not a dict (got {type(data).__name__})"
        if strict:
            raise JsonGuardError(msg)
        print(msg, file=sys.stderr)
        return fallback or {}

    # --- Step 3: JSON Schema validation (optional) ---
    if schema:
        try:
            import jsonschema
            jsonschema.validate(instance=data, schema=schema)
        except ImportError:
            # jsonschema not installed — skip validation silently
            pass
        except jsonschema.ValidationError as e:
            msg = f"{tag} schema validation failed: {e.message} | path: {list(e.absolute_path)}"
            if strict:
                raise JsonGuardError(msg) from e
            print(f"WARNING {msg}", file=sys.stderr)
            # Return partial data merged with fallback (fallback fills missing required fields)
            if fallback:
                merged = {**fallback, **data}
                return merged
            # No fallback — return what we have, caller must handle missing keys
            return data

    return data
