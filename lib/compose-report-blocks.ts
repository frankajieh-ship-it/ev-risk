/**
 * Report Rendering Stability - Block Composition
 *
 * Purpose: Generate stable, ordered blocks with semantic IDs
 * Key: Blocks maintain identity across re-renders, preventing jumps
 */

import type { ReportBlock, ReportContext } from "@/types/reportBlocks";
import { getTierLabel, getTierMessaging } from "./confidence-hysteresis";
import {
  batteryHealthTemplate,
  recallsTemplate,
  chargingInfraTemplate,
  ownershipFitTemplate,
  priceValueTemplate,
  nextStepsTemplate,
} from "./messaging-templates";

/**
 * Compose report blocks from context
 *
 * Returns ordered, filtered blocks ready for rendering
 */
export function composeReportBlocks(ctx: ReportContext): ReportBlock[] {
  const blocks: ReportBlock[] = [];

  // Summary Block (always shown)
  blocks.push({
    id: "summary.v1",
    kind: "summary",
    priority: 10,
    content: generateSummaryContent(ctx),
  });

  // Risk Score Block (always shown)
  blocks.push({
    id: "riskScore.v1",
    kind: "risk",
    priority: 20,
    content: generateRiskScoreContent(ctx),
  });

  // Confidence Explanation Block (always shown, but content varies by tier)
  blocks.push({
    id: "confidence.explanation.v1",
    kind: "confidence",
    priority: 30,
    content: generateConfidenceContent(ctx),
  });

  // "Why This Score" Narrative (always shown)
  blocks.push({
    id: "why.score.v1",
    kind: "why",
    priority: 40,
    content: generateWhyScoreContent(ctx),
  });

  // Battery Context (only if confidence >= 35%)
  blocks.push({
    id: "battery.context.v1",
    kind: "battery_context",
    priority: 50,
    confidenceMin: 0.35,
    content: generateBatteryContextContent(ctx),
  });

  // Recalls (if recall data available)
  if (ctx.inputs.recalls && ctx.inputs.recalls.length > 0) {
    blocks.push({
      id: "recalls.v1",
      kind: "recalls",
      priority: 55,
      content: generateRecallsContent(ctx),
    });
  }

  // Ownership Fit (only if personalization provided)
  if (ctx.personalizationCount > 0) {
    blocks.push({
      id: "ownership.fit.v1",
      kind: "ownership_fit",
      priority: 60,
      personalizationRequired: true,
      content: generateOwnershipFitContent(ctx),
    });
  }

  // Trust Calibration (only for zero personalization)
  if (ctx.hasZeroPersonalization) {
    blocks.push({
      id: "trust.calibration.v1",
      kind: "trust_calibration",
      priority: 70,
      content: generateTrustCalibrationContent(ctx),
    });
  }

  // Next Steps (always shown)
  blocks.push({
    id: "nextSteps.v1",
    kind: "next_steps",
    priority: 80,
    content: generateNextStepsContent(ctx),
  });

  // Filter blocks based on confidence and personalization
  return blocks
    .filter((b) => {
      // Check minimum confidence
      if (b.confidenceMin !== undefined && ctx.confidence < b.confidenceMin) {
        return false;
      }
      // Check maximum confidence
      if (b.confidenceMax !== undefined && ctx.confidence > b.confidenceMax) {
        return false;
      }
      // Check personalization requirement
      if (b.personalizationRequired && ctx.personalizationCount === 0) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Generate summary content based on tier
 */
function generateSummaryContent(ctx: ReportContext): string {
  const tierLabel = getTierLabel(ctx.confidenceTier);
  const messaging = getTierMessaging(ctx.confidenceTier);

  return `Assessment Confidence: ${tierLabel}\n\n${messaging.summary}`;
}

/**
 * Generate risk score content
 */
function generateRiskScoreContent(ctx: ReportContext): string {
  const { overall, battery, platform, ownership } = ctx.scores;

  return `Overall Score: ${overall}/100

Battery Risk: ${battery}/100
Platform Risk: ${platform}/100
Ownership Fit: ${ownership}/100`;
}

/**
 * Generate confidence explanation content
 */
function generateConfidenceContent(ctx: ReportContext): string {
  const tierLabel = getTierLabel(ctx.confidenceTier);

  let content = `🔐 Confidence Level: ${tierLabel}\n\n`;

  if (ctx.confidenceTier >= 2) {
    content += `This assessment is based on ${
      ctx.personalizationCount > 0
        ? "your inputs and listing data"
        : "listing data and model-level information"
    }.\n\n`;
  } else {
    content += `This assessment has limited data. We're using model-level averages and industry benchmarks.\n\n`;
  }

  if (ctx.personalizationCount === 0) {
    content += `Adding your driving patterns and charging setup would increase confidence to ~95%.`;
  } else if (ctx.confidenceTier < 3) {
    content += `A vehicle-specific battery health report would significantly improve confidence.`;
  }

  return content;
}

/**
 * Generate "Why This Score" narrative
 */
function generateWhyScoreContent(ctx: ReportContext): string {
  const { overall } = ctx.scores;
  const age = ctx.inputs.year
    ? new Date().getFullYear() - ctx.inputs.year
    : undefined;

  if (overall >= 75) {
    return `This vehicle scores as low risk primarily due to its ${age}-year age and ${ctx.inputs.currentMileage?.toLocaleString()}-mile history. The main unknown is battery health verification, which is common for used EV listings.`;
  } else if (overall >= 50) {
    return `This vehicle scores as moderate risk due to a combination of age, mileage, and potential degradation factors. We recommend obtaining a battery health report before purchase.`;
  } else {
    return `This vehicle scores as higher risk primarily due to advanced age or high mileage. Battery replacement may be needed within 2-3 years.`;
  }
}

/**
 * Generate battery context content using voice-transformed template
 */
function generateBatteryContextContent(ctx: ReportContext): string {
  const age = ctx.inputs.year
    ? new Date().getFullYear() - ctx.inputs.year
    : 0;

  // Estimate degradation based on mileage and age
  const mileage = ctx.inputs.currentMileage || 0;
  const estimatedDegradation = Math.min(
    (mileage / 10000) * 1.5 + (age * 2),
    25
  );

  const template = batteryHealthTemplate(
    estimatedDegradation,
    age,
    263 // Tesla Model 3 base range
  );

  return `⚡ ${template.title}

${template.estimate}

${template.practicalMeaning}

🔐 Confidence: ${template.confidence.label}
${template.confidence.explanation}

💡 ${template.action.prompt}
${template.action.value}

⚠️ ${template.decisionImpact}`;
}

/**
 * Generate recalls content using voice-transformed template
 */
function generateRecallsContent(ctx: ReportContext): string {
  const recalls = ctx.inputs.recalls || [];
  const safetyRelatedCount = recalls.filter((r: any) => r.isSafetyRelated).length;
  const primaryRecall = recalls.find((r: any) => r.isSafetyRelated) || recalls[0];

  const template = recallsTemplate(
    recalls.length,
    safetyRelatedCount,
    primaryRecall?.description || "a component issue",
    primaryRecall?.estimatedTimeline || "3–7 days"
  );

  return `⚠️ ${template.title}

${template.summary}

📋 Context:
${template.context}

💡 Next Step:
${template.nextStep}

⚠️ Why it matters:
${template.whyItMatters}`;
}

/**
 * Generate ownership fit content (requires personalization) using voice-transformed template
 */
function generateOwnershipFitContent(ctx: ReportContext): string {
  const dailyMiles = ctx.inputs.dailyMiles || 30;
  const estimatedRange = 250;
  const homeCharging = ctx.inputs.homeCharging || false;

  const template = ownershipFitTemplate(dailyMiles, estimatedRange, homeCharging);

  return `📊 ${template.title}

${template.dailyUsage}

${template.assessment}

${template.chargingImpact}

🔐 Confidence: ${template.confidence.label}
${template.confidence.explanation}`;
}

/**
 * Generate trust calibration content (zero personalization only)
 */
function generateTrustCalibrationContent(ctx: ReportContext): string {
  return `⚠️ What's Missing — And Why It Matters

We couldn't verify this vehicle's battery health report.

Without it, we estimate risk using:
• ${ctx.inputs.currentMileage?.toLocaleString() || "Unknown"} miles reported
• ${
    ctx.inputs.year ? new Date().getFullYear() - ctx.inputs.year : "Unknown"
  } years since manufacture
• Average degradation patterns for ${ctx.inputs.model || "this model"}

If you can obtain a battery report or share how you plan to use the vehicle, we can significantly narrow this estimate.`;
}

/**
 * Generate next steps content using voice-transformed template
 */
function generateNextStepsContent(ctx: ReportContext): string {
  const batteryRisk: "low" | "medium" | "high" =
    ctx.scores.battery >= 85 ? "low" : ctx.scores.battery >= 70 ? "medium" : "high";

  const hasOpenRecalls = false; // TODO: Wire up real recall data
  const priceOverMarket = false; // TODO: Wire up price comparison

  const template = nextStepsTemplate(batteryRisk, hasOpenRecalls, priceOverMarket);

  return `📋 ${template.title}

${template.steps.map((step) => `${step}`).join("\n\n")}

⏱️ ${template.timeline}`;
}
