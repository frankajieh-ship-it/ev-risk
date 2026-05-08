"""
HEAD-checks every Wikimedia URL in lib/vehicle-photo.ts.
Exits non-zero only if a URL returns 404/410 (file genuinely gone) or a connection error.
429 (rate-limited) is treated as inconclusive — the file exists, CDN is throttling our checker.

Run locally:  python tools/check-photo-urls.py
Run in CI:    see .github/workflows/photo-url-health.yml
"""

import re
import sys
import time

import requests

VEHICLE_PHOTO_PATH = "lib/vehicle-photo.ts"
TIMEOUT = 10
# Sequential with delay to avoid CDN rate-limiting.
REQUEST_DELAY = 0.5  # seconds between requests

# A browser UA is required — bare Python requests get 403.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

# Only these statuses mean the file is genuinely gone.
DEAD_STATUSES = {404, 410}


def check_url(url: str) -> tuple[str, int | str]:
    """HEAD-check a URL, falling back to streaming GET on 403/405."""
    try:
        r = requests.head(url, timeout=TIMEOUT, allow_redirects=True, headers=HEADERS)
        if r.status_code in (403, 405):
            r = requests.get(url, timeout=TIMEOUT, allow_redirects=True,
                             headers=HEADERS, stream=True)
            r.close()
        return url, r.status_code
    except Exception as e:
        return url, str(e)


def main() -> int:
    with open(VEHICLE_PHOTO_PATH, encoding="utf-8") as f:
        content = f.read()

    urls = sorted(set(re.findall(r"https://upload\.wikimedia\.org[^\s\"']+", content)))

    if not urls:
        print("No Wikimedia URLs found — check VEHICLE_PHOTO_PATH.")
        return 1

    print(f"Checking {len(urls)} Wikimedia URLs (sequential, {REQUEST_DELAY}s delay) ...\n")

    failures: list[tuple[str, int | str]] = []
    skipped: list[str] = []

    for url in urls:
        url, status = check_url(url)
        if status == 200:
            print(f"  OK   200  {url}")
        elif status == 429 or status == 503:
            # Rate-limited or overloaded — file exists, CDN is throttling.
            print(f"  SKIP {status}  {url}")
            skipped.append(url)
        elif status in DEAD_STATUSES or isinstance(status, str):
            print(f"  FAIL {status}  {url}")
            failures.append((url, status))
        else:
            # Any other unexpected status (5xx etc.) — flag but don't block.
            print(f"  WARN {status}  {url}")
        time.sleep(REQUEST_DELAY)

    print()
    if skipped:
        print(f"  {len(skipped)} URL(s) rate-limited (429/503) — likely fine, rerun later to confirm.")
        print()

    if failures:
        print(f"{len(failures)} DEAD URL(s) found — fix before deploying:")
        for url, status in failures:
            print(f"  {status}  {url}")
        return 1

    print(f"All {len(urls)} URLs checked: 0 dead.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
