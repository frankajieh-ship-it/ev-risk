import type { Block, RenderCtx } from "@/core/content";
import type { SignalKey } from "@/core/signals";

/**
 * Block Gating Logic
 *
 * Determines whether a block should be rendered based on signal availability
 * and the block's missing policy.
 */

export type GatingResult = {
  status: "ok" | "missing" | "withheld";
  missing: SignalKey[];
  withholdReason?: string;
};

export function evaluateBlockGating(
  block: Block,
  ctx: RenderCtx
): GatingResult {
  const required = block.requiredSignals ?? [];
  const missing = required.filter(key => !ctx.signals[key]);

  if (missing.length === 0) {
    return { status: "ok", missing: [] };
  }

  // Check if there's an explicit withhold reason
  const withhold = block.withhold?.(ctx);
  if (withhold) {
    return { status: "withheld", missing, withholdReason: withhold.why };
  }

  return { status: "missing", missing };
}

export function shouldRenderBlock(
  block: Block,
  gating: GatingResult
): boolean {
  if (gating.status === "ok") return true;
  if (block.missingPolicy === "hide") return false;
  return true; // "withhold" or "degrade" policies show something
}
