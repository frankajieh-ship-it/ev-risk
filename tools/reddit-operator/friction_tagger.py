"""
Friction tagger for Reddit posts.
Pattern-based extraction of friction tags aligned with ev-risk taxonomy.
"""
from __future__ import annotations

import re
from typing import List


# -------------------------
# Pattern definitions for each friction tag
# -------------------------

FRICTION_PATTERNS = {
    # Charging access
    "NO_HOME_CHARGING": [
        r"\bno home\b",
        r"\bapartment\b",
        r"\bflat\b",
        r"\bcondo\b",
        r"\brental\b",
        r"\bpublic charging\b",
        r"\bcan.?t charge at home\b",
        r"\bno garage\b",
        r"\bstreet parking\b",
        r"\bno dedicated parking\b",
    ],
    "HOME_CHARGING_AVAILABLE": [
        r"\bhome charging\b",
        r"\bl2 at home\b",
        r"\bwallbox\b",
        r"\bgarage\b",
        r"\bdriveway\b",
        r"\bcharge at home\b",
        r"\binstalled a charger\b",
        r"\bhome outlet\b",
        r"\bnema 14-50\b",
    ],
    "PUBLIC_ANCHOR_PRESENT": [
        r"\bwork charger\b",
        r"\boffice charging\b",
        r"\bcharging at work\b",
        r"\bregular spot\b",
        r"\bsame charger\b",
        r"\breliable station\b",
    ],

    # Predictability
    "PREDICTABILITY_HIGH": [
        r"\breliable\b",
        r"\banchor\b",
        r"\bevery week\b",
        r"\bsame place\b",
        r"\bconsistent\b",
        r"\broutine\b",
        r"\bpredictable\b",
    ],
    "PREDICTABILITY_LOW": [
        r"\bunreliable\b",
        r"\bqueue\b",
        r"\bbroken\b",
        r"\balways busy\b",
        r"\binconsistent\b",
        r"\bnever available\b",
        r"\bcan.?t count on\b",
        r"\bhit or miss\b",
        r"\bice.?d\b",  # ICE'd (blocked by gas cars)
    ],

    # Seasonal
    "SEASONAL_SENSITIVITY": [
        r"\bwinter\b",
        r"\bcold\b",
        r"\bfreezing\b",
        r"\bsnow\b",
        r"\bice\b",
        r"\brange loss\b.*\bwinter\b",
        r"\bheating\b",
        r"\bpreconditioning\b",
    ],

    # Planning tolerance
    "PLANNING_TOLERANCE_LOW": [
        r"\bdon.?t want to think\b",
        r"\bmental overhead\b",
        r"\bmicromanage\b",
        r"\bhate planning\b",
        r"\bjust want to drive\b",
        r"\bspontaneous\b",
        r"\bdon.?t want to plan\b",
        r"\bstress\b",
        r"\banxiety\b",
    ],
    "PLANNING_TOLERANCE_HIGH": [
        r"\bi don.?t mind planning\b",
        r"\bi plan ahead\b",
        r"\bfine with planning\b",
        r"\bi.?m organized\b",
        r"\bi track\b",
        r"\bi schedule\b",
    ],

    # Routine variability
    "ROUTINE_VARIABILITY_HIGH": [
        r"\bunpredictable\b",
        r"\bvariable\b",
        r"\bdifferent every\b",
        r"\bnever the same\b",
        r"\bchanges often\b",
        r"\btravel a lot\b",
        r"\broad trips\b",
        r"\blong distance\b",
    ],

    # Comparison
    "COMPARING_TWO_OPTIONS": [
        r"\bvs\b",
        r"\bversus\b",
        r"\bcompare\b",
        r"\boption\b",
        r"\bwhich\b.*\bor\b",
        r"\bbetween\b",
        r"\bchoose\b",
        r"\bdecide\b",
    ],

    # Battery health
    "BATTERY_HEALTH_ANXIETY": [
        r"\bsoh\b",
        r"\bbattery health\b",
        r"\bdegradation\b",
        r"\bbattery life\b",
        r"\brange loss\b",
        r"\bhow long\b.*\bbattery\b",
        r"\bbattery warranty\b",
        r"\breplacement cost\b",
    ],

    # Software tolerance
    "SOFTWARE_TOLERANCE_UNKNOWN": [
        r"\bsoftware\b",
        r"\bupdate\b",
        r"\bbug\b",
        r"\bglitch\b",
        r"\bota\b",
        r"\bapp\b.*\bcar\b",
        r"\bconnectivity\b",
    ],

    # Brand war risk
    "BRAND_WAR_RISK": [
        r"\btesla fan\b",
        r"\btrash\b",
        r"\bsuperiority\b",
        r"\bfanboy\b",
        r"\bidiot\b",
        r"\bstupid\b",
        r"\bdumb\b",
        r"\bworse\b.*\bthan\b",
        r"\bbetter\b.*\bthan\b.*\balways\b",
        r"\boverpriced\b",
        r"\boverhyped\b",
    ],
}


def _has_any(text: str, patterns: List[str]) -> bool:
    """Check if text matches any of the regex patterns."""
    t = text.lower()
    return any(re.search(p, t) for p in patterns)


def tag_frictions(text: str) -> List[str]:
    """
    Extract friction tags from post text.

    Returns a deduplicated list of friction tags in order of detection.
    """
    t = text.lower()
    tags: List[str] = []

    for tag, patterns in FRICTION_PATTERNS.items():
        if _has_any(t, patterns):
            tags.append(tag)

    # Remove contradictory tags (keep the one that appears first)
    contradictions = [
        ("HOME_CHARGING_AVAILABLE", "NO_HOME_CHARGING"),
        ("PREDICTABILITY_HIGH", "PREDICTABILITY_LOW"),
        ("PLANNING_TOLERANCE_HIGH", "PLANNING_TOLERANCE_LOW"),
    ]

    for tag_a, tag_b in contradictions:
        if tag_a in tags and tag_b in tags:
            # If both present, the context is ambiguous - keep both for operator review
            # But typically we'd remove one based on which appears first
            pass

    # Deduplicate while preserving order
    seen = set()
    out = []
    for tag in tags:
        if tag not in seen:
            seen.add(tag)
            out.append(tag)

    return out


def get_primary_friction(tags: List[str]) -> str | None:
    """
    Get the most significant friction tag for reply templating.

    Priority order:
    1. NO_HOME_CHARGING (biggest lifestyle impact)
    2. PREDICTABILITY_LOW (ongoing daily friction)
    3. SEASONAL_SENSITIVITY (periodic but significant)
    4. BATTERY_HEALTH_ANXIETY (confidence blocker)
    5. BRAND_WAR_RISK (conversation risk)
    """
    priority = [
        "NO_HOME_CHARGING",
        "PREDICTABILITY_LOW",
        "SEASONAL_SENSITIVITY",
        "BATTERY_HEALTH_ANXIETY",
        "BRAND_WAR_RISK",
        "COMPARING_TWO_OPTIONS",
        "PLANNING_TOLERANCE_LOW",
        "ROUTINE_VARIABILITY_HIGH",
    ]

    for p in priority:
        if p in tags:
            return p

    return tags[0] if tags else None
