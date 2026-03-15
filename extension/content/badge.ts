/**
 * OFFO Badge Injector — Full Receipt Analysis
 *
 * Listens for EV detection events from detector.ts, calls the OFFO
 * /api/receipt endpoint, polls for a full result, then renders the
 * verdict in both the badge and the slide-in panel.
 */

import { getOrCreateReceiptToken } from "../shared/token";

const BADGE_ID = "offo-deal-check-badge";
const DISMISSED_KEY = "offo_dismissed_listings";
const OFFO_BASE = "https://offolab.com";
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 30000;

type Verdict = "GREEN" | "YELLOW" | "RED";
type GenerationStatus = "lite" | "generating" | "full" | "failed";

interface MinimumViableRoutine {
  charging_access: string;
  climate: string;
  longest_day_pattern: string;
  [key: string]: unknown;
}

interface ReceiptResult {
  receipt_id: string;
  verdict: Verdict;
  verdict_reason: string;
  risk_flags: string[];
  must_answer_questions: string[];
  negotiation_opener: string;
  price_sanity: { label: string; rationale_short: string };
}

interface ApiResponse {
  success: boolean;
  receipt_id?: string;
  generation_status?: GenerationStatus;
  receipt?: {
    verdict?: Verdict;
    verdict_reason?: string;
    risk_flags?: string[];
    must_answer_questions?: string[];
    negotiation_opener?: string;
    price_sanity?: { label: string; rationale_short: string };
  };
  error?: string;
}

// ─── Dismissed listing helpers ───────────────────────────────────────────────

function getDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function addDismissed(url: string) {
  const dismissed = getDismissed();
  dismissed.add(url);
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
  } catch {
    // Ignore
  }
}

// ─── Badge DOM helpers ────────────────────────────────────────────────────────

function removeBadge() {
  document.getElementById(BADGE_ID)?.remove();
}

const VERDICT_COLORS: Record<Verdict, { icon: string; dot: string }> = {
  GREEN:  { icon: "#16a34a", dot: "#22c55e" },
  YELLOW: { icon: "#d97706", dot: "#f59e0b" },
  RED:    { icon: "#dc2626", dot: "#ef4444" },
};

function setBadgeVerdict(verdict: Verdict, reason: string) {
  const badge = document.getElementById(BADGE_ID);
  if (!badge) return;
  const colors = VERDICT_COLORS[verdict];
  const icon = badge.querySelector(".offo-badge-icon") as HTMLElement | null;
  const title = badge.querySelector(".offo-badge-title") as HTMLElement | null;
  const subtitle = badge.querySelector(".offo-badge-subtitle") as HTMLElement | null;

  if (icon) {
    icon.style.background = colors.icon + "20";
    icon.style.color = colors.icon;
    icon.innerHTML = verdictSvg(verdict);
  }
  if (title) {
    const labels: Record<Verdict, string> = { GREEN: "Good Deal", YELLOW: "Proceed with Caution", RED: "High Risk" };
    title.textContent = labels[verdict];
  }
  if (subtitle) {
    subtitle.textContent = reason.length > 55 ? reason.slice(0, 52) + "…" : reason;
  }
}

function setBadgeAnalyzing(vehicleName: string) {
  const badge = document.getElementById(BADGE_ID);
  if (!badge) return;
  const title = badge.querySelector(".offo-badge-title") as HTMLElement | null;
  const subtitle = badge.querySelector(".offo-badge-subtitle") as HTMLElement | null;
  const icon = badge.querySelector(".offo-badge-icon") as HTMLElement | null;
  if (title) title.textContent = "Analyzing deal…";
  if (subtitle) subtitle.textContent = vehicleName || "EV listing";
  if (icon) {
    icon.style.background = "#eef2ff";
    icon.style.color = "#4f46e5";
    icon.innerHTML = spinnerSvg();
  }
}

function setBadgeSetupPrompt() {
  const badge = document.getElementById(BADGE_ID);
  if (!badge) return;
  const title = badge.querySelector(".offo-badge-title") as HTMLElement | null;
  const subtitle = badge.querySelector(".offo-badge-subtitle") as HTMLElement | null;
  const inner = badge.querySelector(".offo-badge-inner") as HTMLElement | null;

  if (title) title.textContent = "Finish OFFO setup";
  if (subtitle) subtitle.textContent = "Complete your routine at offolab.com →";
  if (inner) {
    inner.onclick = () => window.open(`${OFFO_BASE}/routine`, "_blank", "noopener");
  }
}

function spinnerSvg(): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:offo-spin 1s linear infinite">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
  <style>@keyframes offo-spin{to{transform:rotate(360deg)}}</style>`;
}

function verdictSvg(verdict: Verdict): string {
  if (verdict === "GREEN") {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>`;
  }
  if (verdict === "RED") {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  }
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
}

// ─── Badge injection ─────────────────────────────────────────────────────────

