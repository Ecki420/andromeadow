import type { Backend } from "./types.ts";
import { LocalBackend } from "./LocalBackend.ts";

/** Picks Supabase when both env vars are set, otherwise the local stub. */
export async function createBackend(): Promise<Backend> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && key) {
    const { SupabaseBackend } = await import("./SupabaseBackend.ts");
    return new SupabaseBackend(url, key);
  }
  return new LocalBackend();
}
