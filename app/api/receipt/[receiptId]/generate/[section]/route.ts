/**
 * On-Demand Section Generator
 *
 * POST /api/receipt/{receiptId}/generate/{section}
 *
 * Generates a single receipt section on demand when the user requests it.
 * Idempotent: returns cached data if already generated.
 *
 * Supported sections: reddit_draft | receipt_details | negotiation_deep
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { RateLimiter, getClientIP } from "@/lib/rate-limiter";
import {
  generateRedditDraft,
  generateReceiptDetails,
  generateNegotiationDeep,
  generateReceiptSummary,
} from "@/lib/receipt-sections";
import type { ListingReceipt } from "@/types/receipt";

const sectionRateLimiter = new RateLimiter(60 * 1000, 10); // 10 req/min per IP

const VALID_SECTIONS = ["reddit_draft", "receipt_details", "negotiation_deep", "receipt_summary"] as const;
type Section = (typeof VALID_SECTIONS)[number];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ receiptId: string; section: string }> }
) {
  const { receiptId, section } = await params;

  // Validate section name
  if (!VALID_SECTIONS.includes(section as Section)) {
    return NextResponse.json(
      { success: false, error: `Invalid section. Must be one of: ${VALID_SECTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  const sectionKey = section as Section;

  if (!receiptId || receiptId.length < 10) {
    return NextResponse.json(
      { success: false, error: "Invalid receipt ID" },
      { status: 400 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 503 }
    );
  }

  // Rate limit
  const ip = getClientIP(request);
  if (!sectionRateLimiter.check(ip).allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests" },
      { status: 429 }
    );
  }

  // Load receipt
  const { data, error } = await supabase
    .from("receipts")
    .select("id, generation_status, output_json, sections")
    .eq("id", receiptId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: "Receipt not found" },
      { status: 404 }
    );
  }

  if (data.generation_status !== "full") {
    return NextResponse.json(
      { success: false, error: "Receipt core upgrade not yet complete", generation_status: data.generation_status },
      { status: 409 }
    );
  }

  const sections = (data.sections as Record<string, { status: string; updated_at?: string }> | null) ?? {};
  const sectionState = sections[sectionKey];

  // Idempotency: return cached data if already ready
  if (sectionState?.status === "ready") {
    const receipt = data.output_json as ListingReceipt;
    return NextResponse.json({
      success: true,
      section: sectionKey,
      status: "ready",
      data: getSectionData(receipt, sectionKey),
    });
  }

  // If already running, ask caller to poll
  if (sectionState?.status === "running") {
    return NextResponse.json({
      success: true,
      section: sectionKey,
      status: "running",
    });
  }

  // Mark as running
  const updatedSections = {
    ...sections,
    [sectionKey]: { status: "running", updated_at: new Date().toISOString() },
  };
  await supabase
    .from("receipts")
    .update({ sections: updatedSections })
    .eq("id", receiptId);

  const receipt = data.output_json as ListingReceipt;
  const t0 = Date.now();

  try {
    // Generate the section
    let sectionData: unknown;
    let outputJsonPatch: Partial<ListingReceipt>;

    if (sectionKey === "reddit_draft") {
      const result = await generateRedditDraft(receipt);
      sectionData = result;
      outputJsonPatch = { reddit_draft: result };
    } else if (sectionKey === "receipt_details") {
      const result = await generateReceiptDetails(receipt);
      sectionData = result;
      outputJsonPatch = { receipt_details: result };
    } else if (sectionKey === "receipt_summary") {
      // Pass routine context stored in the receipt's extended fields if available
      const ext = data.output_json as Record<string, unknown>;
      const routineCtx = (ext.routine_context as Parameters<typeof generateReceiptSummary>[1]) ?? null;
      const result = await generateReceiptSummary(receipt, routineCtx);
      sectionData = result;
      outputJsonPatch = { receipt_summary: result } as Partial<ListingReceipt>;
    } else {
      const result = await generateNegotiationDeep(receipt);
      sectionData = result;
      outputJsonPatch = { negotiation_deep: result } as Partial<ListingReceipt>;
    }

    // Merge into output_json and mark section ready
    const updatedReceipt = { ...(data.output_json as object), ...outputJsonPatch };
    const readySections = {
      ...sections,
      [sectionKey]: { status: "ready", updated_at: new Date().toISOString() },
    };

    await supabase
      .from("receipts")
      .update({ output_json: updatedReceipt, sections: readySections })
      .eq("id", receiptId);

    // Fire-and-forget analytics
    supabase.from("user_events").insert({
      event_name: "section_generate_succeeded",
      event_data: {
        receipt_id: receiptId,
        section_name: sectionKey,
        latency_ms: Date.now() - t0,
      },
      timestamp: new Date().toISOString(),
    }).then(() => {}, () => {});

    return NextResponse.json({
      success: true,
      section: sectionKey,
      status: "ready",
      data: sectionData,
    });

  } catch (err) {
    console.error(`[Section Generate] Failed to generate ${sectionKey} for ${receiptId}:`, err);

    // Mark as failed
    const failedSections = {
      ...sections,
      [sectionKey]: { status: "failed", updated_at: new Date().toISOString() },
    };
    await supabase
      .from("receipts")
      .update({ sections: failedSections })
      .eq("id", receiptId);

    supabase.from("user_events").insert({
      event_name: "section_generate_failed",
      event_data: {
        receipt_id: receiptId,
        section_name: sectionKey,
        reason: err instanceof Error ? err.message : "unknown",
        latency_ms: Date.now() - t0,
      },
      timestamp: new Date().toISOString(),
    }).then(() => {}, () => {});

    return NextResponse.json(
      { success: false, error: "Section generation failed", section: sectionKey, status: "failed" },
      { status: 500 }
    );
  }
}

function getSectionData(receipt: ListingReceipt, section: Section): unknown {
  if (section === "reddit_draft") return receipt.reddit_draft;
  if (section === "receipt_details") return receipt.receipt_details;
  const ext = receipt as unknown as Record<string, unknown>;
  if (section === "receipt_summary") return ext.receipt_summary ?? null;
  return ext.negotiation_deep ?? null;
}
