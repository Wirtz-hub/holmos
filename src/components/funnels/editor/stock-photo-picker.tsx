"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import { useState, useTransition } from "react";
import { inputClass } from "@/components/ui";
import { searchStockPhotosAction, stockPhotoUsedAction } from "@/lib/actions/stock-photos";
import type { PhotoCredit } from "@/lib/funnels/schema";
import type { StockPhoto } from "@/lib/unsplash";

/** Search free Unsplash photos and pick one. */
export function StockPhotoPicker({
  onPick,
  onClose,
}: {
  onPick: (url: string, credit: PhotoCredit) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function search(nextPage: number) {
    const words = nextPage === 1 ? query.trim() : searched;
    if (!words) return;
    startTransition(async () => {
      const result = await searchStockPhotosAction({ query: words, page: nextPage });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setSearched(words);
      setPage(nextPage);
      setTotalPages(result.totalPages);
      setPhotos((current) => (nextPage === 1 ? result.photos : [...current, ...result.photos]));
    });
  }

  function pick(photo: StockPhoto) {
    onPick(photo.url, photo.credit);
    void stockPhotoUsedAction(photo.downloadLocation);
    onClose();
  }

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">Free photos from Unsplash</p>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-200" aria-label="Close photo search">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search(1);
            }
          }}
          placeholder="e.g. dentist, coffee, garden"
          aria-label="What should the photo show?"
          className={inputClass}
          autoFocus
        />
        <button
          type="button"
          onClick={() => search(1)}
          disabled={pending || !query.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
          Search
        </button>
      </div>
      <p className="text-xs text-slate-500">English words give the most results. The photographer is credited at the bottom of the page.</p>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {searched && !pending && photos.length === 0 && !error && <p className="text-sm text-slate-500">No photos found. Try other words.</p>}
      {photos.length > 0 && (
        <div className="grid max-h-96 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => pick(photo)}
              className="group overflow-hidden rounded-md bg-white text-left ring-1 ring-slate-200 hover:ring-2 hover:ring-brand-500"
              title={photo.alt || undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Unsplash asks for its own image addresses */}
              <img src={photo.thumb} alt={photo.alt} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <span className="block truncate px-1.5 py-1 text-[11px] text-slate-500">{photo.credit.name}</span>
            </button>
          ))}
        </div>
      )}
      {photos.length > 0 && page < totalPages && (
        <button type="button" onClick={() => search(page + 1)} disabled={pending} className="text-sm font-medium text-brand-700 hover:text-brand-600 disabled:opacity-60">
          {pending ? "Loading…" : "Show more"}
        </button>
      )}
    </div>
  );
}
