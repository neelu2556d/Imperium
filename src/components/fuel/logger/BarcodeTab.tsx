"use client";

import { useEffect, useRef, useState } from "react";
import { lookupBarcode } from "@/lib/fuel/api";
import type { FoodSearchResult } from "@/lib/fuel/food";
import type { IScannerControls } from "@zxing/browser";

interface BarcodeTabProps {
  active: boolean;
  onFound: (food: FoodSearchResult) => void;
  onQuickAdd: () => void;
}

type Status = "scanning" | "looking" | "denied" | "notfound" | "dberror";

/**
 * Barcode method — a live camera viewfinder (getUserMedia + ZXing) that decodes
 * a product barcode, looks it up via /api/food-barcode, and hands the result to
 * the serving selector. Handles permission-denied, product-not-found, and OFF-
 * unavailable with clear fallbacks to Quick Add. The camera is torn down on
 * unmount / when the tab is left, and restarted on return.
 */
export default function BarcodeTab({ active, onFound, onQuickAdd }: BarcodeTabProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handled = useRef(false);
  const [status, setStatus] = useState<Status>("scanning");

  const stop = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  };

  const handleCode = async (code: string) => {
    if (handled.current) return;
    handled.current = true;
    stop();
    setStatus("looking");
    const res = await lookupBarcode(code);
    if ("found" in res && res.found) {
      onFound(res.result);
    } else if ("found" in res && !res.found) {
      setStatus("notfound");
    } else {
      setStatus("dberror");
    }
  };

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    handled.current = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        if (cancelled || !videoRef.current) return;
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (result) void handleCode(result.getText());
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch {
        if (!cancelled) setStatus("denied");
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const rescan = () => {
    handled.current = false;
    setStatus("scanning");
    // Re-mount the effect path by toggling: simplest is a full reload of stream.
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        if (!videoRef.current) return;
        controlsRef.current = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (result) void handleCode(result.getText());
          }
        );
      } catch {
        setStatus("denied");
      }
    })();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative w-full overflow-hidden rounded-2xl border"
        style={{ borderColor: "var(--color-border-strong)", background: "#000", aspectRatio: "3 / 4" }}
      >
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {status === "scanning" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-24 w-56 rounded-lg border-2" style={{ borderColor: "var(--accent)" }} />
          </div>
        )}
        {status === "looking" && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
            <span className="text-sm text-white">Looking up product…</span>
          </div>
        )}
      </div>

      {status === "denied" && (
        <div className="w-full rounded-xl border p-4 text-center" style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}>
          <p className="text-[0.85rem] text-muted-strong">Camera access needed. Allow it in your browser settings.</p>
          <button type="button" onClick={onQuickAdd} className="link mt-3 text-[0.8rem]" data-no-vitality style={{ background: "transparent", border: "none" }}>
            Use Quick Add instead →
          </button>
        </div>
      )}

      {status === "notfound" && (
        <div className="w-full rounded-xl border p-4 text-center" style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}>
          <p className="text-[0.85rem] text-muted-strong">Product not found.</p>
          <div className="mt-3 flex justify-center gap-3">
            <button type="button" onClick={rescan} className="text-[0.8rem]" data-no-vitality>Scan again</button>
            <button type="button" onClick={onQuickAdd} className="btn-primary text-[0.8rem]">Quick Add instead</button>
          </div>
        </div>
      )}

      {status === "dberror" && (
        <div className="w-full rounded-xl border p-4 text-center" style={{ borderColor: "var(--color-border)", background: "var(--color-card-elevated)" }}>
          <p className="text-[0.85rem] text-muted-strong">Database unavailable. Try Quick Add instead.</p>
          <button type="button" onClick={onQuickAdd} className="btn-primary mt-3 text-[0.8rem]">Quick Add</button>
        </div>
      )}

      {status === "scanning" && (
        <p className="text-[0.78rem] text-muted">Point the camera at a barcode.</p>
      )}
    </div>
  );
}
