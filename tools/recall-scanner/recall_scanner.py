"""
OFFO Vehicle Recall Scanner

Daily pipeline (runs 6:30 AM EST via GitHub Actions):
  1. Load all saved vehicles from Supabase garage_vehicles that have a VIN
  2. For each vehicle: query NHTSA free API by make/model/year
  3. Grok scores each recall for routine impact (0-10 scale)
  4. Upsert to vehicle_recalls (UNIQUE on vehicle_id+recall_id — safe to re-run daily)
  5. Log run stats to recall_scan_log

NHTSA API is free, no key required.

Run:
    python recall_scanner.py
    python recall_scanner.py --dry-run   # scan and score without saving
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GROK_API_KEY = os.getenv("GROK_API_KEY")
SITE_URL = os.getenv("SITE_URL", "https://offolab.com")
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY")

NHTSA_RECALLS_URL = "https://api.nhtsa.gov/recalls/recallsByVehicle"

RECALL_CLASSIFIER_SYSTEM = """You are an EV ownership expert. Analyze this NHTSA recall and score how much it affects an EV owner's daily routine.

Daily routine impact: does this recall affect how they charge, how far they can drive, battery longevity, or whether the car is safe to drive day-to-day?

Score guide:
8-10: Battery fire or thermal runaway risk, charging port failure, software that bricks the car, loss of drive power while driving
5-7: Reduced range notification, charging speed reduction, minor software OTA required, mild battery performance concern
1-4: Cosmetic trim, non-critical software, minor convenience, seatbelt buckle, horn
0: Windshield wipers, seat hardware, clearly unrelated to EV systems

