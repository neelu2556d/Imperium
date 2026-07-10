"use client";

import { useRef, useState } from "react";
import ManualLogSheet from "@/components/fuel/ManualLogSheet";
import ScreenshotImportSheet from "@/components/fuel/ScreenshotImportSheet";
import { EditPlusIcon, ImageIcon } from "@/components/fuel/icons";

interface AddFoodProps {
  onLogged: () => void;
}

/**
 * Section 3 — the two "Add food" action cards. "Log manually" opens the manual
 * bottom-sheet form; "Import screenshot" opens the device picker/camera and
 * hands the chosen image to the screenshot-import flow. Both refresh the tab via
 * `onLogged` after a successful save.
 */
export default function AddFood({ onLogged }: AddFoodProps) {
  const [manualOpen, setManualOpen] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires onChange.
    e.target.value = "";
    if (file) setImageFile(file);
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="mono px-1 text-[0.7rem] uppercase tracking-[0.2em] text-muted-strong">
        Add food
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          data-no-vitality
          className="group flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-transform active:scale-[0.98]"
          style={cardStyle}
        >
          <span style={{ color: "var(--color-mint)" }}>
            <EditPlusIcon size={22} />
          </span>
          <span className="text-sm font-semibold">Log manually</span>
          <span className="text-[0.72rem] text-muted">
            Enter an item and its macros.
          </span>
        </button>

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          data-no-vitality
          className="group flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-transform active:scale-[0.98]"
          style={cardStyle}
        >
          <span style={{ color: "var(--color-mint)" }}>
            <ImageIcon size={22} />
          </span>
          <span className="text-sm font-semibold">Import screenshot</span>
          <span className="text-[0.72rem] text-muted">
            Read macros from a photo.
          </span>
        </button>
      </div>

      {/* No `capture` attribute: this lets the browser show its full picker
          (Photo Library / Take Photo / Files) instead of jumping straight to
          the camera, since imports are almost always existing screenshots. */}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        onChange={onPickImage}
        className="hidden"
      />

      {manualOpen && (
        <ManualLogSheet
          onClose={() => setManualOpen(false)}
          onLogged={onLogged}
        />
      )}

      {imageFile && (
        <ScreenshotImportSheet
          file={imageFile}
          onClose={() => setImageFile(null)}
          onLogged={onLogged}
          onFallbackManual={() => setManualOpen(true)}
        />
      )}
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  borderColor: "var(--color-border)",
  background: "var(--color-card-elevated)",
};
