/**
 * POST /api/dealer/logo
 *
 * Upload a dealership logo. Stores in Supabase `dealer-photos` bucket
 * and updates the `logo_url` field on the dealership record.
 *
 * Accepts: multipart/form-data with a single `file` field.
 * Max size: 2MB. Allowed types: image/jpeg, image/png, image/webp.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, getDealershipId, getSupabaseAdmin } from "@/lib/api-auth";
import { v4 as uuidv4 } from "uuid";

const BUCKET = "dealer-photos";
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  const user = await requireRole(req, "dealer_admin");
  if (user instanceof NextResponse) return user;

  const dealershipId = await getDealershipId(user.id);
  if (!dealershipId) {
    return NextResponse.json({ success: false, error: "Dealership not found" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ success: false, error: "File must be JPEG, PNG, or WebP" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ success: false, error: "File must be under 2MB" }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${dealershipId}/logo/${uuidv4()}.${ext}`;

  const supabase = getSupabaseAdmin()!;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("[dealer/logo] upload error:", uploadError);
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const logoUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabase
    .from("dealerships")
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq("id", dealershipId);

  if (updateError) {
    console.error("[dealer/logo] update error:", updateError);
    return NextResponse.json({ success: false, error: "Failed to save logo URL" }, { status: 500 });
  }

  return NextResponse.json({ success: true, logo_url: logoUrl });
}
