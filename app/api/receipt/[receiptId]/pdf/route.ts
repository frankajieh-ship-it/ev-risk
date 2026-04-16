/**
 * GET /api/receipt/[receiptId]/pdf
 *
 * Generate and return a PDF report for a completed receipt analysis.
 * Delegates rendering to the Netlify render-pdf function using the
 * receipt PDF template.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/api-auth";
import { getClientIP, RateLimiter } from "@/lib/rate-limiter";
import { isInternalTester } from "@/lib/rollout-flags";
import type { ReceiptPdfData } from "@/lib/pdf/shared-types";

export const maxDuration = 30;

const rateLimiter = new RateLimiter(60 * 1000, 5); // 5/min per IP

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  const ip = getClientIP(request);
  const rateCheck = rateLimiter.check(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
  }

  const { receiptId } = await params;
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!receiptId || !UUID_REGEX.test(receiptId)) {
    return NextResponse.json({ success: false, error: "Invalid receipt ID" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Service unavailable" }, { status: 503 });
  }

  const [{ data: row }, { data: deepDiveRow }] = await Promise.all([
    supabase.from("receipts").select("id, output_json, created_at").eq("id", receiptId).maybeSingle(),
    supabase.from("deep_dives").select("content").eq("scenario_type", "receipt").eq("scenario_id", receiptId).maybeSingle(),
  ]);

  if (!row || !row.output_json) {
    return NextResponse.json({ success: false, error: "Receipt not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = row.output_json as any;
  const ls = o.listing_summary ?? {};

  // Generate QR code for the shareable verdict URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://offolabs.com";
  const shareUrl = `${siteUrl}/receipt?id=${receiptId}`;
  let shareQrDataUri: string | undefined;
  try {
    const qrRes = await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}&format=png`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (qrRes.ok) {
      const qrBuf = Buffer.from(await qrRes.arrayBuffer());
      shareQrDataUri = `data:image/png;base64,${qrBuf.toString("base64")}`;
    }
  } catch {
    // QR generation is non-critical — PDF still renders without it
  }

  const receiptData: ReceiptPdfData = {
    receiptId: row.id,
    verdict: o.verdict ?? "YELLOW",
    verdictReason: o.verdict_reason ?? "",
    priceSanity: o.price_sanity ?? null,
    riskFlags: o.risk_flags ?? [],
    mustAnswerQuestions: o.must_answer_questions ?? [],
    inspectFirst: o.inspect_first ?? [],
    negotiationOpener: o.negotiation_opener ?? "",
    listingSummary: {
      year: ls.year ?? 0,
      make: ls.make ?? "Unknown",
      model: ls.model ?? "Unknown",
      trim: ls.trim ?? null,
      price: ls.price ?? 0,
      currency: ls.currency ?? "USD",
      mileage: ls.mileage ?? 0,
      mileageUnit: ls.mileage_unit ?? "miles",
      sellerType: ls.seller_type ?? "Private",
      location: ls.location ?? "",
    },
    receiptDetails: o.receipt_details ?? null,
    deepDive: (deepDiveRow?.content ?? null) as ReceiptPdfData["deepDive"],
    shareUrl,
    shareQrDataUri,
    generatedAt: new Date().toISOString(),
  };

  const renderUrl = process.env.PDF_RENDER_URL || `${process.env.URL}/.netlify/functions/render-pdf`;
  const renderSecret = process.env.PDF_RENDER_SECRET;

  if (!renderSecret || !renderUrl) {
    return NextResponse.json({ success: false, error: "PDF service not configured" }, { status: 503 });
  }

  const renderRes = await fetch(renderUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-pdf-render-secret": renderSecret,
    },
    body: JSON.stringify({ version: "receipt", receiptData }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!renderRes.ok) {
    console.error("[/api/receipt/pdf] render-pdf returned", renderRes.status);
    return NextResponse.json({ success: false, error: "PDF generation failed" }, { status: 502 });
  }

  const pdfBuffer = await renderRes.arrayBuffer();
  const filename = `offo-receipt-${ls.make ?? "vehicle"}-${ls.year ?? ""}-${receiptId.slice(-8)}.pdf`
    .toLowerCase()
    .replace(/\s+/g, "-");

  // Track PDF download (fire-and-forget, skip for internal testers)
  const anonId = request.nextUrl.searchParams.get("anon_id") ?? null;
  if (!isInternalTester(anonId ?? "")) try {
    await supabase.from("user_events").insert({
      event_name: "receipt_pdf_downloaded",
      event_data: { receipt_id: receiptId },
      anon_id: anonId,
      ip_address: ip,
      page_path: `/api/receipt/${receiptId}/pdf`,
      timestamp: new Date().toISOString(),
    });
  } catch { /* non-critical */ }

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
