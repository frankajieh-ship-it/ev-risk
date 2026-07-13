/**
 * POST /api/dev/save-listing-photos
 *
 * Dev-only endpoint. Downloads extracted listing photo URLs to
 * public/vehicles/qa-tmp/ for local QA inspection.
 *
 * Never runs in production — guarded by NODE_ENV check.
 */

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  let body: { photo_urls?: string[]; vehicle_label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { photo_urls, vehicle_label } = body;
  if (!Array.isArray(photo_urls) || photo_urls.length === 0) {
    return NextResponse.json({ error: "photo_urls array required" }, { status: 400 });
  }

  const label = (vehicle_label || "vehicle").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const outDir = path.join(process.cwd(), "public", "vehicles", "qa-tmp");
  fs.mkdirSync(outDir, { recursive: true });

  const saved: string[] = [];
  const failed: string[] = [];

  for (let i = 0; i < photo_urls.length; i++) {
    const url = photo_urls[i];
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; OFFO/1.0)",
          "Accept": "image/webp,image/avif,image/*,*/*",
        },
      });
      if (!res.ok) { failed.push(url); continue; }
      const contentType = res.headers.get("content-type") || "image/jpeg";
      if (!contentType.startsWith("image/")) { failed.push(url); continue; }
      const ext = contentType.includes("webp") ? "webp" : contentType.includes("png") ? "png" : "jpg";
      const filename = `${label}-${String(i + 1).padStart(2, "0")}.${ext}`;
      const filepath = path.join(outDir, filename);
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(filepath, buffer);
      saved.push(`/vehicles/qa-tmp/${filename}`);
    } catch {
      failed.push(url);
    }
  }

  return NextResponse.json({ saved, failed, outDir });
}
