/**
 * Share helper for catalogue design photos. Draws the photo onto a canvas
 * (via fetch → blob → objectURL → Image, which avoids CORS canvas tainting),
 * burns a `D.No:- <n>` label into a bottom bar, and shares the watermarked
 * JPEG via the native share sheet (file share when supported, else downloads
 * it). Falls back to sharing the plain storage URL when the fetch or canvas
 * path fails.
 */

export type ShareResult = "shared" | "downloaded" | "failed";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load image"));
    img.src = url;
  });
}

export async function shareDesignPhoto(opts: {
  imageUrl: string;
  dNo: string;
  itemName?: string;
}): Promise<ShareResult> {
  const label = opts.dNo.trim() ? `D.No:-${opts.dNo.trim()}` : "Design";
  const fileName = `${opts.dNo.trim() || "design"}.jpg`;

  // Try to draw the photo and burn the label in. Failure anywhere here falls
  // through to the plain-URL share below.
  let blob: Blob | null = null;
  try {
    const res = await fetch(opts.imageUrl);
    if (res.ok) blob = await res.blob();
  } catch {
    /* fall through */
  }

  if (blob) {
    try {
      const objectUrl = URL.createObjectURL(blob);
      const img = await loadImage(objectUrl);

      // Contain-fit into a sensible max so the watermark stays readable.
      const maxW = 1600;
      const maxH = 1600;
      const scale = Math.min(
        maxW / img.naturalWidth,
        maxH / img.naturalHeight,
        1
      );
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas context");

      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(objectUrl);

      const barH = Math.max(36, Math.round(h * 0.08));
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, h - barH, w, barH);
      ctx.fillStyle = "#fff";
      ctx.font = `600 ${Math.max(18, Math.round(w * 0.045))}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, w / 2, h - barH / 2);

      const jpeg = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92)
      );
      if (jpeg) {
        const file = new File([jpeg], fileName, { type: "image/jpeg" });
        if (
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] })
        ) {
          try {
            await navigator.share({
              files: [file],
              title: label,
              text: opts.itemName || undefined,
            });
            return "shared";
          } catch (e) {
            // User dismissing the sheet counts as done, not failed.
            if ((e as Error).name === "AbortError") return "shared";
            // Otherwise fall through to the download fallback.
          }
        }
        // Desktop (or no file sharing): download the watermarked jpeg.
        const url = URL.createObjectURL(jpeg);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        return "downloaded";
      }
    } catch {
      /* fall through to URL share */
    }
  }

  // Plain-URL fallback (storage is publicly readable, so it works unauthenticated).
  try {
    await navigator.share({
      url: opts.imageUrl,
      title: label,
      text: opts.itemName || undefined,
    });
    return "shared";
  } catch {
    return "failed";
  }
}
