/**
 * OFFO Share Card Renderer
 *
 * Generates a branded 1080x1080 share card using the Canvas 2D API.
 * Contains: OFFO header, vehicle name, verdict badge, risk flags,
 * QR code with logo overlay, CTA, and footer.
 *
 * Zero external dependencies — uses only native browser Canvas API.
 */

export interface ShareCardInput {
  verdict: "GREEN" | "YELLOW" | "RED";
  verdictReason: string;
  riskFlags: string[];
  year: number | null;
  make: string | null;
  model: string | null;
  price: number | null;
  mileage: number | null;
  shareSlug: string;
}

const VERDICT_COLORS = {
  GREEN: {
    label: "Low Risk",
    bg: "#ECFDF5",
    accent: "#059669",
    text: "#065F46",
    badgeBg: "#D1FAE5",
  },
  YELLOW: {
    label: "Proceed with Caution",
    bg: "#FEFCE8",
    accent: "#CA8A04",
    text: "#854D0E",
    badgeBg: "#FEF9C3",
  },
  RED: {
    label: "High Risk",
    bg: "#FEF2F2",
    accent: "#DC2626",
    text: "#991B1B",
    badgeBg: "#FEE2E2",
  },
} as const;

const FONT_STACK = "system-ui, -apple-system, 'Segoe UI', sans-serif";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxWidth?: number,
): void {
  const display = maxWidth ? truncateText(ctx, text, maxWidth) : text;
  const metrics = ctx.measureText(display);
  ctx.fillText(display, cx - metrics.width / 2, y);
}

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
  logoImg: HTMLImageElement,
): void {
  const W = 1080;
  const H = 1080;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const colors = VERDICT_COLORS[data.verdict] || VERDICT_COLORS.YELLOW;

  // ------------------------------------------------------------------
  // 1. Background — white + verdict-tinted gradient band at top
  // ------------------------------------------------------------------
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  const grad = ctx.createLinearGradient(0, 0, 0, 220);
  grad.addColorStop(0, colors.bg);
  grad.addColorStop(1, "#FFFFFF");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 220);

  // ------------------------------------------------------------------
  // 2. OFFO header — logo + brand name
  // ------------------------------------------------------------------
  try {
    ctx.drawImage(logoImg, 60, 48, 48, 48);
  } catch {
    // logo failed to draw — continue without it
  }

  ctx.font = `600 26px ${FONT_STACK}`;
  ctx.fillStyle = "#3b82f6";
  ctx.fillText("OFFO Lab", 120, 82);

  // ------------------------------------------------------------------
  // 3. Vehicle name
  // ------------------------------------------------------------------
  const vehicle = [data.year, data.make, data.model]
    .filter(Boolean)
    .join(" ") || "Vehicle Check";

  ctx.font = `700 48px ${FONT_STACK}`;
  ctx.fillStyle = "#111827";
  drawCenteredText(ctx, vehicle, W / 2, 165, 900);

  // Price / mileage subtitle
  const parts: string[] = [];
  if (data.price) parts.push(`$${data.price.toLocaleString()}`);
  if (data.mileage) parts.push(`${data.mileage.toLocaleString()} mi`);
  if (parts.length > 0) {
    ctx.font = `400 28px ${FONT_STACK}`;
    ctx.fillStyle = "#6B7280";
    drawCenteredText(ctx, parts.join(" \u00B7 "), W / 2, 210);
  }

  // ------------------------------------------------------------------
  // 4. Verdict badge — rounded rect
  // ------------------------------------------------------------------
  const badgeW = 800;
  const badgeH = 80;
  const badgeX = (W - badgeW) / 2;
  const badgeY = 250;

  ctx.fillStyle = colors.badgeBg;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 20);
  ctx.fill();

  ctx.font = `700 36px ${FONT_STACK}`;
  ctx.fillStyle = colors.text;
  drawCenteredText(ctx, colors.label, W / 2, badgeY + 52);

  // ------------------------------------------------------------------
  // 5. Verdict reason — single line, truncated
  // ------------------------------------------------------------------
  ctx.font = `400 24px ${FONT_STACK}`;
  ctx.fillStyle = "#374151";
  drawCenteredText(ctx, data.verdictReason, W / 2, 385, 900);

  // ------------------------------------------------------------------
  // 6. Risk flags — up to 3 bullets
  // ------------------------------------------------------------------
  const flags = data.riskFlags.slice(0, 3);
  if (flags.length > 0) {
    ctx.font = `500 14px ${FONT_STACK}`;
    ctx.fillStyle = "#6B7280";
    drawCenteredText(ctx, "Top checks OFFO flagged", W / 2, 435);

    ctx.font = `400 22px ${FONT_STACK}`;
    const flagStartY = 468;
    const flagSpacing = 42;
    const bulletX = 180;
    const textX = 204;

    for (let i = 0; i < flags.length; i++) {
      const y = flagStartY + i * flagSpacing;

      // Bullet dot
      ctx.beginPath();
      ctx.arc(bulletX, y - 5, 6, 0, Math.PI * 2);
      ctx.fillStyle = colors.accent;
      ctx.fill();

      // Flag text
      ctx.fillStyle = "#4B5563";
      const displayFlag = truncateText(ctx, flags[i], 700);
      ctx.fillText(displayFlag, textX, y);
    }
  }

  // ------------------------------------------------------------------
  // 7. QR code — centered
  // ------------------------------------------------------------------
  const qrSize = 360;
  const qrX = (W - qrSize) / 2;
  const qrY = flags.length > 0 ? 590 : 520;

  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  // ------------------------------------------------------------------
  // 8. Logo overlay in QR center
  // ------------------------------------------------------------------
  const logoOverlaySize = 56;
  const logoBgRadius = 36;
  const logoCx = W / 2;
  const logoCy = qrY + qrSize / 2;

  // White circle backing
  ctx.beginPath();
  ctx.arc(logoCx, logoCy, logoBgRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Logo
  try {
    ctx.drawImage(
      logoImg,
      logoCx - logoOverlaySize / 2,
      logoCy - logoOverlaySize / 2,
      logoOverlaySize,
      logoOverlaySize,
    );
  } catch {
    // logo failed — QR still works without it
  }

  // ------------------------------------------------------------------
  // 9. CTA text
  // ------------------------------------------------------------------
  const ctaY = qrY + qrSize + 30;
  ctx.font = `500 22px ${FONT_STACK}`;
  ctx.fillStyle = "#6B7280";
  drawCenteredText(ctx, "Scan to view full OFFO verdict", W / 2, ctaY);

  // ------------------------------------------------------------------
  // 10. Fallback URL
  // ------------------------------------------------------------------
  ctx.font = `500 20px ${FONT_STACK}`;
  ctx.fillStyle = "#3b82f6";
  drawCenteredText(ctx, `offolab.com/r/${data.shareSlug}`, W / 2, ctaY + 36);

  // ------------------------------------------------------------------
  // 11. Footer
  // ------------------------------------------------------------------
  ctx.font = `400 18px ${FONT_STACK}`;
  ctx.fillStyle = "#9CA3AF";
  drawCenteredText(ctx, "Powered by OFFO Labs", W / 2, H - 30);
}
