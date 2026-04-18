/**
 * Shared deal quality scoring function.
 * Used by both the automated ingest pipeline and the manual CSV import route.
 *
 * Score = evidence×0.35 + (10−risk)×5×0.4 + fit×0.25
 * Defaults: evidence=50, risk=5, fit=50 → score=50
 */
export function computeDealQualityScore(
  evidenceScore: number | null,
  riskPoints: number | null,
  fitScore: number | null
): number {
  const evidence = evidenceScore ?? 50;
  const risk = riskPoints ?? 5;
  const fit = fitScore ?? 50;
  return Math.round(evidence * 0.35 + (10 - risk) * 5 * 0.4 + fit * 0.25);
}
