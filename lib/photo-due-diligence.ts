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

const ANGLE_SYSTEM =
  "You are an automotive photo classifier. Classify the car photo into exactly one angle category. " +
  "Categories: front (front of vehicle), rear (back of vehicle), driver_side (left/driver side), " +
  "pass_side (right/passenger side), interior (inside cabin, seats, dashboard), " +
  "odometer (close-up of odometer/instrument cluster showing mileage), " +
  "engine (engine bay/hood open), tires (tires, wheels, or wheel wells), " +
  "undercarriage (underneath the vehicle), other (anything else). " +
  'Respond with JSON only: {"angle_id": "<category>"}';

const DAMAGE_SYSTEM =
  "You are an automotive damage inspector. Examine the car photo for visible damage: " +
  "dents, scratches, rust, cracks, paint fade, or missing parts. " +
  "Return an empty findings array if the photo is clean or shows interior/odometer/engine. " +
  'Respond with JSON only: {"findings": [{"type": "dent|scratch|rust|crack|paint_fade|missing_part|other", ' +
  '"severity": "minor|moderate|severe", "location": "string", "affects_value": true|false, "description": "string"}]}';

export async function classifyAngle(photoUrl: string): Promise<AngleId> {
  // Try OpenAI first
  const openai = getOpenAI();
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4o",
        messages: [
          { role: "system", content: ANGLE_SYSTEM },
          { role: "user", content: [
            { type: "text", text: "Classify this car photo." },
            { type: "image_url", image_url: { url: photoUrl, detail: "low" } },
          ]},
        ],
        temperature: 0,
        max_tokens: 30,
        response_format: { type: "json_schema", json_schema: { name: "angle_classification", strict: true, schema: ANGLE_SCHEMA } },
      });
      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as { angle_id?: string };
      const id = parsed.angle_id ?? "other";
      return (ANGLE_IDS as readonly string[]).includes(id) ? (id as AngleId) : "other";
    } catch (err) {
      console.error("[classifyAngle] OpenAI failed, trying Anthropic:", err);
    }
  }

  // Anthropic fallback (Claude supports base64 vision)
  const anthropic = getAnthropic();
  if (anthropic) {
    try {
      const parsed = parseDataUrl(photoUrl);
      if (!parsed) return "other";
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 64,
        system: ANGLE_SYSTEM,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: parsed.mediaType, data: parsed.data } },
            { type: "text", text: "Classify this car photo." },
          ],
        }],
      });
      const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) as { angle_id?: string } : {};
      const id = result.angle_id ?? "other";
      return (ANGLE_IDS as readonly string[]).includes(id) ? (id as AngleId) : "other";
    } catch (err) {
      console.error("[classifyAngle] Anthropic also failed:", err);
    }
  }

  return "other";
}

export async function detectDamage(photoUrl: string): Promise<DamageFinding[]> {
  // Try OpenAI first
  const openai = getOpenAI();
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4o",
        messages: [
          { role: "system", content: DAMAGE_SYSTEM },
          { role: "user", content: [
            { type: "text", text: "Inspect this car photo for damage." },
            { type: "image_url", image_url: { url: photoUrl, detail: "low" } },
          ]},
        ],
        temperature: 0,
        max_tokens: 400,
        response_format: { type: "json_schema", json_schema: { name: "damage_detection", strict: true, schema: DAMAGE_SCHEMA } },
      });
      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as { findings?: DamageFinding[] };
      return Array.isArray(parsed.findings) ? parsed.findings : [];
    } catch (err) {
      console.error("[detectDamage] OpenAI failed, trying Anthropic:", err);
    }
  }

  // Anthropic fallback
  const anthropic = getAnthropic();
  if (anthropic) {
    try {
      const parsed = parseDataUrl(photoUrl);
      if (!parsed) return [];
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        system: DAMAGE_SYSTEM,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: parsed.mediaType, data: parsed.data } },
            { type: "text", text: "Inspect this car photo for damage." },
          ],
        }],
      });
      const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) as { findings?: DamageFinding[] } : {};
      return Array.isArray(result.findings) ? result.findings : [];
    } catch (err) {
      console.error("[detectDamage] Anthropic also failed:", err);
    }
  }

  return [];
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

