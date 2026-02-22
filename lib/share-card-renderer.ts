/**
 * OFFO Share Card Renderer — V2 Branded Two-Column Layout
 *
 * Generates a 1200x900 landscape share card using Canvas 2D API.
 * Left column: OFFO branding, headline, verdict banner, risk checks, URL, social proof
 * Right column: Dark blue QR panel with CTA
 *
 * Optimized for: Reddit, X/Twitter, iMessage, WhatsApp image sharing.
 * Zero external dependencies — uses only native browser Canvas API.
 */

export interface ShareCardInput {
  verdict: "GREEN" | "YELLOW" | "RED";
  verdictReason: string;
  verdictShort: string;
  riskFlags: string[];
  year: number | null;
  make: string | null;
  model: string | null;
  price: number | null;
  mileage: number | null;
  shareSlug: string;
}

// ---------------------------------------------------------------------------
// Brand palette
// ---------------------------------------------------------------------------

const NAVY = "#102A5C";
const BLUE = "#2563EB";
const LIGHT_BLUE_BORDER = "#93C5FD";
const BG_GRAY = "#F3F4F6";
const CARD_WHITE = "#FFFFFF";
const QR_PANEL_TOP = "#2F5FAE";
const QR_PANEL_BOTTOM = "#1E3A8A";
const TEXT_DARK = "#374151";
const TEXT_MUTED = "#6B7280";

