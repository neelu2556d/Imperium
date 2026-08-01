import { ensureAnonymousSession, supabase } from "@/lib/supabase/client";

/**
 * Data layer for the Business tab's Catalogue section: a standalone design-photo
 * library. Each photo carries the design number printed on it (auto-read by the
 * /api/scan-design-photo route) and the item it belongs to. Independent of
 * Lots — a photo lives here even when no lot references it. Same conventions as
 * `business.ts` / `lots.ts`: defensive readers off the browser Supabase
 * singleton, RLS scoping every query to the signed-in user.
 */

const CATALOGUE_BUCKET = "catalogue-photos";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CataloguePhoto {
  id: string;
  itemId: string | null;
  itemName: string;
  dNo: string;
  imageUrl: string;
  createdAt: string;
}

export interface CataloguePhotoInput {
  file: File;
  itemId: string | null;
  itemName: string;
  dNo: string;
}

export interface UpdateCataloguePhotoInput {
  itemId?: string | null;
  itemName?: string;
  dNo?: string;
}

// ---------------------------------------------------------------------------
// D.No. sorting — the first numeric run, so "530", "TT-247" and "D.No:-530"
// all compare by their number (530, 247, 530).
// ---------------------------------------------------------------------------

export function dNoNum(dNo: string): number {
  return Number.parseInt(String(dNo).match(/\d+/)?.[0] ?? "0", 10);
}

/** D.No. descending (highest first), tie-break newest first. */
export function byDNoDesc(a: CataloguePhoto, b: CataloguePhoto): number {
  const n = dNoNum(b.dNo) - dNoNum(a.dNo);
  if (n !== 0) return n;
  return String(b.createdAt).localeCompare(String(a.createdAt));
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

/** Every catalogue photo for the user. Grouping + sorting happen client-side. */
export async function fetchCataloguePhotos(): Promise<CataloguePhoto[]> {
  try {
    const userId = await ensureAnonymousSession();
    const { data, error } = await supabase
      .from("catalogue_photos")
      .select("*")
      .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: String(r.id),
      itemId: r.item_id ? String(r.item_id) : null,
      itemName: String(r.item_name ?? "Untitled"),
      dNo: String(r.d_no ?? ""),
      imageUrl: String(r.image_url ?? ""),
      createdAt: String(r.created_at ?? ""),
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

async function uploadToBucket(userId: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  // Unique-ish path without Math.random (matches lots.uploadToBucket).
  const stamp = `${Date.now()}-${Math.round(performance.now())}-${file.size}`;
  const path = `${userId}/${stamp}.${ext}`;

  const { error } = await supabase.storage
    .from(CATALOGUE_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;

  return supabase.storage.from(CATALOGUE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Resolves the item-master id for a name — reuse the picked one, otherwise
 *  insert a new master entry. Never blocks the photo save: on failure returns
 *  null so the photo still gets its denormalised item_name label. */
async function resolveItemId(
  userId: string,
  itemId: string | null,
  itemName: string
): Promise<string | null> {
  if (itemId) return itemId;
  const name = itemName.trim();
  if (!name) return null;

  const { data, error } = await supabase
    .from("item_master")
    .insert({ user_id: userId, item_name: name })
    .select("id")
    .single();
  if (!error && data) return String(data.id);

  const { data: existing } = await supabase
    .from("item_master")
    .select("id")
    .eq("user_id", userId)
    .eq("item_name", name)
    .maybeSingle();
  return existing ? String(existing.id) : null;
}

/**
 * Uploads + inserts a batch of catalogue photos. Each entry is independent —
 * one failure (upload or insert) skips just that photo. Returns the rows that
 * were actually created.
 */
export async function addCataloguePhotos(
  entries: CataloguePhotoInput[]
): Promise<CataloguePhoto[]> {
  const userId = await ensureAnonymousSession();
  const created: CataloguePhoto[] = [];

  for (const entry of entries) {
    const url = await uploadToBucket(userId, entry.file);
    if (!url) continue;

    const itemId = await resolveItemId(userId, entry.itemId, entry.itemName);
    const { data, error } = await supabase
      .from("catalogue_photos")
      .insert({
        user_id: userId,
        item_id: itemId,
        item_name: entry.itemName.trim() || null,
        d_no: entry.dNo.trim() || null,
        image_url: url,
      })
      .select("id, item_id, item_name, d_no, image_url, created_at")
      .single();
    if (error || !data) continue;

    created.push({
      id: String(data.id),
      itemId: data.item_id ? String(data.item_id) : null,
      itemName: String(data.item_name ?? "Untitled"),
      dNo: String(data.d_no ?? ""),
      imageUrl: String(data.image_url ?? ""),
      createdAt: String(data.created_at ?? ""),
    });
  }

  return created;
}

/** Updates a catalogue photo's labels. Omitted fields keep their values. */
export async function updateCataloguePhoto(
  id: string,
  input: UpdateCataloguePhotoInput
): Promise<void> {
  const userId = await ensureAnonymousSession();
  const updates: Record<string, unknown> = {};
  if (input.itemId !== undefined) updates.item_id = input.itemId;
  if (input.itemName !== undefined)
    updates.item_name = input.itemName.trim() || null;
  if (input.dNo !== undefined) updates.d_no = input.dNo.trim() || null;
  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase
    .from("catalogue_photos")
    .update(updates)
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}

/** Deletes a catalogue photo: storage object first (best-effort), then the row. */
export async function deleteCataloguePhoto(id: string): Promise<void> {
  const userId = await ensureAnonymousSession();

  const { data: row, error: fetchError } = await supabase
    .from("catalogue_photos")
    .select("image_url")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (typeof row?.image_url === "string") {
    const url = row.image_url;
    if (url.includes(CATALOGUE_BUCKET + "/")) {
      const parts = url.split(CATALOGUE_BUCKET + "/")[1];
      const path = parts ? `${userId}/${parts.split("/").pop()}` : null;
      if (path) {
        await supabase.storage
          .from(CATALOGUE_BUCKET)
          .remove([path])
          .catch(() => {});
      }
    }
  }

  const { error } = await supabase
    .from("catalogue_photos")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
