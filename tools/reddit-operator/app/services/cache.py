"""
AiCache — two-tier cache for LLM task results.

Tier 1: in-memory LRU dict (fast, process-local, lost on restart)
Tier 2: Supabase table `ai_cache` (persistent, shared across instances)

Key format: sha256(task_id + sorted JSON of inputs)

The cache is used by chain_runner.run_task() when task.cache_ttl_s > 0.
Currently used for:
  - copart_analyze (24h TTL) — lot data is immutable once archived
  - Any future tasks registered with cache_ttl_s > 0

Supabase table DDL (run once):
    CREATE TABLE IF NOT EXISTS ai_cache (
      cache_key TEXT PRIMARY KEY,
      task_id   TEXT NOT NULL,
      value     JSONB NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX ON ai_cache (expires_at);
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from collections import OrderedDict
from typing import Optional


# Simple in-memory LRU (no external deps)
_MAX_MEMORY_ENTRIES = 500


class _LRUCache:
    def __init__(self, maxsize: int = _MAX_MEMORY_ENTRIES):
        self._store: OrderedDict[str, tuple[dict, float]] = OrderedDict()  # key → (value, expires_ts)
        self._maxsize = maxsize

    def get(self, key: str) -> Optional[dict]:
        if key not in self._store:
            return None
        value, expires_ts = self._store[key]
        if time.time() > expires_ts:
            del self._store[key]
            return None
        self._store.move_to_end(key)
        return value

    def set(self, key: str, value: dict, ttl_s: int) -> None:
        if key in self._store:
            self._store.move_to_end(key)
        self._store[key] = (value, time.time() + ttl_s)
        if len(self._store) > self._maxsize:
            self._store.popitem(last=False)


class AiCache:
    """Two-tier AI result cache."""

    def __init__(self) -> None:
        self._memory = _LRUCache()
        self._supabase_available: Optional[bool] = None  # lazy-checked

    def make_key(self, task_id: str, inputs: dict) -> str:
        """Deterministic cache key: sha256 of task_id + sorted-key JSON of inputs."""
        payload = json.dumps({"task_id": task_id, **inputs}, sort_keys=True, ensure_ascii=True)
        return hashlib.sha256(payload.encode()).hexdigest()

    def get(self, key: str) -> Optional[dict]:
        # Tier 1: memory
        val = self._memory.get(key)
        if val is not None:
            return val

        # Tier 2: Supabase
        val = self._supabase_get(key)
        if val is not None:
            # Warm memory cache (short TTL — exact TTL unknown at this point, use 5 min)
            self._memory.set(key, val, 300)
        return val

    def set(self, key: str, value: dict, ttl_s: int) -> None:
        self._memory.set(key, value, ttl_s)
        self._supabase_set(key, value, ttl_s)

    # ------------------------------------------------------------------
    # Supabase tier (best-effort — failures are logged, never raised)
    # ------------------------------------------------------------------

    def _get_supabase(self):
        """Lazy-init Supabase client. Returns None if not configured."""
        if self._supabase_available is False:
            return None
        try:
            from supabase import create_client
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            if not url or not key:
                self._supabase_available = False
                return None
            self._supabase_available = True
            return create_client(url, key)
        except Exception as e:
            print(f"[ai_cache] Supabase init failed: {e}", file=sys.stderr)
            self._supabase_available = False
            return None

    def _supabase_get(self, key: str) -> Optional[dict]:
        sb = self._get_supabase()
        if sb is None:
            return None
        try:
            from datetime import datetime, timezone
            now_iso = datetime.now(timezone.utc).isoformat()
            result = (
                sb.table("ai_cache")
                .select("value")
                .eq("cache_key", key)
                .gt("expires_at", now_iso)
                .limit(1)
                .execute()
            )
            if result.data:
                return result.data[0]["value"]
        except Exception as e:
            print(f"[ai_cache] Supabase get failed: {e}", file=sys.stderr)
        return None

    def _supabase_set(self, key: str, value: dict, ttl_s: int) -> None:
        sb = self._get_supabase()
        if sb is None:
            return
        try:
            from datetime import datetime, timezone, timedelta
            expires_at = (datetime.now(timezone.utc) + timedelta(seconds=ttl_s)).isoformat()
            sb.table("ai_cache").upsert({
                "cache_key": key,
                "task_id": "",  # caller can enrich if needed
                "value": value,
                "expires_at": expires_at,
            }).execute()
        except Exception as e:
            print(f"[ai_cache] Supabase set failed (non-critical): {e}", file=sys.stderr)


# Module-level singleton — import this directly
_cache = AiCache()
