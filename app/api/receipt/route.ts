/**
 * OFFO Listing Receipt — Generate API
 *
 * POST /api/receipt
 * Accepts listing URL/text, calls OpenAI, returns structured receipt JSON.
 *
 * Rate limits:
 * - Burst: 5 requests/hour per IP
 * - Daily: 1 free receipt/day per receipt_token (Pro unlimited)
 */

import { NextRequest, NextResponse } from "next/server";
import { getClientIP } from "@/lib/rate-limiter";
import { receiptBurstLimiter, checkDailyLimit, incrementDailyCount } from "@/lib/receipt-rate-limiter";
import { generateReceipt, fixReceiptFormatting } from "@/lib/receipt-openai";
import { validateReceiptSchema } from "@/lib/receipt-schema-validator";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { ReceiptGenerateRequest } from "@/types/receipt";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);

  // 1. Burst rate limit
  const burst = receiptBurstLimiter.check(clientIP);
  if (!burst.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Too many requests. Please try again later.",
        resetAt: new Date(burst.resetAt).toISOString(),
      },
      { status: 429 }
    );
  }

  // 2. Parse body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  // 3. Validate receipt_token
  const receiptToken = body.receipt_token;
  if (!receiptToken || typeof receiptToken !== "string" || receiptToken.length < 5) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid receipt_token" },
      { status: 400 }
    );
  }

  // 4. Validate actual content (bare URLs are not enough — OpenAI can't visit them)
  const hasText =
    body.listing_text &&
    typeof body.listing_text === "string" &&
    (body.listing_text as string).trim().length > 20;
  const hasStructuredFields =
    [body.year, body.make, body.model].filter(Boolean).length >= 2;

  if (!hasText && !hasStructuredFields) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Not enough listing data. Paste the listing text or fetch a supported URL first.",
      },
      { status: 400 }
    );
  }

  // 5. Daily free limit check
  const isPro = false; // placeholder for future Pro logic
  const dailyLimit = await checkDailyLimit(receiptToken as string, isPro);
  if (!dailyLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: "Free daily limit reached. Come back tomorrow or upgrade to Pro.",
        remaining_free: 0,
        resetAt: dailyLimit.resetAt,
      },
      { status: 429 }
    );
  }

  // 6. Build request
  const input: ReceiptGenerateRequest = {
    listing_url: (body.listing_url as string) || null,
    listing_text: (body.listing_text as string) || null,
    year: typeof body.year === "number" ? body.year : undefined,
    make: (body.make as string) || undefined,
    model: (body.model as string) || undefined,
    trim: (body.trim as string) || undefined,
    mileage: typeof body.mileage === "number" ? body.mileage : undefined,
    price: typeof body.price === "number" ? body.price : undefined,
    vin: (body.vin as string) || undefined,
    location: (body.location as string) || undefined,
    receipt_token: receiptToken as string,
    session_id: (body.session_id as string) || undefined,
    mode: "single",
  };

  try {
    // 7. Call OpenAI
    const { receipt, retried } = await generateReceipt(input);

    // 8. Validate receipt
    let validation = validateReceiptSchema(receipt);
    let lintPassed = validation.valid;
    let finalReceipt = validation.sanitized || receipt;

    // 8b. If lint failed, try formatting fixer for text-field issues
    if (!lintPassed) {
      console.log(
        `[Receipt API] Lint errors after ${retried ? "retry" : "first attempt"}:`,
        validation.errors
      );

      try {
        const patched = await fixReceiptFormatting(
          finalReceipt as unknown as Record<string, unknown>,
          validation.errors
        );
        if (patched) {
          const revalidation = validateReceiptSchema(patched);
          if (revalidation.valid || revalidation.errors.length < validation.errors.length) {
            finalReceipt = (revalidation.sanitized || patched) as typeof finalReceipt;
            validation = revalidation;
            lintPassed = revalidation.valid;
            console.log("[Receipt API] Formatting fixer improved result");
          }
        }
      } catch (fixErr) {
        console.error("[Receipt API] Formatting fixer error:", fixErr);
      }
    }

    // 9. Increment daily counter (in-memory fallback)
    incrementDailyCount(receiptToken as string);

    // 10. Log to Supabase
    if (isSupabaseConfigured()) {
      try {
        // Insert receipt record
        const urlDomain = input.listing_url
          ? new URL(input.listing_url).hostname.replace("www.", "")
          : null;

        const { error: receiptError } = await supabase.from("receipts").insert({
          id: finalReceipt.receipt_id,
          session_id: receiptToken,
          source: "receipt_page",
          listing_url: input.listing_url || null,
          url_domain: urlDomain,
          listing_text: input.listing_text
            ? input.listing_text.substring(0, 5000)
            : null,
          input_json: input,
          output_json: finalReceipt,
          mode: "single",
          is_pro: isPro,
        });

        if (receiptError) {
          console.error("[Receipt API] Failed to log receipt:", receiptError.message);
        }

        // Insert generate event
        const { error: eventError } = await supabase
          .from("receipt_events")
          .insert({
            receipt_id: finalReceipt.receipt_id,
            session_id: receiptToken,
            event_type: "generate",
            url_domain: urlDomain,
            verdict: finalReceipt.verdict,
            price_label: finalReceipt.price_sanity?.label || null,
          });

        if (eventError) {
          console.error("[Receipt API] Failed to log event:", eventError.message);
        }

        // Log lint_fail event if applicable
        if (!lintPassed) {
          await supabase.from("receipt_events").insert({
            receipt_id: finalReceipt.receipt_id,
            session_id: receiptToken,
            event_type: "lint_fail",
          });
        }
      } catch (logErr) {
        console.error("[Receipt API] Logging error:", logErr);
      }
    }

    // 11. Return response
    return NextResponse.json({
      success: true,
      receipt: finalReceipt,
      lint_passed: lintPassed,
      lint_errors: validation.errors,
      remaining_free: Math.max(0, dailyLimit.remaining - 1),
    });
  } catch (error) {
    console.error("[Receipt API] Generation error:", error);

    // Differentiate error codes
    const isOpenAIError =
      error instanceof Error &&
      (error.message.includes("timeout") ||
        error.message.includes("Connection error") ||
        error.message.includes("503") ||
        error.message.includes("429") ||
        error.message.includes("APIConnectionError") ||
        error.name === "APIConnectionError" ||
        error.name === "APIError");

    // Log generate_fail event
    if (isSupabaseConfigured()) {
      try {
        await supabase.from("receipt_events").insert({
          session_id: receiptToken,
          event_type: "generate_fail",
        });
      } catch {
        // swallow logging errors
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: isOpenAIError
          ? "AI service temporarily unavailable — please try again in a minute"
          : error instanceof Error
            ? error.message
            : "Failed to generate receipt",
      },
      { status: isOpenAIError ? 503 : 500 }
    );
  }
}
