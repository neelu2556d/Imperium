"use client";

import { useEffect, useMemo, useState } from "react";
import { ImagePlus, RotateCcw, ScanLine, X } from "lucide-react";
import { useSheet } from "@/lib/useSheet";
import { pushToast } from "@/lib/toast";
import { fetchItemMaster, type ItemMasterEntry } from "@/lib/supabase/lots";
import { addCataloguePhotos } from "@/lib/supabase/catalogue";

const inputFull = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: "var(--radius-sm)",
} as const;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type EntryStatus = "parsing" | "ready" | "error";

interface DraftEntry {
  key: number;
  file: File;
  dataUrl: string;
  status: EntryStatus;
  error: string | null;
  dNo: string;
  itemName: string;
  itemId: string | null;
}

/** Reads the design number + item off a photo via the Groq vision route. */
async function scanPhoto(
  dataUrl: string
): Promise<{ d_no: string | null; item_name: string | null }> {
  const res = await fetch("/api/scan-design-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      typeof body?.error === "string" ? body.error : "Couldn't scan the design."
    );
  }
  return {
    d_no: typeof body?.d_no === "string" ? body.d_no : null,
    item_name: typeof body?.item_name === "string" ? body.item_name : null,
  };
}

/**
 * Bottom sheet for the batch catalogue upload: each selected photo is read as a
 * data URL, scanned for its printed design number (waves of 4 so the vision
 * calls stay bounded), and shown as an editable review card — thumbnail, D.No.
 * input, and a searchable item picker. Editing an errored card returns it to
 * "ready". "Save all" uploads + inserts only the ready entries.
 */
