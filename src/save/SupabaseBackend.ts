import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Backend, PlayerSave, UserInfo } from "./types.ts";

/**
 * Real backend. Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 * and the player_saves table from supabase/schema.sql.
 */
export class SupabaseBackend implements Backend {
  readonly kind = "supabase" as const;
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    // keepalive lets the final save on page unload complete after the tab is gone.
    // Saves are tiny, well under the keepalive body limit.
    this.client = createClient(url, anonKey, {
      global: { fetch: (input, init) => fetch(input, { ...init, keepalive: true }) },
    });
  }

  async currentUser(): Promise<UserInfo | null> {
    const { data } = await this.client.auth.getUser();
    const u = data.user;
    return u ? { id: u.id, email: u.email ?? "" } : null;
  }

  async signUp(email: string, password: string): Promise<UserInfo> {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Sign-up succeeded but no user was returned");
    if (!data.session) {
      throw new Error("Check your email to confirm the account, then sign in");
    }
    return { id: data.user.id, email: data.user.email ?? email };
  }

  async signIn(email: string, password: string): Promise<UserInfo> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return { id: data.user.id, email: data.user.email ?? email };
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  async loadSave(userId: string): Promise<PlayerSave | null> {
    const { data, error } = await this.client
      .from("player_saves")
      .select("save")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.save as PlayerSave | undefined) ?? null;
  }

  async storeSave(userId: string, save: PlayerSave): Promise<void> {
    const { error } = await this.client
      .from("player_saves")
      .upsert({ user_id: userId, save, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
  }
}