const VERDICT_STYLES = {
  GREEN: { bg: "#DCFCE7", text: "#166534", label: "LOW RISK" },
  YELLOW: { bg: "#FEF3C7", text: "#92400E", label: "YELLOW" },
  RED: { bg: "#FEE2E2", text: "#991B1B", label: "HIGH RISK" },
} as const;

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "\u2026").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "\u2026";
}

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth?: number,
): void {
  const display = maxWidth ? truncateText(ctx, text, maxWidth) : text;
  const w = ctx.measureText(display).width;
  ctx.fillText(display, cx - w / 2, y);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

export function generateShareCard(
  canvas: HTMLCanvasElement,
  data: ShareCardInput,
  qrCanvas: HTMLCanvasElement,
): void {
  const W = 1200;
  const H = 900;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const verdict = VERDICT_STYLES[data.verdict] || VERDICT_STYLES.YELLOW;

  // Layout constants
  const CARD_X = 30;
  const CARD_Y = 30;
  const CARD_W = 1140;
  const CARD_H = 840;
  const LEFT_X = 75;
  const LEFT_MAX = 600;
  const QR_PANEL_X = 660;
  const QR_PANEL_Y = CARD_Y + 20;
  const QR_PANEL_W = 480;
  const QR_PANEL_H = CARD_H - 40;

  // ------------------------------------------------------------------
  // 1. Outer background
  // ------------------------------------------------------------------
  ctx.fillStyle = BG_GRAY;
  ctx.fillRect(0, 0, W, H);

  // ------------------------------------------------------------------
  // 2. Main card — white with light blue border
  // ------------------------------------------------------------------
  roundRect(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 24);
  ctx.fillStyle = CARD_WHITE;
  ctx.fill();
  ctx.strokeStyle = LIGHT_BLUE_BORDER;
  ctx.lineWidth = 2;
  ctx.stroke();

  // ------------------------------------------------------------------
  // 3. Bottom accent bar
  // ------------------------------------------------------------------
  const barY = CARD_Y + CARD_H - 50;
  const barGrad = ctx.createLinearGradient(CARD_X, 0, CARD_X + CARD_W, 0);
  barGrad.addColorStop(0, QR_PANEL_TOP);
  barGrad.addColorStop(1, QR_PANEL_BOTTOM);
  ctx.fillStyle = barGrad;
  roundRect(ctx, CARD_X, barY, CARD_W, 50, 0);
  // Only round bottom corners
  ctx.fillRect(CARD_X, barY, CARD_W, 26);
  roundRect(ctx, CARD_X, barY, CARD_W, 50, 24);
  ctx.fill();

  // Re-draw card top portion over the bar's top square corners
  roundRect(ctx, CARD_X, CARD_Y, CARD_W, CARD_H - 50, 0);
  // Actually, simpler: just draw the bar with clip
  ctx.save();
  roundRect(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 24);
  ctx.clip();
  ctx.fillStyle = barGrad;
  ctx.fillRect(CARD_X, barY, CARD_W, 50);
  ctx.restore();

  // ------------------------------------------------------------------
  // A) OFFO brand wordmark (left-aligned with content)
  // ------------------------------------------------------------------
  ctx.font = `800 38px ${FONT}`;
  ctx.fillStyle = NAVY;
  ctx.fillText("OFFO", LEFT_X, 95);

  // ------------------------------------------------------------------
  // B) Headline — "Used EV Listing Verdict"
  // ------------------------------------------------------------------
  ctx.font = `800 52px ${FONT}`;
  ctx.fillStyle = NAVY;
  ctx.fillText("Used EV Listing", LEFT_X, 175);
  ctx.fillText("Verdict", LEFT_X, 235);

  // ------------------------------------------------------------------
  // C) Subheadline
  // ------------------------------------------------------------------
  ctx.font = `400 21px ${FONT}`;
  ctx.fillStyle = TEXT_MUTED;
  ctx.fillText("Routine-first used EV check", LEFT_X, 272);

  // ------------------------------------------------------------------
  // D) Verdict banner strip
  // ------------------------------------------------------------------
  const bannerX = LEFT_X;
  const bannerY = 305;
  const bannerW = LEFT_MAX - LEFT_X + 30;
  const bannerH = 56;

  roundRect(ctx, bannerX, bannerY, bannerW, bannerH, 12);
  ctx.fillStyle = verdict.bg;
  ctx.fill();

  // Verdict label (bold) + short reason
  const bannerText = `${verdict.label} \u2013 ${data.verdictShort}`;
  ctx.font = `700 21px ${FONT}`;
  ctx.fillStyle = verdict.text;

  // Draw verdict label bold, then reason regular
  const labelText = verdict.label;
  const reasonText = ` \u2013 ${data.verdictShort}`;
  const labelWidth = ctx.measureText(labelText).width;

  const bannerTextX = bannerX + 20;
  const bannerTextY = bannerY + 36;

  ctx.font = `700 21px ${FONT}`;
  ctx.fillStyle = verdict.text;
  ctx.fillText(labelText, bannerTextX, bannerTextY);

  ctx.font = `400 21px ${FONT}`;
  ctx.fillStyle = verdict.text;
  const reasonDisplay = truncateText(ctx, reasonText, bannerW - 40 - labelWidth);
  ctx.fillText(reasonDisplay, bannerTextX + labelWidth, bannerTextY);

  // ------------------------------------------------------------------
  // E) 3 bullet checks
  // ------------------------------------------------------------------
  const flags = data.riskFlags.slice(0, 3);
  const checkStartY = 400;
  const checkSpacing = 44;

  ctx.font = `500 20px ${FONT}`;

  for (let i = 0; i < flags.length; i++) {
    const y = checkStartY + i * checkSpacing;

    // Check icon (colored bullet)
    ctx.font = `700 20px ${FONT}`;
    ctx.fillStyle = verdict.text;
    ctx.fillText("\u2713", LEFT_X + 5, y);

    // Flag text
    ctx.font = `400 20px ${FONT}`;
    ctx.fillStyle = TEXT_DARK;
    const flagText = truncateText(ctx, flags[i], LEFT_MAX - LEFT_X - 40);
    ctx.fillText(flagText, LEFT_X + 35, y);
  }

  // ------------------------------------------------------------------
  // F) Short link pill
  // ------------------------------------------------------------------
  const pillY = flags.length > 0 ? checkStartY + flags.length * checkSpacing + 35 : 420;
  const linkText = `offolab.com/r/${data.shareSlug}`;

  ctx.font = `500 18px ${FONT}`;
  const linkW = ctx.measureText(linkText).width + 50;

  roundRect(ctx, LEFT_X, pillY, linkW, 44, 22);
  ctx.strokeStyle = LIGHT_BLUE_BORDER;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Link icon (small square with arrow — draw manually)
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 2;
  const iconX = LEFT_X + 16;
  const iconY = pillY + 13;
  ctx.strokeRect(iconX, iconY, 14, 14);
  ctx.beginPath();
  ctx.moveTo(iconX + 7, iconY + 7);
  ctx.lineTo(iconX + 14, iconY);
  ctx.stroke();

  ctx.font = `500 18px ${FONT}`;
  ctx.fillStyle = BLUE;
  ctx.fillText(linkText, LEFT_X + 42, pillY + 28);

  // ------------------------------------------------------------------
  // G) Social proof footer
  // ------------------------------------------------------------------
  const proofY = pillY + 65;
  ctx.font = `400 16px ${FONT}`;
  ctx.fillStyle = TEXT_MUTED;
  ctx.fillText("1,000+ listings analyzed by OFFO Labs", LEFT_X, proofY);

  // ------------------------------------------------------------------
  // H) QR panel — dark blue gradient with rounded corners
  // ------------------------------------------------------------------
  ctx.save();
  roundRect(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 24);
  ctx.clip(); // clip to card bounds

  const qrGrad = ctx.createLinearGradient(0, QR_PANEL_Y, 0, QR_PANEL_Y + QR_PANEL_H);
  qrGrad.addColorStop(0, QR_PANEL_TOP);
  qrGrad.addColorStop(1, QR_PANEL_BOTTOM);

  roundRect(ctx, QR_PANEL_X, QR_PANEL_Y, QR_PANEL_W, QR_PANEL_H, 24);
  ctx.fillStyle = qrGrad;
  ctx.fill();

  // Thin light border on QR panel
  ctx.strokeStyle = "rgba(147, 197, 253, 0.3)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // ------------------------------------------------------------------
  // I) QR code — white plate inside panel
  // ------------------------------------------------------------------
  const qrPlateSize = 340;
  const qrPlateX = QR_PANEL_X + (QR_PANEL_W - qrPlateSize) / 2;
  const qrPlateY = QR_PANEL_Y + 40;

  roundRect(ctx, qrPlateX, qrPlateY, qrPlateSize, qrPlateSize, 16);
  ctx.fillStyle = CARD_WHITE;
  ctx.fill();

  // Draw QR inside plate with padding
  const qrPadding = 20;
  const qrDrawSize = qrPlateSize - qrPadding * 2;
  ctx.drawImage(
    qrCanvas,
    qrPlateX + qrPadding,
    qrPlateY + qrPadding,
    qrDrawSize,
    qrDrawSize,
  );

  // ------------------------------------------------------------------
  // J) CTA text below QR (inside blue panel)
  // ------------------------------------------------------------------
  const ctaCx = QR_PANEL_X + QR_PANEL_W / 2;
  const ctaStartY = qrPlateY + qrPlateSize + 45;

  ctx.font = `400 22px ${FONT}`;
  ctx.fillStyle = "#FFFFFF";
  drawCenteredText(ctx, "Scan to see full", ctaCx, ctaStartY);

  ctx.font = `700 26px ${FONT}`;
  ctx.fillStyle = "#FFFFFF";
  drawCenteredText(ctx, "listing analysis +", ctaCx, ctaStartY + 38);

  // "seller questions" with yellow highlight pill
  const sqText = "seller questions";
  ctx.font = `700 26px ${FONT}`;
  const sqW = ctx.measureText(sqText).width;
  const sqPillW = sqW + 24;
  const sqPillH = 36;
  const sqPillX = ctaCx - sqPillW / 2;
  const sqPillY = ctaStartY + 58;

  roundRect(ctx, sqPillX, sqPillY, sqPillW, sqPillH, 8);
  ctx.fillStyle = "#FEF3C7";
  ctx.fill();

  ctx.font = `700 26px ${FONT}`;
  ctx.fillStyle = "#92400E";
  drawCenteredText(ctx, sqText, ctaCx, sqPillY + 26);
}
