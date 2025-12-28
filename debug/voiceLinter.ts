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
];

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