Output ONLY valid JSON (no markdown):
{
  "routine_impact_score": 0-10,
  "is_safety_critical": true or false,
  "affected_systems": ["battery", "charging", "software", "range", "safety", "other"],
  "ai_summary": "One sentence: how this recall affects the owner's daily EV routine.",
  "component": "SHORT CATEGORY IN CAPS (e.g. BATTERY, CHARGING PORT, SOFTWARE, BRAKES, POWERTRAIN)"
}"""


def _supabase_get(path: str, params: dict | None = None) -> Optional[list]:
    """Generic Supabase REST GET. Returns list or None on error."""
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/{path}",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
            },
            params=params or {},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"[recall-scanner] Supabase GET error ({path}): {e}", file=sys.stderr)
        return None


def _supabase_upsert(table: str, rows: list[dict]) -> bool:
    """Upsert rows into a Supabase table. Returns True on success."""
    if not rows:
        return True
    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates",
            },
            json=rows,
            timeout=20,
        )
        resp.raise_for_status()
        return True
    except Exception as e:
        print(f"[recall-scanner] Supabase upsert error ({table}): {e}", file=sys.stderr)
        return False


def _supabase_patch(table: str, row_id: str, fields: dict) -> bool:
    """PATCH a single row in a Supabase table by id."""
    try:
        resp = requests.patch(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            params={"id": f"eq.{row_id}"},
            json=fields,
            timeout=10,
        )
        resp.raise_for_status()
        return True
    except Exception as e:
        print(f"[recall-scanner] Supabase PATCH error ({table}): {e}", file=sys.stderr)
        return False


def _notify_new_recalls(vehicle_id: str, user_id: str, new_recall_ids: list[str]) -> None:
    """Call the Next.js email alert endpoint for newly detected recalls."""
    if not new_recall_ids or not ADMIN_API_KEY or not SITE_URL:
        return
    try:
        resp = requests.post(
            f"{SITE_URL}/api/email/recall-alert",
            headers={
                "Authorization": f"Bearer {ADMIN_API_KEY}",
                "Content-Type": "application/json",
            },
            json={"vehicle_id": vehicle_id, "user_id": user_id, "new_recall_ids": new_recall_ids},
            timeout=15,
        )
        if resp.status_code == 200:
            print(f"    [email] Recall alert sent for {len(new_recall_ids)} new recall(s)")
        else:
            print(f"    [email] Alert endpoint returned {resp.status_code}", file=sys.stderr)
    except Exception as e:
        print(f"[recall-scanner] Email alert error: {e}", file=sys.stderr)


def get_garage_vehicles_with_vin() -> list[dict]:
    """Fetch all garage vehicles that have a VIN set."""
    data = _supabase_get(
        "garage_vehicles",
        params={
            "vin": "not.is.null",
            "select": "id,user_id,vin,make,model,year",
        },
    )
    return data or []


def fetch_nhtsa_recalls(make: str, model: str, year: int) -> list[dict]:
    """
    Fetch recalls from NHTSA free API by make/model/year.
    Returns list of recall dicts or empty list.
    """
    try:
        resp = requests.get(
            NHTSA_RECALLS_URL,
            params={"make": make, "model": model, "modelYear": str(year)},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("results") or []
    except Exception as e:
        print(f"[recall-scanner] NHTSA error ({year} {make} {model}): {e}", file=sys.stderr)
        return []


def grok_score_recall(recall: dict) -> Optional[dict]:
    """Use Grok to score a single recall for routine impact. Returns dict or None."""
    if not GROK_API_KEY:
        return None

    text = (
        f"Recall campaign: {recall.get('NHTSACampaignNumber', '')}\n"
        f"Component: {recall.get('Component', '')}\n"
        f"Summary: {(recall.get('Summary') or '')[:400]}\n"
        f"Consequence: {(recall.get('Consequence') or '')[:200]}\n"
        f"Remedy: {(recall.get('Remedy') or '')[:200]}"
    )

    try:
        resp = requests.post(
            "https://api.x.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROK_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "grok-3-mini",
                "temperature": 0.0,
                "max_tokens": 250,
                "messages": [
                    {"role": "system", "content": RECALL_CLASSIFIER_SYSTEM},
                    {"role": "user", "content": text},
                ],
            },
            timeout=20,
        )
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"].strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
        return json.loads(raw)
    except Exception as e:
        print(f"[recall-scanner] Grok score error: {e}", file=sys.stderr)
        return None


def process_vehicle(vehicle: dict, dry_run: bool = False) -> tuple[int, int]:
    """
    Fetch and score all recalls for one vehicle.
    Returns (recalls_found, rows_upserted).
    """
    vehicle_id: str = vehicle["id"]
    user_id: str = vehicle.get("user_id", "")
    make: str = vehicle.get("make") or ""
    model: str = vehicle.get("model") or ""
    year: int = int(vehicle.get("year") or 0)
    vin: str = vehicle.get("vin") or ""

    if not (make and model and year):
        print(f"  [skip] {vehicle_id} — missing make/model/year")
        return 0, 0

    print(f"  Scanning {year} {make} {model} (VIN: {vin[:8]}...)")
    raw_recalls = fetch_nhtsa_recalls(make, model, year)

    if not raw_recalls:
        print(f"    No recalls found")
        return 0, 0

    print(f"    Found {len(raw_recalls)} recall(s) from NHTSA")
    rows: list[dict] = []

    for recall in raw_recalls:
        campaign_id = recall.get("NHTSACampaignNumber") or recall.get("RecallNumber") or ""
        if not campaign_id:
            continue

        scored = grok_score_recall(recall)
        time.sleep(0.2)  # rate limit protection

        row = {
            "vehicle_id": vehicle_id,
            "user_id": user_id,
            "recall_id": campaign_id,
            "source": "nhtsa",
            "title": (recall.get("Summary") or recall.get("Component") or "Recall")[:200],
            "description": (recall.get("Summary") or "")[:500],
            "consequence": (recall.get("Consequence") or "")[:300],
            "remedy": (recall.get("Remedy") or "")[:300],
            "manufacturer": recall.get("Manufacturer") or "",
            "recall_date": (recall.get("ReportReceivedDate") or "")[:10] or None,
            "component": (
                (scored or {}).get("component")
                or (recall.get("Component") or "")[:100]
            ),
            "routine_impact_score": int((scored or {}).get("routine_impact_score") or 0),
            "affected_systems": (scored or {}).get("affected_systems") or [],
            "ai_summary": (scored or {}).get("ai_summary") or "",
            "is_safety_critical": bool((scored or {}).get("is_safety_critical", False)),
            "status": "active",
        }
        rows.append(row)

        score_str = f"{row['routine_impact_score']}/10"
        critical_str = " ⚠️ SAFETY CRITICAL" if row["is_safety_critical"] else ""
        print(f"    {campaign_id}: {row['component']} — impact {score_str}{critical_str}")

    if dry_run:
        print(f"    [DRY RUN] Would upsert {len(rows)} recall(s)")
        return len(raw_recalls), 0

    if rows:
        ok = _supabase_upsert("vehicle_recalls", rows)
        if ok:
            # Update last_recall_check timestamp on the vehicle
            _supabase_patch("garage_vehicles", vehicle_id, {
                "last_recall_check": datetime.now(timezone.utc).isoformat(),
            })

            # Check which recalls are newly inserted (notified_at IS NULL)
            saved = _supabase_get(
                "vehicle_recalls",
                params={
                    "vehicle_id": f"eq.{vehicle_id}",
                    "notified_at": "is.null",
                    "status": "eq.active",
                    "select": "recall_id",
                },
            ) or []
            new_ids = [r["recall_id"] for r in saved]
            if new_ids:
                _notify_new_recalls(vehicle_id, user_id, new_ids)

            return len(raw_recalls), len(rows)

    return len(raw_recalls), 0


def run_recall_scan(dry_run: bool = False) -> None:
    start_ms = int(time.time() * 1000)
    print(f"[recall-scanner] Starting scan — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[recall-scanner] ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set", file=sys.stderr)
        sys.exit(1)

    vehicles = get_garage_vehicles_with_vin()
    print(f"[recall-scanner] {len(vehicles)} vehicles with VIN in garage")

    if not vehicles:
        print("[recall-scanner] Nothing to scan — exiting")
        return

    total_found = 0
    total_new = 0
    errors = 0

    for v in vehicles:
        try:
            found, new = process_vehicle(v, dry_run=dry_run)
            total_found += found
            total_new += new
        except Exception as e:
            print(f"[recall-scanner] Error processing vehicle {v.get('id')}: {e}", file=sys.stderr)
            errors += 1
        time.sleep(0.5)  # rate limit NHTSA

    duration_ms = int(time.time() * 1000) - start_ms

    # Log run stats
    if not dry_run:
        _supabase_upsert("recall_scan_log", [{
            "vehicles_scanned": len(vehicles),
            "recalls_found": total_found,
            "new_recalls": total_new,
            "errors": errors,
            "duration_ms": duration_ms,
            "run_by": "cron",
        }])

    print(
        f"\n[recall-scanner] Done — "
        f"scanned {len(vehicles)} vehicles, "
        f"found {total_found} recalls, "
        f"{total_new} new/updated, "
        f"{errors} errors "
        f"({duration_ms}ms)"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OFFO Vehicle Recall Scanner")
    parser.add_argument("--dry-run", action="store_true", help="Scan and score without saving to Supabase")
    args = parser.parse_args()
    run_recall_scan(dry_run=args.dry_run)
