"use client";

import { useEffect, useState } from "react";
import { CloseIcon } from "@/components/vitals/icons";
import { Share2, Trash2 } from "lucide-react";
import { pushToast } from "@/lib/toast";
import { deleteCataloguePhoto, type CataloguePhoto } from "@/lib/supabase/catalogue";
import { shareDesignPhoto } from "./sharePhoto";

/**
 * Full-screen viewer for a catalogue design photo. Tapping the image area
 * closes it; bottom actions share (watermarked native share / download) and
 * delete (with a confirm dialog). Delete removes the storage object + row and
 * tells the parent to refresh.
 */
export default function PhotoViewer({
  photo,
  onClose,
  onDeleted,
}: {
  photo: CataloguePhoto;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [sharing, setSharing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const result = await shareDesignPhoto({
        imageUrl: photo.imageUrl,
        dNo: photo.dNo,
        itemName: photo.itemName,
      });
      if (result === "shared") pushToast("Design shared.");
      else if (result === "downloaded") pushToast("Watermarked design downloaded.");
      else pushToast("Couldn't share that photo.");
    } finally {
      setSharing(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteCataloguePhoto(photo.id);
      pushToast("Design photo deleted.");
      onDeleted();
    } catch {
      pushToast("Couldn't delete the photo. Try again.");
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: "rgba(0,0,0,0.92)" }}
      onClick={onClose}
    >
      {/* close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        data-no-vitality
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border text-fg"
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-bg-elevated)",
        }}
      >
        <CloseIcon size={18} />
      </button>

      {/* image */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex min-h-0 flex-1 items-center justify-center px-4 pt-16"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.imageUrl}
          alt={`Design ${photo.dNo || "photo"} · ${photo.itemName}`}
          className="max-h-full max-w-full rounded-lg object-contain"
        />
      </div>

      {/* label */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 px-6 pb-6 pt-4 text-center"
      >
        {photo.dNo && (
          <p className="mono text-sm font-semibold text-white" data-no-vitality>
            D.No:-{photo.dNo}
          </p>
        )}
        <p className="mono mt-1 text-[0.68rem] uppercase tracking-[0.14em] text-muted">
          {photo.itemName}
        </p>
      </div>

      {/* actions */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex shrink-0 items-center justify-center gap-3 px-6 pb-8"
      >
        <button
          type="button"
          onClick={handleShare}
          disabled={sharing}
          data-no-vitality
          className="flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-medium text-fg"
          style={{ borderColor: "var(--color-border-strong)", background: "var(--color-bg-elevated)" }}
        >
          <Share2 size={16} aria-hidden />
          {sharing ? "Sharing…" : "Share"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={deleting}
          data-no-vitality
          className="flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-medium"
          style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)", background: "transparent" }}
        >
          <Trash2 size={16} aria-hidden />
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>

      {confirming && (
        <ConfirmDelete
          title={photo.dNo ? `D.No:-${photo.dNo}` : "this design photo"}
          busy={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

function ConfirmDelete({
  title,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-5"
      onClick={onCancel}
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.6)" }}
        aria-hidden
      />
      <div
        className="relative w-full max-w-sm rounded-2xl border p-6 shadow-xl"
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-bg-elevated)",
        }}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-label="Delete design photo"
      >
        <p className="text-lg font-semibold text-fg">
          Delete &ldquo;{title}&rdquo;?
        </p>
        <p className="mt-1.5 text-sm text-muted">
          This removes the photo from your catalogue permanently. This action
          cannot be undone.
        </p>
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            className="btn-primary w-full"
            style={{
              background: "var(--color-danger)",
              color: "#fff",
              borderColor: "transparent",
            }}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Deleting…" : "Delete photo"}
          </button>
          <button
            type="button"
            data-no-vitality
            disabled={busy}
            onClick={onCancel}
            className="w-full rounded-full border bg-transparent px-4 py-2.5 text-sm font-medium"
            style={{
              borderColor: "var(--color-border-strong)",
              color: "var(--color-fg)",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
