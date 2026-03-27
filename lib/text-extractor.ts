/**
 * Text-based vehicle listing field extraction via GPT-4o-mini.
 * Used when the user pastes listing text instead of a URL.
 * Server-side only (used in API routes).
 */

import OpenAI from "openai";
import type { FetchedListingFields } from "@/types/receipt";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export interface TextExtractionResult {
  fields: FetchedListingFields;
  extractedFields: string[];
  missingFields: string[];
  confidence: "high" | "medium" | "low";
}

export async function extractFieldsFromText(
  text: string
): Promise<TextExtractionResult> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Extract vehicle listing details from the provided text.
Return ONLY a JSON object with these fields (use null for anything not found):
{ "year": number|null, "make": string|null, "model": string|null, "trim": string|null,
  "mileage": number|null, "price": number|null, "vin": string|null, "location": string|null,
  "range_mi": number|null, "battery_kwh": number|null, "dc_fast_kw": number|null, "efficiency_mi_per_kwh": number|null }
Parse numbers correctly: "$32,500" → 32500, "45k miles" → 45000.
For VIN, only return if you find a valid 17-character alphanumeric string.
For EV specs: range_mi = EPA or stated range in miles; battery_kwh = usable battery capacity in kWh; dc_fast_kw = peak DC fast charging speed in kW; efficiency_mi_per_kwh = miles per kWh efficiency.`,
      },
      { role: "user", content: text.substring(0, 8000) },
    ],
    temperature: 0.1,
    max_tokens: 500,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);

  const fields: FetchedListingFields = {};
  const extractedFields: string[] = [];
  const missingFields: string[] = [];
  const allKeys = [
    "year",
    "make",
    "model",
    "trim",
    "mileage",
    "price",
    "vin",
    "location",
    "range_mi",
    "battery_kwh",
    "dc_fast_kw",
    "efficiency_mi_per_kwh",
  ];

  for (const key of allKeys) {
    if (parsed[key] !== null && parsed[key] !== undefined) {
      (fields as Record<string, unknown>)[key] = parsed[key];
      extractedFields.push(key);
    } else {
      missingFields.push(key);
    }
  }

  const confidence =
    extractedFields.length >= 4
      ? "high"
      : extractedFields.length >= 2
        ? "medium"
        : "low";

  return { fields, extractedFields, missingFields, confidence };
}