function injectBadge(
  vehicle: { year?: string; make?: string; model?: string },
  url: string,
  onBadgeClick: () => void,
  onDismiss: () => void,
): void {
  if (document.getElementById(BADGE_ID)) return;
  if (getDismissed().has(url)) return;

  const badge = document.createElement("div");
  badge.id = BADGE_ID;
  badge.className = "offo-badge";
  badge.setAttribute("role", "complementary");
  badge.setAttribute("aria-label", "OFFO Deal Checker");

  const vehicleName = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");

  badge.innerHTML = `
    <div class="offo-badge-inner">
      <div class="offo-badge-icon">
        ${spinnerSvg()}
      </div>
      <div class="offo-badge-text">
        <span class="offo-badge-title">Analyzing deal…</span>
        <span class="offo-badge-subtitle">${vehicleName || "EV listing"}</span>
      </div>
      <button class="offo-badge-close" aria-label="Dismiss" title="Dismiss">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `;

  const inner = badge.querySelector(".offo-badge-inner") as HTMLElement;
  inner.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest(".offo-badge-close")) return;
    onBadgeClick();
  });

  const closeBtn = badge.querySelector(".offo-badge-close") as HTMLElement;
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    addDismissed(url);
    badge.classList.add("offo-badge-exit");
    setTimeout(removeBadge, 300);
    onDismiss();
  });

  document.body.appendChild(badge);
  requestAnimationFrame(() => badge.classList.add("offo-badge-enter"));
}

// ─── Receipt API + polling ────────────────────────────────────────────────────

async function callReceiptApi(
  listingUrl: string,
  vehicle: { year?: string; make?: string; model?: string },
  token: string,
  routine: MinimumViableRoutine,
): Promise<ApiResponse> {
  const body: Record<string, unknown> = {
    listing_url: listingUrl,
    listing_text: document.body.innerText.slice(0, 8000),
    receipt_token: token,
    country: "US",
    // Attach routine context so the API can personalize scoring
    context_charging_access: routine.charging_access,
    context_climate: routine.climate,
    context_longest_day: routine.longest_day_pattern,
  };
  if (vehicle.year) body.year = parseInt(vehicle.year, 10) || undefined;
  if (vehicle.make) body.make = vehicle.make;
  if (vehicle.model) body.model = vehicle.model;

  const res = await fetch(`${OFFO_BASE}/api/receipt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<ApiResponse>;
}

async function pollForFull(receiptId: string): Promise<ApiResponse | null> {
  const deadline = Date.now() + POLL_MAX_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`${OFFO_BASE}/api/receipt/${encodeURIComponent(receiptId)}/status`);
    const data: ApiResponse = await res.json();
    if (data.generation_status === "full" || data.generation_status === "failed") {
      return data;
    }
  }
  return null; // Timed out
}

function extractReceiptResult(data: ApiResponse): ReceiptResult | null {
  if (!data.success || !data.receipt || !data.receipt_id || !data.receipt.verdict) return null;
  return {
    receipt_id: data.receipt_id,
    verdict: data.receipt.verdict,
    verdict_reason: data.receipt.verdict_reason ?? "",
    risk_flags: data.receipt.risk_flags ?? [],
    must_answer_questions: data.receipt.must_answer_questions ?? [],
    negotiation_opener: data.receipt.negotiation_opener ?? "",
    price_sanity: data.receipt.price_sanity ?? { label: "UNKNOWN", rationale_short: "" },
  };
}

// ─── Main flow ────────────────────────────────────────────────────────────────

async function runAnalysis(
  vehicle: { year?: string; make?: string; model?: string },
  url: string,
): Promise<void> {
  // 1. Check if routine is stored
  const storage = await new Promise<Record<string, unknown>>((resolve) =>
    chrome.storage.local.get(["enabled", "offo_routine"], resolve)
  );

  if (storage.enabled === false) return;

  // Inject badge immediately so user sees something
  let panelResult: ReceiptResult | null = null;
  const vehicleName = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");

  injectBadge(
    vehicle,
    url,
    () => {
      // Badge click: toggle panel if we have a result
      if (panelResult) {
        window.dispatchEvent(new CustomEvent("offo-show-panel", { detail: panelResult }));
      }
    },
    () => {
      // Dismiss: no-op beyond addDismissed (already handled in injectBadge)
    },
  );

  const routine = storage.offo_routine as MinimumViableRoutine | undefined;

  if (!routine) {
    // No routine — show setup prompt
    setBadgeSetupPrompt();
    return;
  }

  setBadgeAnalyzing(vehicleName);

  try {
    const token = await getOrCreateReceiptToken();
    const initial = await callReceiptApi(url, vehicle, token, routine);

    if (!initial.success || !initial.receipt_id) {
      removeBadge();
      return;
    }

    const receiptId = initial.receipt_id;

    // Show lite verdict if available
    const liteResult = extractReceiptResult(initial);
    if (liteResult) {
      panelResult = liteResult;
      setBadgeVerdict(liteResult.verdict, liteResult.verdict_reason);
    }

    // Poll for full
    if (initial.generation_status !== "full") {
      const fullData = await pollForFull(receiptId);
      if (fullData) {
        const fullResult = extractReceiptResult(fullData);
        if (fullResult) {
          panelResult = fullResult;
          setBadgeVerdict(fullResult.verdict, fullResult.verdict_reason);
          // Auto-open panel when full result arrives
          window.dispatchEvent(new CustomEvent("offo-show-panel", { detail: panelResult }));
        }
      }
    } else if (liteResult) {
      // Already full on first response — auto-open immediately
      window.dispatchEvent(new CustomEvent("offo-show-panel", { detail: liteResult }));
    }
  } catch {
    // Network error — silently remove badge
    removeBadge();
  }
}

// ─── Event listeners ─────────────────────────────────────────────────────────

console.log("[OFFO] Badge script loaded");

window.addEventListener("offo-detection", ((e: CustomEvent) => {
  const { isEV, vehicle, url } = e.detail;
  if (isEV && vehicle) {
    runAnalysis(vehicle, url);
  } else {
    removeBadge();
  }
}) as EventListener);

window.dispatchEvent(new CustomEvent("offo-request-detection"));
