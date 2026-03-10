/**
 * OFFO Decision Pack — Receipt PDF Download
 *
 * GET /api/receipt/[receiptId]/pdf?anon_id=...
 *
 * Generates and downloads a PDF receipt for paid purchases.
 * Includes deep dive content (page 2) if cached.
 */

import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { checkPurchaseStatus } from "@/lib/payment-status";
import { renderPdf } from "@/lib/pdf/render-client";
import { humanizeFlag } from "@/lib/receipt-rules";
import type { ReceiptPdfData } from "@/lib/pdf/shared-types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { receiptId } = await params;
  const url = new URL(req.url);
  const anonId = url.searchParams.get("anon_id");

  if (!anonId || anonId.length < 5) {
    return NextResponse.json({ error: "Missing or invalid anon_id" }, { status: 400 });
  }

  // 1. Check entitlement
  const status = await checkPurchaseStatus("receipt", receiptId, anonId);
  if (!status.unlocked_base || status.purchase_status !== "paid") {
    return NextResponse.json({ error: "Purchase required to download PDF" }, { status: 402 });
  }

  const packTier = status.pack_tier || "buyer_pass";

  try {
    // 2. Load receipt
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("output_json, session_id")
      .eq("id", receiptId)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    // 3. Verify ownership
    if (receipt.session_id !== anonId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const receiptData = receipt.output_json;
    if (!receiptData) {
      return NextResponse.json({ error: "Receipt data not available" }, { status: 400 });
    }

    // 4. Load deep dive if available
    let deepDive: { content: any } | null = null;
    {
      const { data } = await supabase
        .from("deep_dives")
        .select("content")
        .eq("scenario_type", "receipt")
        .eq("scenario_id", receiptId)
        .maybeSingle();
      deepDive = data;
    }

    // 5. Transform to ReceiptPdfData
    const ls = receiptData.listing_summary || {};
    const rd = receiptData.receipt_details;

    const pdfData: ReceiptPdfData = {
      receiptId,
      verdict: receiptData.verdict || "YELLOW",
      verdictReason: receiptData.verdict_reason || "",
      priceSanity: receiptData.price_sanity
        ? {
            label: receiptData.price_sanity.label || "UNKNOWN",
            confidence: receiptData.price_sanity.confidence || 0,
            rationale: receiptData.price_sanity.rationale_short || "",
          }
        : null,
      riskFlags: (receiptData.risk_flags || []).map(humanizeFlag),
      mustAnswerQuestions: receiptData.must_answer_questions || [],
      inspectFirst: receiptData.inspect_first || [],
      negotiationOpener: receiptData.negotiation_opener || "",
      listingSummary: {
        year: ls.year || 0,
        make: ls.make || "Unknown",
        model: ls.model || "Vehicle",
        trim: ls.trim || null,
        price: ls.price || 0,
        currency: ls.currency || "USD",
        mileage: ls.mileage || 0,
        mileageUnit: ls.mileage_unit || "mi",
        sellerType: ls.seller_type || "unknown",
        location: ls.zip_or_postcode || ls.country || "",
      },
      receiptDetails: rd
        ? {
            feeEstimates: rd.fee_estimates
              ? {
                  notes: rd.fee_estimates.notes || undefined,
                  taxEstimateRange: rd.fee_estimates.tax_estimate_range || null,
                  docFeeEstimateRange: rd.fee_estimates.doc_fee_estimate_range || null,
                }
              : null,
            commonListingTricks: rd.common_listing_tricks || [],
            walkAwayTriggers: rd.walk_away_triggers || [],
          }
        : null,
      deepDive: deepDive?.content || null,
      generatedAt: new Date().toISOString(),
    };

    // 6. Render PDF
    const pdfBuffer = await renderPdf({ version: "receipt", receiptData: pdfData });

    // 7. Create filename
    const year = ls.year || "Unknown";
    const make = (ls.make || "Unknown").replace(/\s+/g, "-");
    const model = (ls.model || "Unknown").replace(/\s+/g, "-");
    const shortId = receiptId.slice(0, 8);
    const filename = `OFFO-Receipt-${year}-${make}-${model}-${shortId}.pdf`;

    // 8. Track download event
    const clientIP =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    try {
      await supabase.from("user_events").insert({
        event_name: "download_pdf_succeeded",
        event_data: {
          receipt_id: receiptId,
          scenario_type: "receipt",
          vehicle_year: ls.year,
          vehicle_make: ls.make,
          vehicle_model: ls.model,
          has_deep_dive: !!deepDive?.content,
          pack_tier: packTier,
        },
        ip_address: clientIP,
        user_agent: userAgent,
        page_path: `/api/receipt/${receiptId}/pdf`,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Don't fail download if tracking fails
    }

    // 9. Return PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error) {
    console.error("[Receipt PDF] Generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate PDF",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