export default function AddPhotosSheet({
  files,
  onClose,
  onSaved,
}: {
  files: File[];
  onClose: () => void;
  onSaved: (count: number) => void;
}) {
  const {
    backdropClassName,
    panelClassName,
    panelRef,
    panelStyle,
    handleProps,
    handleStyle,
    close,
  } = useSheet(onClose);

  const [items, setItems] = useState<ItemMasterEntry[]>([]);
  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [saving, setSaving] = useState(false);

  // Load the item master once up front, then scan the incoming photos.
  useEffect(() => {
    let cancelled = false;
    fetchItemMaster().then((data) => {
      if (!cancelled) setItems(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const scanAll = async () => {
      // Seed one "parsing" card per file so the sheet fills in as results land.
      const seeds: DraftEntry[] = files.map((file, i) => ({
        key: i,
        file,
        dataUrl: "",
        status: "parsing",
        error: null,
        dNo: "",
        itemName: "",
        itemId: null,
      }));
      setEntries(seeds);

      // Waves of 4 — keep the vision calls concurrent but bounded.
      for (let start = 0; start < seeds.length; start += 4) {
        if (cancelled) return;
        const wave = seeds.slice(start, start + 4);
        await Promise.all(
          wave.map(async (seed) => {
            try {
              const dataUrl = await readAsDataUrl(seed.file);
              const result = await scanPhoto(dataUrl);
              if (cancelled) return;
              const itemName = result.item_name?.trim() ?? "";
              setEntries((prev) =>
                prev.map((e) =>
                  e.key === seed.key
                    ? {
                        ...e,
                        dataUrl,
                        dNo: result.d_no ?? "",
                        itemName,
                        itemId: matchItemId(items, itemName),
                        status: "ready",
                        error: result.d_no
                          ? null
                          : "No design number found — enter it manually.",
                      }
                    : e
                )
              );
            } catch (err) {
              if (cancelled) return;
              setEntries((prev) =>
                prev.map((e) =>
                  e.key === seed.key
                    ? {
                        ...e,
                        dataUrl: "",
                        status: "error",
                        error:
                          err instanceof Error
                            ? err.message
                            : "Couldn't read that photo.",
                      }
                    : e
                )
              );
            }
          })
        );
      }
    };
    scanAll();
    return () => {
      cancelled = true;
    };
    // `items` is intentionally read at seed time; a scan landing before the
    // master loads just leaves itemName empty for the user to pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const patch = (key: number, next: Partial<DraftEntry>) =>
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...next } : e)));

  // Editing any field on an errored card clears its error and re-enables save.
  const onDNoChange = (key: number, value: string) =>
    patch(key, { dNo: value, status: "ready", error: null });
  const onItemChange = (key: number, id: string | null, name: string) =>
    patch(key, { itemId: id, itemName: name, status: "ready", error: null });

  const retryScan = async (key: number) => {
    const entry = entries.find((e) => e.key === key);
    if (!entry) return;
    patch(key, { status: "parsing", error: null });
    try {
      const dataUrl = entry.dataUrl || (await readAsDataUrl(entry.file));
      const result = await scanPhoto(dataUrl);
      patch(key, {
        dataUrl,
        dNo: result.d_no ?? "",
        itemName: result.item_name?.trim() ?? entry.itemName,
        itemId: matchItemId(items, result.item_name?.trim() ?? "") ?? entry.itemId,
        status: "ready",
        error: result.d_no ? null : "No design number found — enter it manually.",
      });
    } catch (err) {
      patch(key, {
        status: "error",
        error:
          err instanceof Error ? err.message : "Couldn't read that photo.",
      });
    }
  };

  const readyCount = useMemo(
    () =>
      entries.filter((e) => e.status === "ready" && e.itemName.trim()).length,
    [entries]
  );
  const errorCount = useMemo(
    () => entries.filter((e) => e.status === "error").length,
    [entries]
  );

  const save = async () => {
    if (saving || readyCount === 0) return;
    setSaving(true);
    try {
      const ready = entries.filter(
        (e) => e.status === "ready" && e.itemName.trim()
      );
      const created = await addCataloguePhotos(
        ready.map((e) => ({
          file: e.file,
          itemId: e.itemId,
          itemName: e.itemName,
          dNo: e.dNo,
        }))
      );
      if (created.length > 0) {
        pushToast(`Added ${created.length} design photo${created.length === 1 ? "" : "s"}.`);
        onSaved(created.length);
        close();
      } else {
        pushToast("No photos could be saved. Try again.");
      }
    } catch {
      pushToast("Couldn't save the photos. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className={`absolute inset-0 ${backdropClassName}`}
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={close}
        aria-hidden
      />
      <div
        ref={panelRef}
        className={`relative flex h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-x border-t ${panelClassName}`}
        style={{
          borderColor: "var(--color-border-strong)",
          background: "var(--color-bg-elevated)",
          ...panelStyle,
        }}
        role="dialog"
        aria-label="Add catalogue photos"
      >
        <div className="shrink-0 px-6 pt-6">
          <div
            className="mx-auto mb-4 h-1 w-10 rounded-full"
            style={{ background: "var(--color-border-strong)", ...handleStyle }}
            aria-hidden
            {...handleProps}
          />
          <div className="flex items-baseline justify-between">
            <p className="mono text-[0.6rem] uppercase tracking-[0.16em] text-muted">
              Add catalogue photos
            </p>
            <button
              type="button"
              data-no-vitality
              onClick={close}
              className="mono border-0 bg-transparent p-1 text-[0.7rem] uppercase tracking-[0.1em] text-muted"
            >
              Cancel
            </button>
          </div>
          <h2 className="serif-italic mt-1 text-2xl" data-no-vitality>
            {files.length} photo{files.length === 1 ? "" : "s"}
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4 pt-4">
          {entries.length === 0 ? (
            <p className="mono text-center text-xs text-muted">Preparing…</p>
          ) : (
            <div className="flex flex-col gap-3">
              {entries.map((entry) => (
                <ReviewCard
                  key={entry.key}
                  entry={entry}
                  items={items}
                  onDNoChange={(v) => onDNoChange(entry.key, v)}
                  onItemChange={(id, name) =>
                    onItemChange(entry.key, id, name)
                  }
                  onRetry={() => retryScan(entry.key)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t px-6 py-4" style={{ borderColor: "var(--color-border)" }}>
          {errorCount > 0 && (
            <p className="mb-3 text-[0.72rem] leading-snug" style={{ color: "var(--color-amber)" }}>
              {errorCount} photo{errorCount === 1 ? "" : "s"} couldn&rsquo;t be read
              automatically — fix the D.No. or item and they&rsquo;ll be saved too.
            </p>
          )}
          <button
            type="button"
            className="btn-primary w-full"
            disabled={saving || readyCount === 0}
            onClick={save}
          >
            {saving
              ? "Saving…"
              : readyCount === 0
                ? "Nothing ready to save"
                : `Save all (${readyCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Tries to match a scanned item name to an existing item-master entry. */
function matchItemId(items: ItemMasterEntry[], name: string): string | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  return (
    items.find((i) => i.itemName.trim().toLowerCase() === q)?.id ?? null
  );
}

// ---------------------------------------------------------------------------
// Review card — thumbnail, D.No. input, searchable item picker, retry
// ---------------------------------------------------------------------------

function ReviewCard({
  entry,
  items,
  onDNoChange,
  onItemChange,
  onRetry,
}: {
  entry: DraftEntry;
  items: ItemMasterEntry[];
  onDNoChange: (value: string) => void;
  onItemChange: (id: string | null, name: string) => void;
  onRetry: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const filteredItems = useMemo(() => {
    const q = entry.itemName.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.itemName.toLowerCase().includes(q));
  }, [items, entry.itemName]);

  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor:
          entry.status === "error"
            ? "var(--color-danger)"
            : "var(--color-border)",
        background: "var(--color-card)",
      }}
    >
      <div className="flex items-start gap-3">
        {/* thumbnail */}
        <div
          className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}
        >
          {entry.dataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={entry.dataUrl}
              alt="Design preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <ImagePlus size={18} className="text-muted" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <label className="flex flex-col gap-1">
            <span className="mono text-[0.6rem] uppercase tracking-[0.14em] text-muted">
              D.No.
            </span>
            <input
              type="text"
              value={entry.dNo}
              placeholder="e.g. TT-247"
              onChange={(e) => onDNoChange(e.target.value)}
              className="mono w-full"
              data-no-vitality
              style={inputFull}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="mono text-[0.6rem] uppercase tracking-[0.14em] text-muted">
              Item
            </span>
            <div className="relative">
              <input
                type="text"
                value={entry.itemName}
                placeholder="Search or type an item"
                onChange={(e) => onItemChange(null, e.target.value)}
                onFocus={() => setPickerOpen(true)}
                onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
                className="w-full"
                data-no-vitality
                style={inputFull}
              />
              {pickerOpen && filteredItems.length > 0 && (
                <ul
                  className="absolute inset-x-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-lg border shadow-lg"
                  style={{
                    borderColor: "var(--color-border-strong)",
                    background: "var(--color-bg-elevated)",
                  }}
                >
                  {filteredItems.map((i) => (
                    <li key={i.id}>
                      <button
                        type="button"
                        data-no-vitality
                        className="w-full border-0 bg-transparent px-3 py-2 text-left text-sm text-fg hover:bg-white/[0.05]"
                        onMouseDown={() => {
                          onItemChange(i.id, i.itemName);
                          setPickerOpen(false);
                        }}
                      >
                        {i.itemName}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </label>
        </div>
      </div>

      {/* status footer */}
      {entry.status === "parsing" ? (
        <p className="mono mt-2.5 flex items-center gap-1.5 text-[0.62rem] uppercase tracking-[0.1em] text-muted">
          <ScanLine size={12} aria-hidden />
          Reading design number…
        </p>
      ) : entry.status === "error" ? (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <p className="min-w-0 text-[0.72rem] leading-snug" style={{ color: "var(--color-danger)" }}>
            {entry.error}
          </p>
          <button
            type="button"
            data-no-vitality
            onClick={onRetry}
            className="flex shrink-0 items-center gap-1.5 rounded-full border bg-transparent px-3 py-1.5 text-[0.72rem] font-medium"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-muted-strong)",
            }}
          >
            <RotateCcw size={12} aria-hidden />
            Retry
          </button>
        </div>
      ) : entry.error ? (
        <p className="mt-2.5 flex items-center gap-1.5 text-[0.72rem] leading-snug" style={{ color: "var(--color-amber)" }}>
          <X size={12} aria-hidden />
          {entry.error}
        </p>
      ) : null}
    </div>
  );
}
