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
  "You are an expert automotive photo analyst reviewing used car listing photos.\n\n" +
  "For the photo provided, do TWO things:\n\n" +
  "STEP 1 — CLASSIFY the camera angle. Pick exactly one from this list:\n" +
  "  front        — Front of vehicle: headlights, grille, hood, front bumper facing camera. Most common listing photo.\n" +
  "  rear         — Back of vehicle: taillights, trunk/hatch, rear bumper, rear windshield.\n" +
  "  driver_side  — Left side profile of vehicle (driver side in US). Full side view, wheels visible.\n" +
  "  pass_side    — Right side profile of vehicle (passenger side in US). Full side view, wheels visible.\n" +
  "  interior     — Inside cabin: seats, steering wheel, dashboard, center console, door panels. Any shot from inside.\n" +
  "  odometer     — Instrument cluster or infotainment screen clearly showing mileage/odometer reading.\n" +
  "  engine       — Hood open showing engine bay, motor, battery pack, or underhood components.\n" +
  "  tires        — Close-up of tire tread, wheel rim, brake rotor, or wheel well.\n" +
  "  undercarriage — Shot from below showing frame rails, suspension arms, exhaust, or underbody.\n" +
  "  other        — ONLY use this if the photo is a badge/logo close-up, VIN sticker, document scan, or truly unclassifiable. Do NOT use other for exterior or interior shots.\n\n" +
  "CLASSIFICATION RULES:\n" +
  "  - If you can see the front bumper/headlights → front\n" +
  "  - If you can see the rear bumper/taillights → rear\n" +
  "  - If you see a full side profile of the car → driver_side or pass_side\n" +
  "  - If you are inside the car looking at seats/dash → interior\n" +
  "  - If the steering wheel, dashboard, or center console is prominent → interior\n" +
  "  - Aerial/angled 3/4 front shots → front\n" +
  "  - Aerial/angled 3/4 rear shots → rear\n" +
  "  - When unsure between driver_side and pass_side → pick driver_side\n" +
  "  - Only use 'other' as a last resort\n\n" +
  "STEP 2 — INSPECT for visible damage: dents, scratches, rust, cracks, paint fade/chips, missing trim, interior stains/tears, wheel/tire damage.\n" +
  "  - Be specific about location (e.g. 'rear bumper lower left', 'driver door panel')\n" +
  "  - Return empty findings array if the photo shows no visible damage\n" +
  "  - Only report damage that is clearly visible — do not speculate\n\n" +
  'Output JSON only: {"angle_id": "<one of the categories above>", "findings": [{"type": "dent|scratch|rust|crack|paint_fade|missing_part|other", "severity": "minor|moderate|severe", "location": "string", "affects_value": true|false, "description": "string"}]}';

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
            { type: "image_url", image_url: { url: photoUrl, detail: "high" } },
          ]},
        ],
        temperature: 0,
        max_tokens: 800,
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

