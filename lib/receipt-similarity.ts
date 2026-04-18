/**
 * Receipt Similarity Engine
 *
 * When OpenAI times out, finds the most similar successful AI-generated
 * receipt from the database to serve instead of a generic fallback.
 *
 * Scoring: weighted similarity across make, model, year, mileage, price, trim.
 * Max score = 100. Minimum threshold = 0.40 (40%).
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import type { ListingReceipt, ReceiptGenerateRequest } from "../types/receipt";

const MIN_CONFIDENCE = 0.40;
const MAX_CANDIDATES = 50;

export interface SimilarReceiptResult {
  receipt: ListingReceipt;
  confidence: number;
  matchedReceiptId: string;
  matchDetails: {
    make_match: boolean;
    model_match: boolean;
    year_diff: number;
    mileage_diff_pct: number;
    price_diff_pct: number;
  };
}

interface CandidateRow {
  id: string;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
}

/**
 * Find the most similar successful receipt for a given input.
 * Returns null if no match above threshold or if Supabase is not configured.
 */
export async function findSimilarReceipt(
  input: ReceiptGenerateRequest
): Promise<SimilarReceiptResult | null> {
  if (!isSupabaseConfigured()) return null;
  if (!input.make) return null;

  try {
    const { data: rows, error } = await supabase
      .from("receipts")
      .select("id, input_json, output_json")
      .not("output_json->receipt_details", "is", null)
      .ilike("input_json->>make", input.make)
      .order("created_at", { ascending: false })
      .limit(MAX_CANDIDATES);

    if (error || !rows || rows.length === 0) return null;

    let bestScore = 0;
    let bestCandidate: CandidateRow | null = null;

    for (const row of rows as CandidateRow[]) {
      const cInput = row.input_json;
      const score = computeSimilarity(input, cInput);
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = row;
      }
    }

    const confidence = bestScore / 100;
    if (!bestCandidate || confidence < MIN_CONFIDENCE) return null;

    const cInput = bestCandidate.input_json;
    const candidateMileage = typeof cInput.mileage === "number" ? cInput.mileage : 0;
    const candidatePrice = typeof cInput.price === "number" ? cInput.price : 0;

    return {
      receipt: bestCandidate.output_json as unknown as ListingReceipt,
      confidence,
      matchedReceiptId: bestCandidate.id,
      matchDetails: {
        make_match: true,
        model_match: normalizeStr(cInput.model) === normalizeStr(input.model),
        year_diff: Math.abs((typeof cInput.year === "number" ? cInput.year : 0) - (input.year || 0)),
        mileage_diff_pct: input.mileage && input.mileage > 0
          ? Math.abs(candidateMileage - input.mileage) / input.mileage
          : 1,
        price_diff_pct: input.price && input.price > 0
          ? Math.abs(candidatePrice - input.price) / input.price
          : 1,
      },
    };
  } catch {
    // Similarity lookup failed — don't block the fallback path
    return null;
  }
}

/**
 * Compute weighted similarity score (0-100) between input and a candidate.
 */
function computeSimilarity(
  input: ReceiptGenerateRequest,
  candidate: Record<string, unknown>
): number {
  let score = 0;

  // Model (30 points)
  const inputModel = normalizeStr(input.model);
  const candModel = normalizeStr(candidate.model);
  if (inputModel && candModel) {
    if (inputModel === candModel) {
      score += 30;
    } else if (inputModel.includes(candModel) || candModel.includes(inputModel)) {
      score += 15;
    }
  }

  // Year (25 points) — max(0, 25 - abs(diff) * 5)
  const inputYear = input.year || 0;
  const candYear = typeof candidate.year === "number" ? candidate.year : 0;
  if (inputYear > 0 && candYear > 0) {
    score += Math.max(0, 25 - Math.abs(candYear - inputYear) * 5);
  }

  // Mileage (20 points) — proportional difference
  const inputMileage = input.mileage || 0;
  const candMileage = typeof candidate.mileage === "number" ? candidate.mileage : 0;
  if (inputMileage > 0 && candMileage > 0) {
    const diffPct = Math.abs(candMileage - inputMileage) / inputMileage;
    score += Math.max(0, 20 - diffPct * 40);
  }

  // Price (15 points) — proportional difference
  const inputPrice = input.price || 0;
  const candPrice = typeof candidate.price === "number" ? candidate.price : 0;
  if (inputPrice > 0 && candPrice > 0) {
    const diffPct = Math.abs(candPrice - inputPrice) / inputPrice;
    score += Math.max(0, 15 - diffPct * 30);
  }

  // Trim (10 points)
  const inputTrim = normalizeStr(input.trim);
  const candTrim = normalizeStr(candidate.trim);
  if (inputTrim && candTrim) {
    if (inputTrim === candTrim) {
      score += 10;
    } else if (inputTrim.includes(candTrim) || candTrim.includes(inputTrim)) {
      score += 5;
    }
  }

  return score;
}

function normalizeStr(val: unknown): string {
  if (typeof val === "string") return val.toLowerCase().trim();
  return "";
}
