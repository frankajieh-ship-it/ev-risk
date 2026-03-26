"""
EV Market Analytics — Stage 3.5 of the OFFO Reddit Operator pipeline.

Fetches real-time local pricing data from Auto.dev Listings API and caches
results per VIN for 24 hours in Supabase to avoid redundant API calls.

Only invoked when Grok Stage 1 sets needs_market_data = true, which happens
for listing_rating, pricing_deal, compare_listings, and dealer_upload intents.

Public API:
    get_market_analytics(vin, zip_code, listing_price, make, model, year) -> dict | None
    format_market_context(data) -> str   # compact string for LLM injection
"""
from __future__ import annotations

import os
import time
from typing import Optional
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

AUTO_DEV_API_KEY = os.getenv("AUTO_DEV_API_KEY", "")
AUTO_DEV_BASE    = "https://auto.dev/api"

# How long to cache a result (seconds)
CACHE_TTL_SECONDS = 86_400  # 24 hours


# -------------------------
# Auto.dev HTTP helpers
# -------------------------

def _headers() -> dict:
    return {
        "Authorization": f"Bearer {AUTO_DEV_API_KEY}",
        "Accept": "application/json",
    }


def _fetch_listings_by_vin(vin: str, zip_code: Optional[str] = None) -> Optional[dict]:
    """
    Query Auto.dev /listings filtered by VIN.
    Returns raw response dict or None on failure.
    """
    if not AUTO_DEV_API_KEY:
        return None

    try:
        import requests
        params: dict = {"vin": vin}
        if zip_code:
            params["zip"] = zip_code
            params["radius"] = 100

        resp = requests.get(
            f"{AUTO_DEV_BASE}/listings",
            headers=_headers(),
            params=params,
            timeout=8,
        )
        if resp.status_code == 200:
            return resp.json()
        return None
    except Exception:
        return None


def _fetch_listings_by_ymm(
    year: Optional[int],
    make: Optional[str],
    model: Optional[str],
    zip_code: Optional[str] = None,
) -> Optional[dict]:
    """
    Query Auto.dev /listings by year/make/model when no VIN is available.
    Used as fallback for pricing_deal and compare_listings intents.
    """
    if not AUTO_DEV_API_KEY or not (make and model):
        return None

    try:
        import requests
        params: dict = {}
        if year:
            params["year"] = year
        if make:
            params["make"] = make
        if model:
            params["model"] = model
        if zip_code:
            params["zip"] = zip_code
            params["radius"] = 75

        resp = requests.get(
            f"{AUTO_DEV_BASE}/listings",
            headers=_headers(),
            params=params,
            timeout=8,
        )
        if resp.status_code == 200:
            return resp.json()
        return None
    except Exception:
        return None


# -------------------------
# Data processing
# -------------------------

