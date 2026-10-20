/**
 * Share Card Renderer — Unit Tests
 *
 * Verifies verdict labels, border colors, and vehicle headline logic
 * introduced in the share card engagement improvements.
 *
 * Uses a minimal Canvas stub — we test what gets drawn, not pixel output.
 */

import { generateShareCard } from "@/lib/share-card-renderer";
import type { ShareCardInput } from "@/lib/share-card-renderer";

// ---------------------------------------------------------------------------
// Canvas stub — records draw calls so we can assert on them
// ---------------------------------------------------------------------------

interface DrawCall {
  method: string;
  args: unknown[];
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
  font?: string;
}

function makeCanvasStub() {
  const calls: DrawCall[] = [];
  let currentFillStyle = "";
  let currentStrokeStyle = "";
  let currentLineWidth = 1;
  let currentFont = "";

  const ctx = {
    get fillStyle() { return currentFillStyle; },
    set fillStyle(v: string) { currentFillStyle = v; },
    get strokeStyle() { return currentStrokeStyle; },
    set strokeStyle(v: string) { currentStrokeStyle = v; },
    get lineWidth() { return currentLineWidth; },
    set lineWidth(v: number) { currentLineWidth = v; },
    get font() { return currentFont; },
    set font(v: string) { currentFont = v; },

    fillRect: (...args: unknown[]) => calls.push({ method: "fillRect", args, fillStyle: currentFillStyle }),
    strokeRect: (...args: unknown[]) => calls.push({ method: "strokeRect", args }),
    fillText: (...args: unknown[]) => calls.push({ method: "fillText", args, fillStyle: currentFillStyle, font: currentFont }),
    beginPath: () => calls.push({ method: "beginPath", args: [] }),
    moveTo: (...args: unknown[]) => calls.push({ method: "moveTo", args }),
    lineTo: (...args: unknown[]) => calls.push({ method: "lineTo", args }),
    arcTo: (...args: unknown[]) => calls.push({ method: "arcTo", args }),
    closePath: () => calls.push({ method: "closePath", args: [] }),
    fill: () => calls.push({ method: "fill", args: [], fillStyle: currentFillStyle }),
    stroke: () => calls.push({ method: "stroke", args: [], strokeStyle: currentStrokeStyle, lineWidth: currentLineWidth }),
    save: () => calls.push({ method: "save", args: [] }),
    restore: () => calls.push({ method: "restore", args: [] }),
    clip: () => calls.push({ method: "clip", args: [] }),
    drawImage: (...args: unknown[]) => calls.push({ method: "drawImage", args }),
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
    measureText: (text: string) => ({ width: text.length * 12 }),
  };

  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toDataURL: () => "data:image/png;base64,stub",
  } as unknown as HTMLCanvasElement;

  const qrCanvas = {
    width: 330,
    height: 330,
  } as unknown as HTMLCanvasElement;

  return { canvas, qrCanvas, calls, ctx };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filledTexts(calls: DrawCall[]): string[] {
  return calls
    .filter((c) => c.method === "fillText")
    .map((c) => c.args[0] as string);
}

