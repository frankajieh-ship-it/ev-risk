/**
 * Dealer Inventory Photo Upload API
 * POST /api/dealer/inventory/upload — Upload vehicle photos to Supabase Storage
 *
 * Accepts FormData with:
 *   - files: one or more image files (max 6, max 5MB each)
 *   - itemId: the inventory item UUID
 *
 * Stores in: dealer-photos/{dealershipId}/{itemId}/{uuid}.{ext}
 * Returns the updated photo_urls array.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole, getDealershipId, getSupabaseAdmin } from "@/lib/api-auth";

const MAX_FILES = 6;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const BUCKET = "dealer-photos";

export async function POST(req: NextRequest) {
  const user = await requireRole(req, "dealer_admin", "dealer_user");
  if (user instanceof NextResponse) return user;

  const dealershipId = await getDealershipId(user.id);
  if (!dealershipId) {
    return NextResponse.json({ success: false, error: "Dealership not found" }, { status: 404 });
  }

  const supabase = getSupabaseAdmin()!;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid form data" }, { status: 400 });
  }

  const itemId = formData.get("itemId") as string;
  if (!itemId) {
    return NextResponse.json({ success: false, error: "itemId is required" }, { status: 400 });
  }

  // Verify the item belongs to this dealership
  const { data: item } = await supabase
    .from("dealer_inventory")
    .select("id, photo_urls")
    .eq("id", itemId)
    .eq("dealership_id", dealershipId)
    .single();

  if (!item) {
    return NextResponse.json({ success: false, error: "Inventory item not found" }, { status: 404 });
  }

  const existingUrls: string[] = item.photo_urls || [];
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ success: false, error: "No files provided" }, { status: 400 });
  }

  if (existingUrls.length + files.length > MAX_FILES) {
    return NextResponse.json(
      { success: false, error: `Maximum ${MAX_FILES} photos per vehicle. Currently have ${existingUrls.length}.` },
      { status: 400 }
    );
  }

  // Validate files
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File "${file.name}" exceeds 5MB limit.` },
        { status: 400 }
      );
    }
  }

  // Upload each file
  const newUrls: string[] = [];

  // Map MIME type → extension — never trust file.name (prevents .exe/.php spoofing)
  const MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  for (const file of files) {
    const ext = MIME_TO_EXT[file.type] ?? "jpg";
    const uuid = crypto.randomUUID();
    const path = `${dealershipId}/${itemId}/${uuid}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[Upload] Failed:", uploadError.message);
      return NextResponse.json(
        { success: false, error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    newUrls.push(publicUrlData.publicUrl);
  }

  // Update the inventory item with new photo URLs
  const updatedUrls = [...existingUrls, ...newUrls];

  const { error: updateError } = await supabase
    .from("dealer_inventory")
    .update({ photo_urls: updatedUrls, updated_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("dealership_id", dealershipId);

  if (updateError) {
    return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, photo_urls: updatedUrls });
}
