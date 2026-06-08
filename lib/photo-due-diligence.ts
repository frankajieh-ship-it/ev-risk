/**
 * Photo Due Diligence — Angle Classification + Damage Detection
 *
 * Uses GPT-4o Vision to:
 * 1. Classify each listing photo into a known angle (front, rear, interior, etc.)
 * 2. Detect damage, dents, scratches, rust, and other condition issues
 */

import OpenAI from "openai";
import { REQUIRED_ANGLES } from "./photo-due-diligence-types.js";
import type { DamageFinding } from "./photo-due-diligence-types.js";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 55_000,
      maxRetries: 0,
    });
  }
  return _client;
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

export async function classifyAngle(photoUrl: string): Promise<AngleId> {
  try {
    const response = await getClient().chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an automotive photo classifier. Classify the car photo into exactly one angle category. " +
            "Categories: front (front of vehicle), rear (back of vehicle), driver_side (left/driver side), " +
            "pass_side (right/passenger side), interior (inside cabin, seats, dashboard), " +
            "odometer (close-up of odometer/instrument cluster showing mileage), " +
            "engine (engine bay/hood open), tires (tires, wheels, or wheel wells), " +
            "undercarriage (underneath the vehicle), other (anything else).",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Classify this car photo." },
            { type: "image_url", image_url: { url: photoUrl, detail: "low" } },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 30,
      response_format: {
        type: "json_schema",
        json_schema: { name: "angle_classification", strict: true, schema: ANGLE_SCHEMA },
      },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { angle_id?: string };
    const id = parsed.angle_id ?? "other";
    return (ANGLE_IDS as readonly string[]).includes(id) ? (id as AngleId) : "other";
  } catch (err) {
    console.error("[classifyAngle] failed for", photoUrl.slice(0, 80), err);
    return "other";
  }
}

export async function detectDamage(photoUrl: string): Promise<DamageFinding[]> {
  try {
    const response = await getClient().chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an automotive damage inspector. Examine the car photo carefully for any visible damage: " +
            "dents, scratches, rust, cracks, paint fade, or missing parts. " +
            "Return an empty findings array if the photo is clean or if it shows an interior/odometer/engine (non-exterior). " +
            "For each finding specify: type, severity (minor/moderate/severe), exact location on the vehicle, " +
            "whether it meaningfully affects resale value, and a one-sentence description.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Inspect this car photo for damage." },
            { type: "image_url", image_url: { url: photoUrl, detail: "low" } },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 400,
      response_format: {
        type: "json_schema",
        json_schema: { name: "damage_detection", strict: true, schema: DAMAGE_SCHEMA },
      },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { findings?: DamageFinding[] };
    return Array.isArray(parsed.findings) ? parsed.findings : [];
  } catch (err) {
    console.error("[detectDamage] failed for", photoUrl.slice(0, 80), err);
    return [];
  }
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

