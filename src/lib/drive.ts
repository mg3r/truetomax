import type { SupabaseClient } from "@supabase/supabase-js";
import { accessToken, driveFolderName, listDriveFolder, readDriveFile } from "./google";
import { remember, forget } from "./memory";

/**
 * Bring a Drive folder's docs into context. Only files that changed since the last sync are re-read;
 * files removed from the folder are removed here too.
 */
export async function syncDriveFolder(supabase: SupabaseClient, folderId: string) {
  const token = await accessToken(supabase);
  if (!token) throw new Error("Connect Google first (Context → Settings).");
  const files = await listDriveFolder(token, folderId);

  const { data: existing } = await supabase.from("context_docs").select("id, gdoc_id, modified_at").eq("folder_id", folderId);
  const byFile = new Map((existing ?? []).map((d) => [d.gdoc_id as string, d]));

  for (const f of files) {
    const have = byFile.get(f.id);
    if (have?.modified_at && new Date(have.modified_at).getTime() >= new Date(f.modifiedTime).getTime()) continue;
    const text = (await readDriveFile(token, f).catch(() => "")).replace(/\u0000/g, "").trim();
    if (!text) continue;
    const row = { title: f.name.replace(/\.(docx|txt|md)$/i, ""), text: text.slice(0, 200_000), source: "gdrive", gdoc_id: f.id, folder_id: folderId, modified_at: f.modifiedTime, updated_at: new Date().toISOString() };
    const { data } = have
      ? await supabase.from("context_docs").update(row).eq("id", have.id).select("id").single()
      : await supabase.from("context_docs").insert(row).select("id").single();
    if (data) await remember(supabase, "doc", data.id, `Doc "${row.title}": ${text.slice(0, 5000)}`);
  }

  const present = new Set(files.map((f) => f.id));
  for (const d of existing ?? []) {
    if (!present.has(d.gdoc_id as string)) {
      await supabase.from("context_docs").delete().eq("id", d.id);
      await forget(supabase, "doc", d.id);
    }
  }

  await supabase.from("drive_folders").update({ name: await driveFolderName(token, folderId), synced_at: new Date().toISOString() }).eq("folder_id", folderId);
  return files.length;
}

/** Keep linked folders fresh: re-sync any not synced in the last day. */
export async function syncDriveFoldersIfStale(supabase: SupabaseClient) {
  const { data: folders, error } = await supabase.from("drive_folders").select("folder_id, synced_at");
  if (error) return;
  for (const f of folders ?? []) {
    if (f.synced_at && Date.now() - new Date(f.synced_at).getTime() < 86400_000) continue;
    await syncDriveFolder(supabase, f.folder_id).catch((e) => console.error("drive sync", e));
  }
}