def _process_listings(raw: dict, listing_price: Optional[int] = None) -> Optional[dict]:
    """
    Extract market intelligence from a raw Auto.dev listings response.

    Returns:
        {
            local_comps: list of {price, mileage, year, trim, dealer_type},
            average_price: int,
            price_percentile: int (0-100),  # where listing_price sits vs comps
            median_price: int,
            price_spread: str,              # e.g. "$22k–$31k"
            sample_size: int,
            depreciation_trend: str | None, # e.g. "–8% over 12 months"
            regional_demand: int | None,    # 1-10 if available
            source: "auto_dev",
        }
    """
    records = raw.get("records") or raw.get("listings") or raw.get("data") or []
    if not records:
        return None

    prices = []
    comps = []
    for r in records[:30]:  # cap at 30 for processing
        price = r.get("price") or r.get("listing_price")
        if price and isinstance(price, (int, float)) and price > 1000:
            prices.append(int(price))
            comps.append({
                "price": int(price),
                "mileage": r.get("miles") or r.get("mileage"),
                "year": r.get("year"),
                "trim": r.get("trim"),
                "dealer_type": r.get("seller_type") or r.get("dealer_type"),
            })

    if len(prices) < 2:
        return None

    prices_sorted = sorted(prices)
    avg = int(sum(prices) / len(prices))
    median = prices_sorted[len(prices_sorted) // 2]
    lo, hi = prices_sorted[0], prices_sorted[-1]

    # Price percentile: where does listing_price sit in the distribution?
    percentile = None
    if listing_price and listing_price > 0:
        below = sum(1 for p in prices if p >= listing_price)
        percentile = int((below / len(prices)) * 100)

    # Compact spread string
    def _kstr(n: int) -> str:
        return f"${n // 1000}k" if n >= 1000 else f"${n}"

    spread = f"{_kstr(lo)}–{_kstr(hi)}"

    return {
        "local_comps": comps[:5],       # top 5 for display
        "average_price": avg,
        "median_price": median,
        "price_spread": spread,
        "price_percentile": percentile, # None if no listing_price
        "sample_size": len(prices),
        "depreciation_trend": None,     # Auto.dev doesn't provide this directly
        "regional_demand": None,        # not in current endpoint
        "source": "auto_dev",
    }


# -------------------------
# Cache layer (Supabase)
# -------------------------

def _cache_key(vin: Optional[str], make: Optional[str], model: Optional[str], year: Optional[int]) -> str:
    """Generate a deterministic cache key."""
    if vin:
        return f"vin:{vin.upper()}"
    parts = filter(None, [str(year) if year else None, (make or "").lower(), (model or "").lower()])
    return "ymm:" + ":".join(parts)


def _get_cached(key: str) -> Optional[dict]:
    """Return cached market data if present and not expired."""
    try:
        from db import _client
        result = (
            _client()
            .table("market_cache")
            .select("data, fetched_at")
            .eq("cache_key", key)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            return None
        row = rows[0]
        # Check TTL
        fetched_str = row.get("fetched_at", "")
        if fetched_str:
            import datetime
            fetched = datetime.datetime.fromisoformat(fetched_str.replace("Z", "+00:00"))
            age = (datetime.datetime.now(datetime.timezone.utc) - fetched).total_seconds()
            if age > CACHE_TTL_SECONDS:
                return None
        return row.get("data")
    except Exception:
        return None


def _set_cached(key: str, data: dict) -> None:
    """Upsert market data into cache (fire-and-forget)."""
    try:
        from db import _client
        _client().table("market_cache").upsert({
            "cache_key": key,
            "data": data,
            "fetched_at": "now()",
        }).execute()
    except Exception:
        pass


# -------------------------
# Public API
# -------------------------

def get_market_analytics(
    vin: Optional[str] = None,
    zip_code: Optional[str] = None,
    listing_price: Optional[int] = None,
    make: Optional[str] = None,
    model: Optional[str] = None,
    year: Optional[int] = None,
) -> Optional[dict]:
    """
    Fetch market analytics for a vehicle.

    Tries cache first (24h TTL). On miss, calls Auto.dev then caches result.
    Returns None if Auto.dev key is missing, API fails, or < 2 comps found.
    Falls back from VIN lookup to YMM lookup automatically.

    Returns:
        {
            local_comps, average_price, median_price, price_spread,
            price_percentile, sample_size, depreciation_trend,
            regional_demand, source
        }
    """
    if not AUTO_DEV_API_KEY:
        return None

    key = _cache_key(vin, make, model, year)
    cached = _get_cached(key)
    if cached:
        # Recalculate percentile in case listing_price differs from cache
        if listing_price and cached.get("average_price"):
            comps_prices = [c["price"] for c in (cached.get("local_comps") or []) if c.get("price")]
            if comps_prices:
                below = sum(1 for p in comps_prices if p >= listing_price)
                cached["price_percentile"] = int((below / len(comps_prices)) * 100)
        return cached

    # Cache miss — fetch from Auto.dev
    raw = None
    if vin:
        raw = _fetch_listings_by_vin(vin, zip_code)
    if not raw:
        raw = _fetch_listings_by_ymm(year, make, model, zip_code)

    if not raw:
        return None

    processed = _process_listings(raw, listing_price)
    if not processed:
        return None

    _set_cached(key, processed)
    return processed


# -------------------------
# LLM context formatter
# -------------------------

def format_market_context(data: Optional[dict], intent: str = "") -> str:
    """
    Convert market analytics dict into a compact string for LLM injection.

    Examples:
        "Local market: 14 comps avg $26.8k (range $23k–$31k). This listing is in the 18th percentile."
        "Local market: 8 comps avg $29k. No listing price provided for percentile comparison."
    """
    if not data:
        return ""

    avg = data.get("average_price")
    spread = data.get("price_spread")
    n = data.get("sample_size", 0)
    percentile = data.get("price_percentile")
    demand = data.get("regional_demand")

    if not avg or not n:
        return ""

    def _kstr(v: int) -> str:
        return f"${v // 1000:.0f}k" if v >= 10_000 else f"${v:,}"

    parts = [f"Local market ({n} comps): avg {_kstr(avg)}"]
    if spread:
        parts.append(f"range {spread}")
    context = ", ".join(parts) + "."

    if percentile is not None:
        if percentile <= 20:
            context += f" This listing is in the {percentile}th percentile — priced below most local comps."
        elif percentile <= 45:
            context += f" This listing is in the {percentile}th percentile — slightly below average locally."
        elif percentile <= 65:
            context += f" This listing is near the median (about {percentile}th percentile locally)."
        else:
            context += f" This listing is in the {percentile}th percentile — priced above most local comps."

    if demand and intent == "dealer_upload":
        context += f" Local demand score: {demand}/10."

    return context
