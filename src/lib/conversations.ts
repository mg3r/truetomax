import type { SupabaseClient } from "@supabase/supabase-js";

/** A short title from the first thing said. */
export function titleFrom(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 48 ? t.slice(0, 46).replace(/\s\S*$/, "") + "…" : t || "New conversation";
}

/** Use the given conversation if it's real, otherwise start one. Returns its id. */
export async function ensureConversation(supabase: SupabaseClient, id: unknown, title: string): Promise<string | null> {
  if (typeof id === "string" && /^[0-9a-f-]{36}$/.test(id)) {
    const { data } = await supabase.from("conversations").select("id").eq("id", id).maybeSingle();
    if (data) return data.id;
  }
  const { data, error } = await supabase.from("conversations").insert({ title: titleFrom(title) }).select("id").single();
  return error ? null : data.id;
}

export async function touchConversation(supabase: SupabaseClient, id: string | null) {
  if (id) await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", id);
}
