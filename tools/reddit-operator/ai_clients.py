"""
AI client initialization for the OFFO Reddit Operator Tool v2.

Lazily initializes three clients:
- Grok (xAI, OpenAI-compatible API)  — classification + final polish
- Claude (Anthropic)                  — empathetic validation + reframe
- GPT-4o (OpenAI)                     — technical accuracy + structured receipt drafts

Each client gracefully returns None if its API key is absent,
allowing the pipeline to fall back to template-based generation.
"""
from __future__ import annotations

import os
import sys
import traceback
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load .env from this directory (separate from Next.js .env.local)
_env_path = Path(__file__).parent / ".env"
load_dotenv(_env_path)
print(f"[ai_clients] Loaded .env from {_env_path}", file=sys.stderr)
print(f"[ai_clients] Keys present: GROK={'yes' if os.getenv('GROK_API_KEY') else 'MISSING'} | OPENAI={'yes' if os.getenv('OPENAI_API_KEY') else 'MISSING'} | GEMINI={'yes' if os.getenv('GEMINI_API_KEY') else 'MISSING'} | ANTHROPIC={'yes' if os.getenv('ANTHROPIC_API_KEY') else 'MISSING'}", file=sys.stderr)


# -------------------------
# Grok (xAI) client
# -------------------------

_grok_client = None


def get_grok_client():
    """Return a lazy-initialized OpenAI-compatible client pointed at xAI's API."""
    global _grok_client
    if _grok_client is not None:
        return _grok_client

    api_key = os.getenv("GROK_API_KEY")
    if not api_key:
        return None

    try:
        from openai import OpenAI
        _grok_client = OpenAI(
            api_key=api_key,
            base_url="https://api.x.ai/v1",
        )
        return _grok_client
    except Exception:
        return None


def call_grok(
    messages: list,
    temperature: float = 0.0,
    max_tokens: int = 1000,
    model: str = "grok-3-mini",
) -> Optional[str]:
    """
    Call Grok and return the text content of the first choice.
    Returns None on any error so the caller can fall back to templates.
    """
    client = get_grok_client()
    if client is None:
        return None

    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"[ai_clients] call_grok ERROR ({model}): {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return None


# -------------------------
# Claude (Anthropic) client
# -------------------------

_claude_client = None


def get_claude_client():
    """Return a lazy-initialized Anthropic client."""
    global _claude_client
    if _claude_client is not None:
        return _claude_client

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None

    try:
        import anthropic
        _claude_client = anthropic.Anthropic(api_key=api_key)
        return _claude_client
    except Exception:
        return None


def call_claude(
    system: str,
    user: str,
    temperature: float = 0.7,
    max_tokens: int = 800,
    model: str = "claude-3-5-sonnet-20241022",
) -> Optional[str]:
    """
    Call Claude and return the text content.
    Returns None on any error so the caller can fall back to templates.
    """
    client = get_claude_client()
    if client is None:
        return None

    try:
        message = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return message.content[0].text
    except Exception as e:
        print(f"[ai_clients] call_claude ERROR: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return None


# -------------------------
# GPT-4o (OpenAI) client
# -------------------------

_openai_client = None


def get_openai_client():
    """Return a lazy-initialized OpenAI client."""
    global _openai_client
    if _openai_client is not None:
        return _openai_client

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None

    try:
        from openai import OpenAI
        _openai_client = OpenAI(api_key=api_key)
        return _openai_client
    except Exception:
        return None


def call_gpt4o(
    messages: list,
    temperature: float = 0.1,
    max_tokens: int = 800,
    model: str = "gpt-4o",
    response_format: Optional[dict] = None,
) -> Optional[str]:
    """
    Call GPT-4o and return the text content of the first choice.
    Pass response_format={"type": "json_object"} for structured output.
    Returns None on any error so the caller can fall back to templates.
    """
    client = get_openai_client()
    if client is None:
        return None

    try:
        kwargs = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if response_format:
            kwargs["response_format"] = response_format

        response = client.chat.completions.create(**kwargs)
        return response.choices[0].message.content
    except Exception as e:
        print(f"[ai_clients] call_gpt4o ERROR ({model}): {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return None


# -------------------------
# Gemini (Google) client
# -------------------------

_gemini_client = None


def get_gemini_client():
    """Return a lazy-initialized Google Gemini client."""
    global _gemini_client
    if _gemini_client is not None:
        return _gemini_client

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        _gemini_client = genai
        return _gemini_client
    except Exception:
        return None


def call_gemini(
    system: str,
    user: str,
    temperature: float = 0.7,
    max_tokens: int = 800,
    model: str = "gemini-1.5-pro",
) -> Optional[str]:
    """
    Call Gemini and return the text response.
    Returns None on any error so the caller can fall back.
    """
    client = get_gemini_client()
    if client is None:
        return None

    try:
        genai_model = client.GenerativeModel(
            model_name=model,
            system_instruction=system,
            generation_config={
                "temperature": temperature,
                "max_output_tokens": max_tokens,
            },
        )
        response = genai_model.generate_content(user)
        return response.text
    except Exception as e:
        print(f"[ai_clients] call_gemini ERROR ({model}): {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return None


# -------------------------
# Availability helpers
# -------------------------

def clients_available() -> dict:
    """Return which clients are available (for health checks and debug output)."""
    return {
        "grok": get_grok_client() is not None,
        "claude": get_claude_client() is not None,
        "gemini": get_gemini_client() is not None,
        "gpt4o": get_openai_client() is not None,
    }
