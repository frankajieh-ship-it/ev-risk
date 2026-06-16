/**
 * Photo Due Diligence — Angle Classification + Damage Detection
 *
 * Uses GPT-4o Vision (primary) or Claude claude-sonnet-4-6 (fallback) to:
 * 1. Classify each listing photo into a known angle (front, rear, interior, etc.)
 * 2. Detect damage, dents, scratches, rust, and other condition issues
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { REQUIRED_ANGLES } from "./photo-due-diligence-types.js";
import type { DamageFinding } from "./photo-due-diligence-types.js";

let _openai: OpenAI | null = null;
let _anthropic: Anthropic | null = null;

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 55_000, maxRetries: 0 });
  }
  return _openai;
}

function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

// Parse a base64 data URL into mediaType + data for Anthropic SDK
function parseDataUrl(dataUrl: string): { mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; data: string } | null {
  const m = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!m) return null;
  const mt = m[1] as string;
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mt)) return null;
  return { mediaType: mt as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: m[2] };
}

const ANGLE_IDS = [...REQUIRED_ANGLES.map((a) => a.id), "other"] as const;
type AngleId = (typeof ANGLE_IDS)[number];

// ---------------------------------------------------------------------------
// JSON schemas for structured output
// ---------------------------------------------------------------------------

const ANGLE_SCHEMA = {
  type: "object",
  properties: {
    angle_id: {
      type: "string",
      enum: [...ANGLE_IDS],
    },
  },
  required: ["angle_id"],
  additionalProperties: false,
} as const;

const DAMAGE_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["dent", "scratch", "rust", "crack", "paint_fade", "missing_part", "other"],
          },
          severity: {
            type: "string",
            enum: ["minor", "moderate", "severe"],
          },
          location:      { type: "string" },
          affects_value: { type: "boolean" },
          description:   { type: "string" },
        },
        required: ["type", "severity", "location", "affects_value", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["findings"],
  additionalProperties: false,
} as const;

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

const COMBINED_SYSTEM =
  "You are an automotive photo analyst. For each car photo, do two things:\n" +
  "1. CLASSIFY the angle into exactly one category:\n" +
  "   - front: headlights, grille, hood, front bumper visible — vehicle faces camera\n" +
  "   - rear: taillights, trunk/hatch, rear bumper visible — back of vehicle faces camera\n" +
  "   - driver_side: left side profile (US driver side)\n" +
  "   - pass_side: right side profile (US passenger side)\n" +
  "   - interior: cabin — seats, steering wheel, dashboard, console, doors from inside\n" +
  "   - odometer: instrument cluster or screen showing mileage\n" +
  "   - engine: hood open showing engine bay or motor\n" +
  "   - tires: close-up of tire, wheel, rim, or wheel well\n" +
  "   - undercarriage: shot from underneath showing frame, suspension, exhaust\n" +
  "   - other: badge close-ups, feature details, or anything not matching above\n" +
  "   When in doubt between driver_side and pass_side, pick driver_side.\n" +
  "2. INSPECT for visible damage: dents, scratches, rust, cracks, paint fade, missing parts, interior damage, tire/wheel damage.\n" +
  "   Return empty findings array if everything looks clean.\n" +
  'Respond with JSON only: {"angle_id": "<category>", "findings": [{"type": "dent|scratch|rust|crack|paint_fade|missing_part|other", "severity": "minor|moderate|severe", "location": "string", "affects_value": true|false, "description": "string"}]}';

const COMBINED_SCHEMA = {
  type: "object",
  properties: {
    angle_id: { type: "string", enum: [...ANGLE_IDS] },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type:          { type: "string", enum: ["dent", "scratch", "rust", "crack", "paint_fade", "missing_part", "other"] },
          severity:      { type: "string", enum: ["minor", "moderate", "severe"] },
          location:      { type: "string" },
          affects_value: { type: "boolean" },
          description:   { type: "string" },
        },
        required: ["type", "severity", "location", "affects_value", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["angle_id", "findings"],
  additionalProperties: false,
} as const;

/** Analyse a single photo: classify angle + detect damage in one API call. */
export async function analysePhoto(photoUrl: string): Promise<{ angle_id: AngleId; findings: DamageFinding[] }> {
  const fallback = { angle_id: "other" as AngleId, findings: [] };

  // OpenAI primary — use "auto" detail so GPT-4o tiles large images properly
  const openai = getOpenAI();
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4o",
        messages: [
          { role: "system", content: COMBINED_SYSTEM },
          { role: "user", content: [
            { type: "text", text: "Analyse this car photo." },
            { type: "image_url", image_url: { url: photoUrl, detail: "auto" } },
          ]},
        ],
        temperature: 0,
        max_tokens: 500,
        response_format: { type: "json_schema", json_schema: { name: "photo_analysis", strict: true, schema: COMBINED_SCHEMA } },
      });
      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as { angle_id?: string; findings?: DamageFinding[] };
      const id = parsed.angle_id ?? "other";
      return {
        angle_id: (ANGLE_IDS as readonly string[]).includes(id) ? (id as AngleId) : "other",
        findings: Array.isArray(parsed.findings) ? parsed.findings : [],
      };
    } catch (err) {
      console.error("[analysePhoto] OpenAI failed, trying Anthropic:", err);
    }
  }

  // Anthropic fallback
  const anthropic = getAnthropic();
  if (anthropic) {
    try {
      const parsed = parseDataUrl(photoUrl);
      if (!parsed) return fallback;
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: COMBINED_SYSTEM,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: parsed.mediaType, data: parsed.data } },
            { type: "text", text: "Analyse this car photo." },
          ],
        }],
      });
      const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) as { angle_id?: string; findings?: DamageFinding[] } : {};
      const id = result.angle_id ?? "other";
      return {
        angle_id: (ANGLE_IDS as readonly string[]).includes(id) ? (id as AngleId) : "other",
        findings: Array.isArray(result.findings) ? result.findings : [],
      };
    } catch (err) {
      console.error("[analysePhoto] Anthropic also failed:", err);
    }
  }

  return fallback;
}

/** @deprecated Use analysePhoto() instead — kept for any direct callers */
export async function classifyAngle(photoUrl: string): Promise<AngleId> {
  const result = await analysePhoto(photoUrl);
  return result.angle_id;
}

/** @deprecated Use analysePhoto() instead — kept for any direct callers */
export async function detectDamage(photoUrl: string): Promise<DamageFinding[]> {
  const result = await analysePhoto(photoUrl);
  return result.findings;
}

// ---------------------------------------------------------------------------
// Coverage scoring
// ---------------------------------------------------------------------------

export function buildCoverage(presentAngles: string[]): {
  present: string[];
  missing: string[];
  coverage_score: number;
} {
  const presentSet = new Set(presentAngles);
  const present = REQUIRED_ANGLES.filter((a) => presentSet.has(a.id)).map((a) => a.id);
  const missing = REQUIRED_ANGLES.filter((a) => !presentSet.has(a.id)).map((a) => a.id);

  const required = REQUIRED_ANGLES.filter((a) => a.required);
  const requiredPresent = required.filter((a) => presentSet.has(a.id)).length;
  const optional = REQUIRED_ANGLES.filter((a) => !a.required);
  const optionalPresent = optional.filter((a) => presentSet.has(a.id)).length;

  // Required angles worth 80% of score, optional 20%
  const requiredScore = required.length > 0 ? (requiredPresent / required.length) * 80 : 80;
  const optionalScore = optional.length > 0 ? (optionalPresent / optional.length) * 20 : 20;
  const coverage_score = Math.round(requiredScore + optionalScore);

  return { present, missing, coverage_score };
}

