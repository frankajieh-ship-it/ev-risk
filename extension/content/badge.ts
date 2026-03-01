/**
 * OFFO Badge Injector
 *
 * Listens for detection events from detector.ts and injects/removes
 * the floating OFFO badge on CarGurus EV listing pages.
 */

const BADGE_ID = "offo-deal-check-badge";
const DISMISSED_KEY = "offo_dismissed_listings";

/** Get set of dismissed listing URLs from session storage */
function getDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

/** Add URL to dismissed set */
function addDismissed(url: string) {
  const dismissed = getDismissed();
  dismissed.add(url);
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
  } catch {
    // Ignore storage errors
  }
}

/** Remove existing badge from DOM */
function removeBadge() {
  document.getElementById(BADGE_ID)?.remove();
}

/** Inject the floating OFFO badge */
function injectBadge(vehicle: { year?: string; make?: string; model?: string }, url: string) {
  // Don't inject if already present
  if (document.getElementById(BADGE_ID)) return;

  // Don't inject if user dismissed this listing
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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 12l2 2 4-4"/>
          <circle cx="12" cy="12" r="10"/>
        </svg>
      </div>
      <div class="offo-badge-text">
        <span class="offo-badge-title">Check this deal</span>
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

  // Click handler — open OFFO receipt page
  const inner = badge.querySelector(".offo-badge-inner") as HTMLElement;
  inner.addEventListener("click", (e) => {
    // Don't trigger if clicking the close button
    if ((e.target as HTMLElement).closest(".offo-badge-close")) return;

    chrome.runtime.sendMessage({
      type: "open_receipt",
      url: window.location.href,
    });
  });

  // Close button handler
  const closeBtn = badge.querySelector(".offo-badge-close") as HTMLElement;
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    addDismissed(url);
    badge.classList.add("offo-badge-exit");
    setTimeout(() => removeBadge(), 300);
  });

  document.body.appendChild(badge);

  // Trigger enter animation
  requestAnimationFrame(() => {
    badge.classList.add("offo-badge-enter");
  });
}

// Listen for detection events from detector.ts
window.addEventListener("offo-detection", ((e: CustomEvent) => {
  const { isEV, vehicle, url } = e.detail;

  if (isEV && vehicle) {
    // Check if extension is enabled
    chrome.storage.local.get(["enabled"], (result) => {
      const enabled = result.enabled !== false; // Default: enabled
      if (enabled) {
        injectBadge(vehicle, url);
      } else {
        removeBadge();
      }
    });
  } else {
    removeBadge();
  }
}) as EventListener);
