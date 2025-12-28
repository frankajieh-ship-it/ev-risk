// components/ReportView.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { BlockRenderer } from "@/components/BlockRenderer";
import { RenderCtx } from "@/core/content";
import { getBlocks, buildSignals } from "@/core/blocks/sampleBlocks";
import { lintVoice } from "@/debug/voiceLinter";
import { confTrace, isDebugEnabled, voiceTrace } from "@/debug/confTrace";

interface ReportViewProps {
  vehicle: any;    // replace with VehicleData
  userInputs?: any; // replace with UserInputs
  onProvide?: (key: string, value: any) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ vehicle, userInputs, onProvide }) => {
  const prevConfRef = useRef<number | null>(null);

  const ctx: RenderCtx = useMemo(() => {
    const signals = buildSignals(vehicle, userInputs);
    return { vehicle, inputs: userInputs, signals };
  }, [vehicle, userInputs]);

  const blocks = useMemo(() => getBlocks(ctx), [ctx]);

  // Confidence tracing (Task C)
  useEffect(() => {
    if (!isDebugEnabled()) return;

    // Use dominant tier as "first tier present" for now; can upgrade later
    const dominantTier = blocks.length ? blocks[0].tier : 4;

    // Compute an overall report confidence as max of tier1 blocks or mean of all
    const confValues = blocks.map(b => b.confidence(ctx));
    const overall =
      confValues.length ? confValues.reduce((a, b) => a + b, 0) / confValues.length : 0;

    const prev = prevConfRef.current;
    if (prev == null) {
      confTrace({
        kind: "initial",
        overall,
        dominantTier,
        missingSignals: missingSignalsFromBlocks(blocks, ctx),
        blocks: blocks.map(b => ({ id: b.id, tier: b.tier, conf: b.confidence(ctx) })),
      });
    } else if (Math.abs(prev - overall) > 0.001) {
      confTrace({
        kind: "change",
        from: prev,
        to: overall,
        dominantTier,
        missingSignals: missingSignalsFromBlocks(blocks, ctx),
        blocks: blocks.map(b => ({ id: b.id, tier: b.tier, conf: b.confidence(ctx) })),
      });
    }
    prevConfRef.current = overall;
  }, [blocks, ctx]);

  // Voice linting (Task B)
  useEffect(() => {
    if (!isDebugEnabled()) return;

    const fullText = blocks.map(b => {
      if (b.kind === "text") return b.render(ctx);
      const metricText = b.render ? b.render(ctx) : "";
      return `${b.metric(ctx).label}: ${b.metric(ctx).value}. ${metricText}`;
    }).join("\n");

    const res = lintVoice(fullText);
    if (!res.ok) {
      voiceTrace({ kind: "lint_failed", hits: res.hits });
      // eslint-disable-next-line no-console
      console.warn("[EV-RISK VOICE] Lint failed:", res.hits);
    } else {
      voiceTrace({ kind: "lint_ok" });
    }
  }, [blocks, ctx]);

  return (
    <div className="report-container space-y-3">
      {blocks.map((block) => (
        <BlockRenderer
          key={block.id} // ✅ stable key
          block={block}
          ctx={ctx}
          onProvide={onProvide}
        />
      ))}
    </div>
  );
};

function missingSignalsFromBlocks(blocks: any[], ctx: RenderCtx): string[] {
  const missing = new Set<string>();
  for (const b of blocks) {
    for (const req of (b.requiredSignals ?? [])) {
      const present = Boolean(ctx.signals?.[req]) || Boolean(ctx.vehicle?.[req]) || Boolean(ctx.inputs?.[req]);
      if (!present) missing.add(req);
    }
  }
  return Array.from(missing);
}
