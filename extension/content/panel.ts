/**
 * OFFO Verdict Panel
 *
 * Renders a fixed right-side panel showing the full receipt verdict
 * when triggered by the badge (offo-show-panel custom event).
 */

const PANEL_ID = "offo-verdict-panel";

interface PriceSanity {
  label: "UNDERPRICED" | "FAIR" | "OVERPRICED" | "UNKNOWN";
  rationale_short: string;
}

interface ReceiptData {
  receipt_id: string;
  verdict: "GREEN" | "YELLOW" | "RED";
  verdict_reason: string;
  risk_flags: string[];
  must_answer_questions: string[];
  negotiation_opener: string;
  price_sanity: PriceSanity;
}

const VERDICT_CONFIG = {
  GREEN: { bg: "#dcfce7", border: "#86efac", text: "#166534", label: "Good Deal" },
  YELLOW: { bg: "#fef9c3", border: "#fde047", text: "#854d0e", label: "Proceed with Caution" },
  RED:    { bg: "#fee2e2", border: "#fca5a5", text: "#991b1b", label: "High Risk" },
};

const PRICE_LABEL_TEXT: Record<string, string> = {
  UNDERPRICED: "Below Market",
  FAIR: "Fair Price",
  OVERPRICED: "Overpriced",
  UNKNOWN: "Price Unknown",
};

function removePanel() {
  document.getElementById(PANEL_ID)?.remove();
}

export function togglePanel(data: ReceiptData): void {
  const existing = document.getElementById(PANEL_ID);
  if (existing) {
    existing.remove();
    return;
  }
  injectPanel(data);
}

export function injectPanel(data: ReceiptData): void {
  removePanel();

  const cfg = VERDICT_CONFIG[data.verdict] ?? VERDICT_CONFIG.YELLOW;
  const priceLabel = PRICE_LABEL_TEXT[data.price_sanity?.label] ?? "Price Unknown";

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.className = "offo-panel";

  const flagsHtml = data.risk_flags
    .map((f) => `<li class="offo-panel-flag">${escapeHtml(f)}</li>`)
    .join("");

  const questionsHtml = data.must_answer_questions
    .map((q) => `<li class="offo-panel-question">${escapeHtml(q)}</li>`)
    .join("");

  panel.innerHTML = `
    <div class="offo-panel-inner">
      <div class="offo-panel-header" style="background:${cfg.bg};border-bottom:2px solid ${cfg.border}">
        <div class="offo-panel-verdict-row">
          <span class="offo-panel-verdict-label" style="color:${cfg.text}">${cfg.label}</span>
          <button class="offo-panel-close" aria-label="Close panel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <p class="offo-panel-verdict-reason" style="color:${cfg.text}">${escapeHtml(data.verdict_reason)}</p>
      </div>

      <div class="offo-panel-body">
        <section class="offo-panel-section">
          <h4 class="offo-panel-section-title">Risk Flags</h4>
          <ul class="offo-panel-list">${flagsHtml}</ul>
        </section>

        <section class="offo-panel-section">
          <h4 class="offo-panel-section-title">Price Check</h4>
          <p class="offo-panel-price-label">${priceLabel}</p>
          ${data.price_sanity?.rationale_short
            ? `<p class="offo-panel-price-rationale">${escapeHtml(data.price_sanity.rationale_short)}</p>`
            : ""}
        </section>

        <section class="offo-panel-section">
          <h4 class="offo-panel-section-title">Negotiation Opener</h4>
          <blockquote class="offo-panel-quote">${escapeHtml(data.negotiation_opener)}</blockquote>
        </section>

        <section class="offo-panel-section">
          <h4 class="offo-panel-section-title">Must-Ask Questions</h4>
          <ul class="offo-panel-list">${questionsHtml}</ul>
        </section>
      </div>

      <div class="offo-panel-footer">
        <a
          href="https://offolab.com/receipt/${encodeURIComponent(data.receipt_id)}"
          target="_blank"
          rel="noopener noreferrer"
          class="offo-panel-full-link"
        >
          Open Full Receipt
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline;margin-left:4px">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      </div>
    </div>
  `;

  panel.querySelector(".offo-panel-close")!.addEventListener("click", removePanel);

  document.body.appendChild(panel);

  // Trigger slide-in
  requestAnimationFrame(() => panel.classList.add("offo-panel-enter"));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Listen for panel show events from badge.ts
window.addEventListener("offo-show-panel", ((e: CustomEvent<ReceiptData>) => {
  togglePanel(e.detail);
}) as EventListener);
