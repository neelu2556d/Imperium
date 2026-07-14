"use client";

import { useEffect, useRef, useState } from "react";
import SectionCard from "@/components/vitals/SectionCard";
import { CameraIcon, PlusIcon, CloseIcon } from "@/components/vitals/icons";
import { addPhoto, fetchPhotos, type ProgressPhoto } from "@/lib/supabase/vitals";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function photoDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d ?? 1}`;
}
function fullDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d ?? 1}, ${y}`;
}

export default function PhotosSection() {
  const [photos, setPhotos] = useState<ProgressPhoto[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null);
  const [choosing, setChoosing] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPhotos().then(setPhotos);
  }, []);

  // Opens a source chooser — camera vs. photo library. On phones the
  // `capture` input jumps straight to the camera, so without the library
  // option there was no way to upload an existing photo.
  const pick = () => setChoosing(true);
  const pickCamera = () => {
    setChoosing(false);
    cameraInputRef.current?.click();
  };
  const pickLibrary = () => {
    setChoosing(false);
    libraryInputRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const saved = await addPhoto(file);
      setPhotos((prev) => [...(prev ?? []), saved]);
    } catch {
      setError("Upload failed — please try again.");
    } finally {
      setUploading(false);
    }
  };

  const isEmpty = photos !== null && photos.length === 0;

  return (
    <SectionCard
      icon={<CameraIcon size={20} />}
      title="Progress Photos"
      right={
        !isEmpty && photos !== null ? (
          <button
            type="button"
            onClick={pick}
            disabled={uploading}
            data-no-vitality
            className="mono border-0 bg-transparent p-0 text-[0.62rem] uppercase tracking-[0.12em] text-muted transition-colors hover:text-fg"
          >
            {uploading ? "Uploading…" : "+ Add"}
          </button>
        ) : undefined
      }
    >
      {/* camera capture (phones open the camera directly) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFile}
      />
      {/* photo library / file picker — no `capture`, so phones offer the gallery */}
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />

      {photos === null ? (
        <div className="mono flex h-32 items-center justify-center text-xs text-muted">
          Loading…
        </div>
      ) : isEmpty ? (
        <button
          type="button"
          onClick={pick}
          disabled={uploading}
          data-no-vitality
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl px-6 py-10 text-center transition-colors"
          style={{
            border: "1.5px dashed var(--color-border-strong)",
            background: "transparent",
            color: "var(--color-muted)",
          }}
        >
          <CameraIcon size={26} />
          <span className="text-sm">
            {uploading ? "Uploading…" : "Tap to add your first check-in photo."}
          </span>
        </button>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setViewing(p)}
              data-no-vitality
              className="group shrink-0 border-0 bg-transparent p-0"
            >
              <div
                className="h-28 w-20 overflow-hidden rounded-lg border"
                style={{ borderColor: "var(--color-border)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={`Progress photo from ${fullDate(p.date)}`}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <span className="mono mt-1.5 block text-center text-[0.58rem] uppercase tracking-[0.08em] text-muted">
                {photoDate(p.date)}
              </span>
            </button>
          ))}

          {/* trailing add tile */}
          <button
            type="button"
            onClick={pick}
            disabled={uploading}
            data-no-vitality
            className="flex h-28 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-lg"
            style={{
              border: "1.5px dashed var(--color-border-strong)",
              background: "transparent",
              color: "var(--color-muted)",
            }}
          >
            <PlusIcon size={18} />
            <span className="mono text-[0.55rem] uppercase tracking-[0.08em]">
              {uploading ? "…" : "Add"}
            </span>
          </button>
        </div>
      )}

      {error && (
        <p className="mono mt-3 text-xs" style={{ color: "var(--color-red)" }}>
          {error}
        </p>
      )}

      {choosing && (
        <SourceChooser
          onCamera={pickCamera}
          onLibrary={pickLibrary}
          onClose={() => setChoosing(false)}
        />
      )}

      {viewing && (
        <PhotoViewer photo={viewing} onClose={() => setViewing(null)} />
      )}
    </SectionCard>
  );
}

/** Small modal asking where the photo should come from. */
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
      aria-label="Add progress photo"
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
          Add progress photo
        </p>
        <button
          type="button"
          onClick={onCamera}
          data-no-vitality
          className="flex w-full items-center justify-center gap-2 rounded-xl border-0 px-4 py-3 text-sm text-fg"
          style={{ background: "var(--color-card-elevated)" }}
        >
          <CameraIcon size={18} />
          Take a photo
        </button>
        <button
          type="button"
          onClick={onLibrary}
          data-no-vitality
          className="flex w-full items-center justify-center gap-2 rounded-xl border-0 px-4 py-3 text-sm text-fg"
          style={{ background: "var(--color-card-elevated)" }}
        >
          <PlusIcon size={18} />
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

function PhotoViewer({
  photo,
  onClose,
}: {
  photo: ProgressPhoto;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.9)" }}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        data-no-vitality
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border text-fg"
        style={{ borderColor: "var(--color-border-strong)", background: "var(--color-bg-elevated)" }}
      >
        <CloseIcon size={18} />
      </button>

      <div onClick={(e) => e.stopPropagation()} className="flex max-h-full flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={`Progress photo from ${fullDate(photo.date)}`}
          className="max-h-[80vh] max-w-full rounded-lg object-contain"
        />
        <p className="mono mt-3 text-[0.7rem] uppercase tracking-[0.14em] text-muted">
          {fullDate(photo.date)}
        </p>
        {photo.notes && (
          <p className="mt-1 max-w-sm text-center text-sm text-muted-strong">
            {photo.notes}
          </p>
        )}
      </div>
    </div>
  );
}
