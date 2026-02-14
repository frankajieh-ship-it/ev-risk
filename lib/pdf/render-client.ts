/**
 * PDF Render Client — Shared Helper
 *
 * Calls the isolated Netlify Function (render-pdf) to generate PDF buffers.
 * Used by both the report PDF route and receipt PDF route.
 */

import type { RenderPdfRequest } from "./shared-types";

/**
 * Call the isolated render-pdf Netlify Function via HTTP.
 * In local dev, use `netlify dev` to run both Next.js and the function.
 */
export async function renderPdf(payload: RenderPdfRequest): Promise<Buffer> {
  const baseUrl =
    process.env.URL || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8888";
  const functionUrl = `${baseUrl}/.netlify/functions/render-pdf`;

  const secret = process.env.PDF_RENDER_SECRET;
  if (!secret) {
    throw new Error("PDF_RENDER_SECRET not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pdf-render-secret": secret,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `PDF render function failed (${response.status}): ${errorBody}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
}
