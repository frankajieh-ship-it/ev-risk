/**
 * Generate Reddit-style summary from report verdict
 * 4 lines max, no marketing, no links
 */

interface RedditSummaryInput {
  fitSignal: "Good Fit" | "Good Fit — with conditions" | "Conditional Fit" | "High Friction";
  oneLiner: string;
  becomesAnnoyingIf: string;
  whatBreaksFirst: string[];
  vehicle: string;
}

export function generateRedditSummary(input: RedditSummaryInput): string {
  const { fitSignal, oneLiner, becomesAnnoyingIf, whatBreaksFirst, vehicle } = input;

  // Line 1: Vehicle + Fit Signal
  const line1 = `**${vehicle}** — ${fitSignal}`;

  // Line 2: One-liner
  const line2 = oneLiner;

  // Line 3: Becomes annoying if
  const line3 = `Becomes annoying if: ${becomesAnnoyingIf}`;

  // Line 4: What breaks first (pick top 2)
  const topBreakers = whatBreaksFirst.slice(0, 2).join(", ");
  const line4 = `Watch: ${topBreakers}`;

  return [line1, line2, line3, line4].join("\n");
}
