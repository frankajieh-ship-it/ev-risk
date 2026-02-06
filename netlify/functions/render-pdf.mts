/**
 * Netlify Function: PDF Renderer
 *
 * Isolated from the Next.js server handler to keep @react-pdf/renderer
 * (and its heavy native dependencies) out of the main 250 MB budget.
 *
 * POST /.netlify/functions/render-pdf
 * Body: { version: "v1"|"v2", v1Data?: ReportPayload, v2Data?: ReportPdfV2Data }
 * Returns: application/pdf binary
 */

import type { Context } from "@netlify/functions";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReportPdf } from "../../lib/pdf/ReportPdf.js";
import { ReportPdfV2 } from "../../lib/pdf/ReportPdfV2.js";
import type { RenderPdfRequest } from "../../lib/pdf/shared-types.js";

export default async (req: Request, _context: Context) => {
  // Verify shared secret
  const authHeader = req.headers.get("x-pdf-render-secret");
  const expectedSecret = process.env.PDF_RENDER_SECRET;

  if (!expectedSecret || authHeader !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body: RenderPdfRequest = await req.json();

    let pdfBuffer: Buffer;

    if (body.version === "v2" && body.v2Data) {
      const doc = React.createElement(ReportPdfV2, { data: body.v2Data }) as any;
      pdfBuffer = await renderToBuffer(doc);
    } else if (body.version === "v1" && body.v1Data) {
      const doc = React.createElement(ReportPdf, { data: body.v1Data }) as any;
      pdfBuffer = await renderToBuffer(doc);
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid request: missing version or data" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("PDF render error:", error);
    return new Response(
      JSON.stringify({
        error: "PDF render failed",
        details: error instanceof Error ? error.message : "Unknown",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

export const config = {
  path: "/.netlify/functions/render-pdf",
  method: "POST",
};
