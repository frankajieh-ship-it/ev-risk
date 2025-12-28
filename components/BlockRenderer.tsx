// components/BlockRenderer.tsx
import React from "react";
import { Block, RenderCtx } from "@/core/content";
import { confidenceText, guidancePrefix, tierLabel, urgencyCalibration, withholdText } from "@/core/templates";
import { evaluateBlockGating, shouldRenderBlock } from "@/core/runtime/blockGating";

type Props = {
  block: Block;
  ctx: RenderCtx;
  // called when user provides requested personalization input (Phase 1)
  onProvide?: (key: string, value: any) => void;
};

function tierStyle(tier: 1|2|3|4) {
  // Keep simple + stable; tier affects subtle weight, not visual noise.
  if (tier === 1) return "border-red-200";
  if (tier === 2) return "border-amber-200";
  if (tier === 3) return "border-slate-200";
  return "border-slate-100";
}

export const BlockRenderer: React.FC<Props> = ({ block, ctx, onProvide }) => {
  // Evaluate block gating (missing signals + policy)
  const gating = evaluateBlockGating(block, ctx);

  // Check if block should render at all
  if (!shouldRenderBlock(block, gating)) {
    return null; // Hidden per "hide" policy
  }

  const w = block.withhold?.(ctx);
  const u = (block.urgency?.(ctx)) ?? { level: "none" as const };

  const conf = block.confidence(ctx);
  const cf = block.confidenceFrame(ctx);

  const ask = block.ask?.(ctx);

  // Determine if we should use degraded rendering
  const isDegraded = gating.status === "missing" && block.missingPolicy === "degrade";

  return (
    <section className={`rounded-xl border bg-white p-4 ${tierStyle(block.tier)} min-h-[110px]`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {tierLabel(block.tier)}
          </div>
          <h3 className="mt-1 text-base font-semibold text-slate-900">
            {"title" in block ? block.title : "Section"}
          </h3>
        </div>

        <div className="text-xs text-slate-500 tabular-nums">
          {(conf * 100).toFixed(0)}%
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-800">
        {gating.status === "withheld" ? (
          <p className="text-amber-700 bg-amber-50 p-3 rounded-lg">
            {withholdText(w!)}
          </p>
        ) : (
          <>
            {block.kind === "metric" ? (
              <>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">{block.metric(ctx).label}</div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {block.metric(ctx).value}
                  </div>
                </div>
                <p className={isDegraded ? "text-slate-600 italic" : ""}>
                  {isDegraded && block.degradedRender
                    ? block.degradedRender(ctx, gating.missing)
                    : block.render?.(ctx)}
                </p>
              </>
            ) : (
              <p className={isDegraded ? "text-slate-600 italic" : ""}>
                <span className="font-medium">
                  {guidancePrefix(
                    isDegraded
                      ? Math.max(block.guidanceLevel, 3) as 1 | 2 | 3 // Force to "evaluate" when degraded
                      : block.guidanceLevel
                  )}:{" "}
                </span>
                {isDegraded && block.degradedRender
                  ? block.degradedRender(ctx, gating.missing)
                  : block.render(ctx)}
              </p>
            )}

            {/* Confidence block with degraded indicator */}
            <div className={`rounded-lg p-3 ${isDegraded ? "bg-amber-50" : "bg-slate-50"}`}>
              {isDegraded && (
                <div className="text-xs font-medium text-amber-700 mb-1">
                  Partial analysis — missing {gating.missing.join(", ")}
                </div>
              )}
              <div className="text-xs font-medium text-slate-600">Confidence</div>
              <div className="mt-1 text-sm text-slate-700">{confidenceText(cf)}</div>
              {urgencyCalibration(u) ? (
                <div className="mt-2 text-sm text-slate-700">
                  <span className="text-xs font-medium text-slate-600">Timing: </span>
                  {urgencyCalibration(u)}
                </div>
              ) : null}
            </div>
          </>
        )}

        {/* Personalization prompt (only show if not withheld) */}
        {ask && gating.status !== "withheld" ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-xs font-medium text-slate-600">Personalization</div>
            <div className="mt-1 text-sm text-slate-800">{ask.message}</div>
            {/* UI minimal: you can wire this to your existing PersonalizationPrompt component */}
            {onProvide ? (
              <div className="mt-2">
                <button
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                  onClick={() => onProvide(ask.key, true)}
                >
                  Provide {ask.key}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
};
