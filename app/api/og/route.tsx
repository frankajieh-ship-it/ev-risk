/**
 * Dynamic OG Image Generator
 * GET /api/og?title=...&subtitle=...
 * Returns a 1200x630 branded PNG for social sharing.
 */

import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = (
    searchParams.get("title") ?? "OFFO | Used Car Deal Checker"
  ).slice(0, 80);
  const subtitle = (
    searchParams.get("subtitle") ?? "AI-powered risk analysis. Free."
  ).slice(0, 100);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          backgroundColor: "#0a0a0a",
          display: "flex",
          flexDirection: "column",
          padding: "60px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Brand */}
        <div
          style={{
            color: "white",
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: "-0.5px",
          }}
        >
          OFFO
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Title */}
        <div
          style={{
            color: "white",
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1.2,
            marginBottom: 16,
            maxWidth: 900,
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        <div
          style={{
            color: "#a1a1aa",
            fontSize: 28,
            lineHeight: 1.4,
            maxWidth: 800,
          }}
        >
          {subtitle}
        </div>

        {/* Bottom row */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 32,
          }}
        >
          <div style={{ color: "#52525b", fontSize: 22 }}>offolab.com</div>
        </div>

        {/* Green accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: 1200,
            height: 4,
            backgroundColor: "#22c55e",
          }}
        />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
