/**
 * Reddit Draft Renderer
 *
 * Pure function that renders a structured RedditDraft object into flat text.
 * Three modes: short_paragraph (default), standard, bullets.
 * Safe to use in both server and client components.
 */

import type { RedditDraft } from "./receipt-schema-validator";

export type RedditDraftStyle = "short_paragraph" | "standard" | "bullets";

const MAX_CHARS = 900;

export function renderRedditDraft(
  draft: RedditDraft,
  styleOverride?: RedditDraftStyle
): string {
  const style = styleOverride || draft.style?.format || "short_paragraph";

  switch (style) {
    case "short_paragraph":
      return renderShortParagraph(draft);
    case "standard":
      return renderStandard(draft);
    case "bullets":
      return renderBullets(draft);
    default:
      return renderShortParagraph(draft);
  }
}

function renderShortParagraph(draft: RedditDraft): string {
  const parts: string[] = [];

  // Title
  parts.push(draft.title);
  parts.push("");

  // Body: facts + uncertainty + next steps joined into flowing text
  const bodyParts: string[] = [];
  bodyParts.push(...draft.body_facts);
  if (draft.body_uncertainty.length > 0) {
    bodyParts.push(...draft.body_uncertainty);
  }
  if (draft.body_next_steps.length > 0) {
    bodyParts.push(...draft.body_next_steps);
  }
  parts.push(bodyParts.join(" "));

  // Questions
  if (draft.questions.length > 0) {
    parts.push("");
    parts.push(draft.questions.join(" "));
  }

  return truncate(parts.join("\n"));
}

function renderStandard(draft: RedditDraft): string {
  const parts: string[] = [];

  // Title
  parts.push(draft.title);
  parts.push("");

  // Facts paragraph
  parts.push(draft.body_facts.join(" "));

  // Uncertainty
  if (draft.body_uncertainty.length > 0) {
    parts.push(draft.body_uncertainty.join(" "));
  }

  // Next steps
  if (draft.body_next_steps.length > 0) {
    parts.push(draft.body_next_steps.join(" "));
  }

  // Questions
  if (draft.questions.length > 0) {
    parts.push("");
    for (const q of draft.questions) {
      parts.push(q);
    }
  }

  return truncate(parts.join("\n"));
}

function renderBullets(draft: RedditDraft): string {
  const parts: string[] = [];

  // Title
  parts.push(draft.title);
  parts.push("");

  // Facts as bullets
  for (const fact of draft.body_facts) {
    parts.push(`- ${fact}`);
  }

  // Uncertainty as bullets
  if (draft.body_uncertainty.length > 0) {
    for (const u of draft.body_uncertainty) {
      parts.push(`- ${u}`);
    }
  }

  // Next steps as bullets
  if (draft.body_next_steps.length > 0) {
    for (const s of draft.body_next_steps) {
      parts.push(`- ${s}`);
    }
  }

  // Questions
  if (draft.questions.length > 0) {
    parts.push("");
    for (const q of draft.questions) {
      parts.push(q);
    }
  }

  return truncate(parts.join("\n"));
}

function truncate(text: string): string {
  if (text.length <= MAX_CHARS) return text;

  // Truncate at last complete sentence before the limit
  const cut = text.substring(0, MAX_CHARS);
  const lastPeriod = cut.lastIndexOf(".");
  const lastQuestion = cut.lastIndexOf("?");
  const lastBreak = Math.max(lastPeriod, lastQuestion);

  if (lastBreak > MAX_CHARS * 0.5) {
    return cut.substring(0, lastBreak + 1);
  }

  return cut.trimEnd() + "...";
}
