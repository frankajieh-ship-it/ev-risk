"""
Async AI Job Queue — asyncio.Queue-based background job runner.

Used for batch operations that shouldn't block request handlers:
  - batch_copart_scan:      scan N Copart lot numbers in parallel
  - dealer_inventory_match: match a buyer profile to dealer inventory

Jobs are persisted to Supabase `ai_jobs` table so status survives restarts.

Supabase DDL (run once):
    CREATE TABLE IF NOT EXISTS ai_jobs (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_type     TEXT NOT NULL,
      payload      JSONB NOT NULL,
      status       TEXT NOT NULL DEFAULT 'queued',
      result       JSONB,
      error        TEXT,
      created_at   TIMESTAMPTZ DEFAULT now(),
      completed_at TIMESTAMPTZ
    );
    CREATE INDEX ON ai_jobs (status);
    CREATE INDEX ON ai_jobs (created_at DESC);

Usage:
    # In FastAPI startup:
    from app.jobs.ai_jobs import job_queue
    asyncio.create_task(job_queue.start_worker())

    # In endpoint:
    job_id = await job_queue.enqueue("batch_copart_scan", {"lot_numbers": ["12345","67890"]})
    # Client polls GET /jobs/{job_id}

    status = await job_queue.get_status(job_id)
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal, Optional


JobStatus = Literal["queued", "running", "done", "error"]


@dataclass
class JobRecord:
    job_id: str
    job_type: str
    payload: dict
    status: JobStatus = "queued"
    result: Optional[dict] = None
    error: Optional[str] = None


class AiJobQueue:
    """
    asyncio.Queue-based job runner with Supabase persistence.
    One worker processes jobs serially; each job may internally parallelize.
    """

    def __init__(self) -> None:
        self._queue: asyncio.Queue[JobRecord] = asyncio.Queue()
        self._running = False
        # In-process status store (survives within session; Supabase is authoritative)
        self._local: dict[str, JobRecord] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def enqueue(self, job_type: str, payload: dict) -> str:
        """Enqueue a job. Returns job_id immediately."""
        job_id = str(uuid.uuid4())
        record = JobRecord(job_id=job_id, job_type=job_type, payload=payload)
        self._local[job_id] = record
        await self._persist(record)
        await self._queue.put(record)
        return job_id

    async def get_status(self, job_id: str) -> Optional[JobRecord]:
        """Return current status from local cache first, then Supabase."""
        local = self._local.get(job_id)
        if local:
            return local
        return await self._fetch_from_supabase(job_id)

    async def start_worker(self) -> None:
        """Run the background worker loop. Call once at app startup."""
        if self._running:
            return
        self._running = True
        print("[ai_jobs] Worker started", file=sys.stderr)
        while True:
            try:
                record = await self._queue.get()
                await self._process(record)
                self._queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[ai_jobs] Worker loop error: {e}", file=sys.stderr)

    # ------------------------------------------------------------------
    # Job handlers
    # ------------------------------------------------------------------

    async def _process(self, record: JobRecord) -> None:
        record.status = "running"
        await self._persist(record)

        try:
            if record.job_type == "batch_copart_scan":
                result = await self._run_batch_copart_scan(record.payload)
            elif record.job_type == "dealer_inventory_match":
                result = await self._run_dealer_inventory_match(record.payload)
            else:
                raise ValueError(f"Unknown job type: {record.job_type}")

            record.status = "done"
            record.result = result

        except Exception as e:
            print(f"[ai_jobs] Job {record.job_id} ({record.job_type}) failed: {e}", file=sys.stderr)
            record.status = "error"
            record.error = str(e)

        await self._persist(record)

    async def _run_batch_copart_scan(self, payload: dict) -> dict:
        """
        Scan a list of Copart lot numbers.
        Runs each lot through the copart_analyze task (cached 24h per lot).

        payload: {"lot_numbers": ["12345", "67890", ...]}
        returns: {"results": [{"lot_number": ..., "analysis": ...}, ...], "total": N, "errors": N}
        """
        lot_numbers: list[str] = payload.get("lot_numbers", [])
        if not lot_numbers:
            return {"results": [], "total": 0, "errors": 0}

        from app.ai.task_types import get_task
        from app.ai.chain_runner import run_task
        from app.ai.prompt_registry import get_prompt

        results = []
        errors = 0

        for lot_number in lot_numbers:
            try:
                # Fetch lot data from Copart (via shared helper)
                lot_data = await _fetch_copart_lot(lot_number)

                # Build messages for the analysis task
                task = get_task("copart_analyze")
                prompt = get_prompt(task.prompt_key)
                messages = [
                    {"role": "system", "content": prompt.system_template},
                    {"role": "user", "content": f"Lot number: {lot_number}\n\nLot data:\n{lot_data}"},
                ]

                # Run in thread (blocking call) to not block event loop
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, run_task, task, messages, None)

                results.append({
                    "lot_number": lot_number,
                    "status": result.status,
                    "analysis": result.parsed_output,
                    "duration_ms": result.duration_ms,
                })
            except Exception as e:
                errors += 1
                results.append({
                    "lot_number": lot_number,
                    "status": "error",
                    "analysis": None,
                    "error": str(e),
                })

        return {
            "results": results,
            "total": len(lot_numbers),
            "errors": errors,
        }

    async def _run_dealer_inventory_match(self, payload: dict) -> dict:
        """
        Match a buyer profile against dealer inventory.

        payload: {"buyer_profile": {...}, "inventory": [...]}
        returns: {"matches": [...ranked vehicles...]}
        """
        buyer_profile = payload.get("buyer_profile", {})
        inventory = payload.get("inventory", [])

        if not buyer_profile or not inventory:
            return {"matches": []}

        best_vehicles = buyer_profile.get("best_vehicles", [])
        priorities = buyer_profile.get("priorities", [])

        # Score each inventory item against profile
        scored = []
        for vehicle in inventory:
            score = 0
            label = f"{vehicle.get('year', '')} {vehicle.get('make', '')} {vehicle.get('model', '')}".lower()

            # Simple keyword match against recommended vehicles
            for rec in best_vehicles:
                if any(word in label for word in rec.lower().split()):
                    score += 2

            # Penalize if price exceeds buyer budget signal
            budget = buyer_profile.get("budget_max_usd")
            if budget and vehicle.get("price") and vehicle["price"] > budget:
                score -= 1

            scored.append({**vehicle, "_match_score": score})

        # Return sorted by match score
        scored.sort(key=lambda v: v["_match_score"], reverse=True)
        return {"matches": scored[:10]}

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------

    async def _persist(self, record: JobRecord) -> None:
        """Write job state to Supabase (best-effort, non-blocking)."""
        try:
            sb = _get_supabase()
            if sb is None:
                return

            from datetime import datetime, timezone
            now_iso = datetime.now(timezone.utc).isoformat()
            row: dict[str, Any] = {
                "id": record.job_id,
                "job_type": record.job_type,
                "payload": record.payload,
                "status": record.status,
            }
            if record.result is not None:
                row["result"] = record.result
            if record.error is not None:
                row["error"] = record.error
            if record.status in ("done", "error"):
                row["completed_at"] = now_iso

            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: sb.table("ai_jobs").upsert(row).execute()
            )
        except Exception as e:
            print(f"[ai_jobs] Supabase persist failed (non-critical): {e}", file=sys.stderr)

    async def _fetch_from_supabase(self, job_id: str) -> Optional[JobRecord]:
        sb = _get_supabase()
        if sb is None:
            return None
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: sb.table("ai_jobs").select("*").eq("id", job_id).limit(1).execute()
            )
            if result.data:
                row = result.data[0]
                return JobRecord(
                    job_id=row["id"],
                    job_type=row["job_type"],
                    payload=row["payload"],
                    status=row["status"],
                    result=row.get("result"),
                    error=row.get("error"),
                )
        except Exception as e:
            print(f"[ai_jobs] Supabase fetch failed: {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_supabase():
    """Return a Supabase client or None if not configured."""
    try:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            return None
        return create_client(url, key)
    except Exception:
        return None


async def _fetch_copart_lot(lot_number: str) -> str:
    """
    Fetch Copart lot data.
    Mirrors the TypeScript ev-risk /api/copart/lot endpoint approach (Apify actor).
    Returns a plain-text summary suitable for injection into an LLM prompt.
    """
    import httpx

    apify_token = os.getenv("APIFY_API_TOKEN")
    if not apify_token:
        return f"Lot {lot_number}: Copart data unavailable (no APIFY_API_TOKEN configured)"

    actor_url = "https://api.apify.com/v2/acts/epctex~copart-scraper/run-sync-get-dataset-items"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                actor_url,
                headers={"Authorization": f"Bearer {apify_token}"},
                json={"lotNumbers": [lot_number]},
            )
            if resp.status_code != 200:
                return f"Lot {lot_number}: Copart fetch failed (HTTP {resp.status_code})"

            data = resp.json()
            if not data:
                return f"Lot {lot_number}: No data returned from Copart"

            lot = data[0] if isinstance(data, list) else data
            # Build a readable summary for the LLM
            lines = [
                f"Lot Number: {lot_number}",
                f"Vehicle: {lot.get('year', '?')} {lot.get('make', '?')} {lot.get('model', '?')} {lot.get('trim', '')}",
                f"VIN: {lot.get('vin', 'Unknown')}",
                f"Odometer: {lot.get('odometer', 'Unknown')} miles",
                f"Primary Damage: {lot.get('primaryDamage', 'Unknown')}",
                f"Secondary Damage: {lot.get('secondaryDamage', 'None')}",
                f"Loss Type: {lot.get('lossType', 'Unknown')}",
                f"Title: {lot.get('titleType', 'Unknown')}",
                f"Est. Retail Value: ${lot.get('estimatedRetailValue', 'Unknown')}",
                f"Current Bid: ${lot.get('currentBid', 'N/A')}",
                f"Cylinders: {lot.get('cylinders', 'N/A')}",
                f"Drive: {lot.get('driveType', 'N/A')}",
                f"Fuel Type: {lot.get('fuelType', 'N/A')}",
                f"Location: {lot.get('location', 'Unknown')}",
                f"Sale Date: {lot.get('saleDate', 'TBD')}",
            ]
            return "\n".join(lines)

    except Exception as e:
        return f"Lot {lot_number}: Copart fetch error — {e}"


# Module-level singleton
job_queue = AiJobQueue()
