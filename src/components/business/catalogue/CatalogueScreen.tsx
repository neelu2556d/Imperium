"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Folder, ImagePlus, Plus } from "lucide-react";
import {
  byDNoDesc,
  fetchCataloguePhotos,
  type CataloguePhoto,
} from "@/lib/supabase/catalogue";
import PhotoViewer from "./PhotoViewer";
import AddPhotosSheet from "./AddPhotosSheet";

/**
 * /business/catalogue — the design-photo library. Photos are grouped by item
 * (items alphabetical), and within each item sorted by D.No. descending
 * (highest first, e.g. 530 → 450). Tap a tile to open the full-screen viewer
 * (share / delete). "+ Add photos" opens a camera/library chooser, then the
 * batch scan-review sheet.
 */
export default function CatalogueScreen() {
  const [photos, setPhotos] = useState<CataloguePhoto[] | null>(null);
  const [viewing, setViewing] = useState<CataloguePhoto | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [adding, setAdding] = useState<File[] | null>(null);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    fetchCataloguePhotos().then(setPhotos);
  };

  useEffect(() => {
    let cancelled = false;
    fetchCataloguePhotos().then((data) => {
      if (!cancelled) setPhotos(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    if (photos === null) return null;
    const map = new Map<string, CataloguePhoto[]>();
    for (const p of photos) {
      const name = p.itemName || "Untitled";
      const list = map.get(name) ?? [];
      list.push(p);
      map.set(name, list);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, list]) => ({
        name,
        photos: [...list].sort(byDNoDesc),
      }));
  }, [photos]);

  const pickCamera = () => {
    setChoosing(false);
    cameraInputRef.current?.click();
  };
  const pickLibrary = () => {
    setChoosing(false);
    libraryInputRef.current?.click();
  };

  const onCamera = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setAdding([file]);
  };
  const onLibrary = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length > 0) setAdding(files);
  };

  const total = photos?.length ?? 0;
  const isEmpty = photos !== null && total === 0;
  const activeGroup = activeItem
    ? groups?.find((g) => g.name === activeItem) ?? null
    : null;

  return (
    <div className="px-5 pb-24 pt-6 md:px-8 lg:px-12">
      <div className="flex items-center justify-between gap-3">
        <h2 className="serif-italic text-2xl md:text-3xl" data-no-vitality>
          Catalogue
        </h2>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setChoosing(true)}
        >
          <ImagePlus size={15} aria-hidden />
          Add Photos
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        {photos === null
          ? "Loading your design library…"
          : total === 0
            ? "Your design photo library."
            : `${total} design photo${total === 1 ? "" : "s"} · ${groups?.length ?? 0} item${groups && groups.length === 1 ? "" : "s"}`}
      </p>

      {/* camera capture (phones open the camera directly) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onCamera}
      />
      {/* library / file picker — `multiple` for batch uploads */}
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onLibrary}
      />

      {groups === null ? (
        <ul className="mt-4 space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="h-24 animate-pulse rounded-xl border border-border bg-bg-elevated"
            />
          ))}
        </ul>
      ) : isEmpty ? (
        <button
          type="button"
          onClick={() => setChoosing(true)}
          data-no-vitality
          className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl px-6 py-12 text-center transition-colors"
          style={{
            border: "1.5px dashed var(--color-border-strong)",
            background: "transparent",
            color: "var(--color-muted)",
          }}
        >
          <Camera size={26} />
          <span className="text-sm">
            Tap to add your first design photo. The design number printed on it
            is read automatically.
          </span>
        </button>
      ) : activeGroup ? (
        /* drill-in: one item's photos, D.No. newest-first */
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveItem(null)}
              data-no-vitality
              className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-[0.78rem] font-medium transition-colors"
              style={{
                color: "var(--accent)",
                borderColor: "var(--accent)",
                background: "transparent",
              }}
            >
              <ChevronLeft size={14} aria-hidden />
              Items
            </button>
            <h3
              className="min-w-0 flex-1 truncate serif-italic text-xl"
              data-no-vitality
            >
              {activeGroup.name}
            </h3>
          </div>
          <p className="mono mt-1 text-[0.62rem] uppercase tracking-[0.16em] text-muted">
            {activeGroup.photos.length} design{activeGroup.photos.length === 1 ? "" : "s"}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {activeGroup.photos.map((p) => (
              <Tile key={p.id} photo={p} onOpen={() => setViewing(p)} />
            ))}
          </div>
        </div>
      ) : (
        /* folder list — items sorted by name, each opening its designs */
        <ul className="mt-4 flex flex-col gap-2">
          {groups.map((group) => (
            <li key={group.name}>
              <button
                type="button"
                onClick={() => setActiveItem(group.name)}
                data-no-vitality
                className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors"
                style={{
                  borderColor: "var(--color-border)",
                  background: "var(--color-bg-elevated)",
                }}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                  style={{ background: "var(--color-card-elevated)" }}
                >
                  {group.photos[0]?.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={group.photos[0].imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Folder size={16} aria-hidden style={{ color: "var(--accent)" }} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">
                    {group.name}
                  </span>
                  <span className="mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                    {group.photos.length} design{group.photos.length === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="shrink-0" style={{ color: "var(--color-muted)" }}>
                  <ChevronRight size={16} aria-hidden />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {choosing && (
        <SourceChooser
          onCamera={pickCamera}
          onLibrary={pickLibrary}
          onClose={() => setChoosing(false)}
        />
      )}

      {adding && (
        <AddPhotosSheet
          files={adding}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            load();
          }}
        />
      )}

      {viewing && (
        <PhotoViewer
          photo={viewing}
          onClose={() => setViewing(null)}
          onDeleted={() => {
            setViewing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/** A single catalogue tile — photo with a small D.No. badge along the bottom. */
function Tile({ photo, onOpen }: { photo: CataloguePhoto; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-no-vitality
      className="group relative aspect-[3/4] w-full overflow-hidden rounded-xl border p-0"
      style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.imageUrl}
        alt={`Design ${photo.dNo || "photo"} · ${photo.itemName}`}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
      />
      {photo.dNo && (
        <span
          className="mono absolute inset-x-0 bottom-0 px-2 py-1 text-center text-[0.6rem] uppercase tracking-[0.08em] text-white"
          style={{ background: "rgba(0,0,0,0.62)" }}
        >
          D.No:-{photo.dNo}
        </span>
      )}
    </button>
  );
}

/** Small modal asking where the photo should come from (camera vs. library). */
function SourceChooser({
  onCamera,
  onLibrary,
  onClose,
}: {
  onCamera: () => void;
  onLibrary: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add design photos"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-2 rounded-2xl border p-4"
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-bg-elevated)",
        }}
      >
        <p className="mono mb-1 text-center text-[0.62rem] uppercase tracking-[0.14em] text-muted">
          Add design photos
        </p>
        <button
          type="button"
          onClick={onCamera}
          data-no-vitality
          className="flex w-full items-center justify-center gap-2 rounded-xl border-0 px-4 py-3 text-sm text-fg"
          style={{ background: "var(--color-card-elevated)" }}
        >
          <Camera size={18} />
          Take a photo
        </button>
        <button
          type="button"
          onClick={onLibrary}
          data-no-vitality
          className="flex w-full items-center justify-center gap-2 rounded-xl border-0 px-4 py-3 text-sm text-fg"
          style={{ background: "var(--color-card-elevated)" }}
        >
          <Plus size={18} />
          Upload from library
        </button>
        <button
          type="button"
          onClick={onClose}
          data-no-vitality
          className="mt-1 w-full rounded-xl border-0 bg-transparent px-4 py-2 text-sm text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
