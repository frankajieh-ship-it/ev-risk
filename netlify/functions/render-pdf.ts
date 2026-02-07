/**
 * Netlify Function: PDF Renderer (v1 handler format)
 *
 * Isolated from the Next.js server handler to keep @react-pdf/renderer
 * (and its heavy native dependencies) out of the main 250 MB budget.
 *
 * POST /.netlify/functions/render-pdf
 * Body: { version: "v1"|"v2", v1Data?: ReportPayload, v2Data?: ReportPdfV2Data }
 * Returns: application/pdf binary (base64-encoded via Lambda response)
 */

import type { Handler, HandlerEvent, HandlerResponse } from "@netlify/functions";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReportPdf } from "../../lib/pdf/ReportPdf.js";
import { ReportPdfV2 } from "../../lib/pdf/ReportPdfV2.js";
import type { RenderPdfRequest } from "../../lib/pdf/shared-types.js";

const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Verify shared secret
  const authHeader = event.headers["x-pdf-render-secret"];
  const expectedSecret = process.env.PDF_RENDER_SECRET;

  if (!expectedSecret || authHeader !== expectedSecret) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Unauthorized" }),
      headers: { "Content-Type": "application/json" },
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
      headers: { "Content-Type": "application/json" },
    };
  }

  try {
    const body: RenderPdfRequest = JSON.parse(event.body || "{}");

    let pdfBuffer: Buffer;

    if (body.version === "v2" && body.v2Data) {
      const doc = React.createElement(ReportPdfV2, { data: body.v2Data }) as any;
      pdfBuffer = await renderToBuffer(doc);
    } else if (body.version === "v1" && body.v1Data) {
      const doc = React.createElement(ReportPdf, { data: body.v1Data }) as any;
      pdfBuffer = await renderToBuffer(doc);
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid request: missing version or data" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBuffer.length),
      },
      body: pdfBuffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("PDF render error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "PDF render failed",
        details: error instanceof Error ? error.message : "Unknown",
      }),
      headers: { "Content-Type": "application/json" },
    };
  }
};

export { handler };
