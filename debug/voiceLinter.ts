// debug/voiceLinter.ts

export type VoiceLintHit = {
  rule: string;
  match: string;
  index: number;
};

const bannedRules: Array<{ rule: string; rx: RegExp }> = [
  { rule: 'BANNED: "Probably"', rx: /\bprobably\b/i },
  { rule: 'BANNED: "Urgent"', rx: /\burgent\b/i },
  { rule: 'BANNED: "Better estimates"', rx: /\bbetter estimates\b/i },
  { rule: 'BANNED: "May limit" (without calibration)', rx: /\bmay limit\b/i },
  // "Consider" is only acceptable when paired with evaluation framing,
  // so we treat it as banned here and allow exceptions via block templates.
  { rule: 'BANNED: "Consider"', rx: /\bconsider\b/i },

  // CMO Phase 1 - Banned EV Debate Language
  { rule: 'BANNED: "Range anxiety"', rx: /\brange anxiety\b/i },
  { rule: 'BANNED: "EV vs ICE" debates', rx: /\bev vs ice\b/i },
  { rule: 'BANNED: "Spec evangelism" - avoid "game changer"', rx: /\bgame[- ]?changer\b/i },
  { rule: 'BANNED: "Charger count" arguments', rx: /\bcharger count\b/i },
  { rule: 'BANNED: Avoid "better than gas"', rx: /\bbetter than gas\b/i },
  { rule: 'BANNED: Avoid "future of driving"', rx: /\bfuture of driving\b/i },
];

/**
 * Approved CMO Phase 1 Phrases
 *
 * These phrases should be used in place of banned language:
 * - "Mental overhead" (not "range anxiety")
 * - "Routine friction" (not "inconvenience")
 * - "Predictability > availability"
 * - "Behavioral risk" (not "technical risk")
 * - "Fit mismatch" (not "wrong choice")
 */
export const approvedPhrases = {
  mentalOverhead: "mental overhead",
  routineFriction: "routine friction",
  predictability: "predictability",
  behavioralRisk: "behavioral risk",
  fitMismatch: "fit mismatch",
} as const;

export function lintVoice(text: string): { ok: boolean; hits: VoiceLintHit[] } {
  const hits: VoiceLintHit[] = [];
  for (const { rule, rx } of bannedRules) {
    let m: RegExpExecArray | null;
    const r = new RegExp(rx.source, rx.flags.includes("g") ? rx.flags : rx.flags + "g");
    while ((m = r.exec(text)) !== null) {
      hits.push({ rule, match: m[0], index: m.index });
      if (m.index === r.lastIndex) r.lastIndex++;
    }
  }
  return { ok: hits.length === 0, hits };
}

/**
 * Check if text uses approved CMO Phase 1 language
 */
export function hasApprovedLanguage(text: string): {
  mentalOverhead: boolean;
  routineFriction: boolean;
  predictability: boolean;
  behavioralRisk: boolean;
  fitMismatch: boolean;
} {
  return {
    mentalOverhead: /\bmental overhead\b/i.test(text),
    routineFriction: /\broutine friction\b/i.test(text),
    predictability: /\bpredictability\b/i.test(text),
    behavioralRisk: /\bbehavioral risk\b/i.test(text),
    fitMismatch: /\bfit mismatch\b/i.test(text),
  };
}
