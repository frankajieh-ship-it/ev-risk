import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "OFFO — Used Car Deal Checker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
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

        <div style={{ flex: 1 }} />

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
          OFFO | Used Car Deal Checker
        </div>

        <div
          style={{
            color: "#a1a1aa",
            fontSize: 28,
            lineHeight: 1.4,
            maxWidth: 800,
          }}
        >
          AI-powered risk analysis. Free.
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 32,
          }}
        >
          <div style={{ color: "#52525b", fontSize: 22 }}>offolab.com</div>
        </div>

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
