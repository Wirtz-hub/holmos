"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isStockPhotoSearchOn, markStockPhotoUsed, searchStockPhotos, type StockPhoto } from "@/lib/unsplash";

export type StockSearchResult = { ok: true; photos: StockPhoto[]; totalPages: number } | { ok: false; message: string };

const searchSchema = z.object({
  query: z.string().trim().min(1, "Type what the picture should show.").max(100),
  page: z.number().int().min(1).max(50),
  orientation: z.enum(["landscape", "portrait", "squarish"]).optional(),
});

export async function searchStockPhotosAction(input: { query: string; page: number; orientation?: "landscape" | "portrait" | "squarish" }): Promise<StockSearchResult> {
  await requireAdmin();
  if (!isStockPhotoSearchOn()) return { ok: false, message: "Photo search isn't set up yet. SETUP.md explains how to add a free Unsplash key." };
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Try other words." };
  try {
    const { photos, totalPages } = await searchStockPhotos(parsed.data.query, { page: parsed.data.page, orientation: parsed.data.orientation });
    return { ok: true, photos, totalPages };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Couldn't search for photos." };
  }
}

/** Tells Unsplash a photo was put on a page, as its rules require. */
export async function stockPhotoUsedAction(downloadLocation: string) {
  await requireAdmin();
  if (typeof downloadLocation !== "string" || downloadLocation.length > 1000) return;
  await markStockPhotoUsed(downloadLocation);
}