function strokeColors(calls: DrawCall[]): string[] {
  return calls
    .filter((c) => c.method === "stroke")
    .map((c) => c.strokeStyle as string)
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("share-card-renderer — verdict labels", () => {
  it('GREEN verdict renders "LOW RISK" label', () => {
    const { canvas, qrCanvas, calls } = makeCanvasStub();
    const input: ShareCardInput = {
      verdict: "GREEN",
      verdictReason: "Clean history, good condition",
      verdictShort: "Clean history",
      riskFlags: [],
      year: 2022,
      make: "Tesla",
      model: "Model 3",
      price: 28000,
      mileage: 32000,
      shareSlug: "abc123",
    };
    generateShareCard(canvas, input, qrCanvas);
    const texts = filledTexts(calls);
    expect(texts).toContain("LOW RISK");
    expect(texts).not.toContain("YELLOW");
  });

  it('YELLOW verdict renders "PROCEED WITH CAUTION" — not plain "YELLOW"', () => {
    const { canvas, qrCanvas, calls } = makeCanvasStub();
    const input: ShareCardInput = {
      verdict: "YELLOW",
      verdictReason: "Missing service records",
      verdictShort: "Missing service records",
      riskFlags: ["No service records found"],
      year: 2021,
      make: "Chevy",
      model: "Bolt EV",
      price: 18000,
      mileage: 45000,
      shareSlug: "xyz789",
    };
    generateShareCard(canvas, input, qrCanvas);
    const texts = filledTexts(calls);
    expect(texts).toContain("PROCEED WITH CAUTION");
    expect(texts).not.toContain("YELLOW");
  });

  it('RED verdict renders "HIGH RISK" label', () => {
    const { canvas, qrCanvas, calls } = makeCanvasStub();
    const input: ShareCardInput = {
      verdict: "RED",
      verdictReason: "Salvage title detected",
      verdictShort: "Salvage title",
      riskFlags: ["Salvage title", "Battery degraded"],
      year: 2020,
      make: "Nissan",
      model: "LEAF",
      price: 9500,
      mileage: 80000,
      shareSlug: "red001",
    };
    generateShareCard(canvas, input, qrCanvas);
    const texts = filledTexts(calls);
    expect(texts).toContain("HIGH RISK");
  });
});

describe("share-card-renderer — verdict border color", () => {
  it("GREEN verdict uses green border (#16a34a)", () => {
    const { canvas, qrCanvas, calls } = makeCanvasStub();
    generateShareCard(canvas, {
      verdict: "GREEN",
      verdictReason: "All good",
      verdictShort: "All good",
      riskFlags: [],
      year: 2023,
      make: "Ford",
      model: "Mustang Mach-E",
      price: 35000,
      mileage: 12000,
      shareSlug: "s1",
    }, qrCanvas);
    expect(strokeColors(calls)).toContain("#16a34a");
  });

  it("YELLOW verdict uses amber border (#d97706)", () => {
    const { canvas, qrCanvas, calls } = makeCanvasStub();
    generateShareCard(canvas, {
      verdict: "YELLOW",
      verdictReason: "Needs inspection",
      verdictShort: "Needs inspection",
      riskFlags: [],
      year: 2021,
      make: "VW",
      model: "ID.4",
      price: 22000,
      mileage: 28000,
      shareSlug: "s2",
    }, qrCanvas);
    expect(strokeColors(calls)).toContain("#d97706");
  });

  it("RED verdict uses red border (#dc2626)", () => {
    const { canvas, qrCanvas, calls } = makeCanvasStub();
    generateShareCard(canvas, {
      verdict: "RED",
      verdictReason: "Major issues",
      verdictShort: "Major issues",
      riskFlags: ["Flood damage"],
      year: 2019,
      make: "BMW",
      model: "i3",
      price: 11000,
      mileage: 70000,
      shareSlug: "s3",
    }, qrCanvas);
    expect(strokeColors(calls)).toContain("#dc2626");
  });

  it("GREEN border does not use the old light-blue border (#93C5FD) as main card border", () => {
    const { canvas, qrCanvas, calls } = makeCanvasStub();
    generateShareCard(canvas, {
      verdict: "GREEN",
      verdictReason: "All good",
      verdictShort: "All good",
      riskFlags: [],
      year: 2022,
      make: "Hyundai",
      model: "Ioniq 5",
      price: 31000,
      mileage: 18000,
      shareSlug: "s4",
    }, qrCanvas);
    // The first stroke call is the main card border — it should NOT be old light blue
    const firstStroke = calls.find((c) => c.method === "stroke");
    expect(firstStroke?.strokeStyle).not.toBe("#93C5FD");
  });
});

describe("share-card-renderer — vehicle headline", () => {
  it("renders vehicle year, make, and model as text when provided", () => {
    const { canvas, qrCanvas, calls } = makeCanvasStub();
    generateShareCard(canvas, {
      verdict: "GREEN",
      verdictReason: "Clean",
      verdictShort: "Clean",
      riskFlags: [],
      year: 2023,
      make: "Rivian",
      model: "R1T",
      price: 55000,
      mileage: 8000,
      shareSlug: "r1t1",
    }, qrCanvas);
    const texts = filledTexts(calls);
    // Vehicle label "2023 Rivian R1T" should appear (may be truncated but key parts present)
    const vehicleText = texts.find((t) => t.includes("Rivian") && t.includes("R1T"));
    expect(vehicleText).toBeDefined();
  });

  it("renders price and mileage detail line when both provided", () => {
    const { canvas, qrCanvas, calls } = makeCanvasStub();
    generateShareCard(canvas, {
      verdict: "YELLOW",
      verdictReason: "OK",
      verdictShort: "OK",
      riskFlags: [],
      year: 2022,
      make: "Tesla",
      model: "Model Y",
      price: 38000,
      mileage: 22000,
      shareSlug: "my1",
    }, qrCanvas);
    const texts = filledTexts(calls);
    // Price formatted as $38,000 and mileage as 22,000 mi
    const detailText = texts.find((t) => t.includes("$38,000") && t.includes("22,000 mi"));
    expect(detailText).toBeDefined();
  });

  it("falls back to generic headline when no vehicle data provided", () => {
    const { canvas, qrCanvas, calls } = makeCanvasStub();
    generateShareCard(canvas, {
      verdict: "GREEN",
      verdictReason: "Clean",
      verdictShort: "Clean",
      riskFlags: [],
      year: null,
      make: null,
      model: null,
      price: null,
      mileage: null,
      shareSlug: "nocar",
    }, qrCanvas);
    const texts = filledTexts(calls);
    expect(texts.some((t) => t.includes("Used EV Listing"))).toBe(true);
  });

  it("renders OFFO Receipt header line when vehicle is known", () => {
    const { canvas, qrCanvas, calls } = makeCanvasStub();
    generateShareCard(canvas, {
      verdict: "RED",
      verdictReason: "Issues",
      verdictShort: "Issues",
      riskFlags: [],
      year: 2020,
      make: "Audi",
      model: "e-tron",
      price: 42000,
      mileage: 35000,
      shareSlug: "audi1",
    }, qrCanvas);
    const texts = filledTexts(calls);
    expect(texts).toContain("OFFO Receipt —");
  });
});

describe("share-card-renderer — risk flags", () => {
  it("renders up to 3 risk flags as check items", () => {
    const { canvas, qrCanvas, calls } = makeCanvasStub();
    generateShareCard(canvas, {
      verdict: "RED",
      verdictReason: "Multiple issues",
      verdictShort: "Multiple issues",
      riskFlags: ["Salvage title", "Battery degraded", "Flood damage", "Frame damage"],
      year: 2019,
      make: "Nissan",
      model: "LEAF",
      price: 8000,
      mileage: 90000,
      shareSlug: "flags1",
    }, qrCanvas);
    const texts = filledTexts(calls);
    // Check marks rendered for each flag (up to 3)
    const checkMarks = texts.filter((t) => t === "✓");
    expect(checkMarks.length).toBe(3);
    // Fourth flag should not appear
    expect(texts).not.toContain("Frame damage");
  });

  it("renders no check marks when risk flags array is empty", () => {
    const { canvas, qrCanvas, calls } = makeCanvasStub();
    generateShareCard(canvas, {
      verdict: "GREEN",
      verdictReason: "Clean",
      verdictShort: "Clean",
      riskFlags: [],
      year: 2023,
      make: "Tesla",
      model: "Model 3",
      price: 29000,
      mileage: 5000,
      shareSlug: "noflags",
    }, qrCanvas);
    const texts = filledTexts(calls);
    const checkMarks = texts.filter((t) => t === "✓");
    expect(checkMarks.length).toBe(0);
  });
});

describe("share-card-renderer — canvas dimensions", () => {
  it("sets canvas to 1200×900", () => {
    const { canvas, qrCanvas } = makeCanvasStub();
    generateShareCard(canvas, {
      verdict: "GREEN",
      verdictReason: "Clean",
      verdictShort: "Clean",
      riskFlags: [],
      year: null, make: null, model: null, price: null, mileage: null,
      shareSlug: "dim1",
    }, qrCanvas);
    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(900);
  });
});
