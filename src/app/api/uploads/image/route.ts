import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { json } from "@/lib/request";
import { createAdminClient } from "@/lib/supabase/admin";

// Uploads an image for a landing page to Supabase Storage (bucket "page-images",
// public, like the pages it appears on). Signed-in admin only.

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  await requireAdmin();

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return json({ ok: false, message: "Choose an image to upload." }, 400);
  const extension = TYPES[file.type];
  if (!extension) return json({ ok: false, message: "Use a JPG, PNG, WebP or GIF image." }, 400);
  if (file.size > MAX_BYTES) return json({ ok: false, message: "That image is over 4 MB. Make it smaller and try again." }, 400);

  const path = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${extension}`;
  const storage = createAdminClient().storage.from("page-images");
  const { error } = await storage.upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) {
    console.error("Image upload failed", error.message);
    const message = /bucket/i.test(error.message)
      ? "Image storage isn't set up. Run the Phase 2 database update from the setup guide."
      : "Couldn't upload the image. Try again.";
    return json({ ok: false, message }, 500);
  }
  return json({ ok: true, url: storage.getPublicUrl(path).data.publicUrl });
}
