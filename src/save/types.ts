import type { Vec3 } from "../galaxy/types.ts";

/** Exactly what Rev 1 persists per player. Keep this small and serialisable. */
export interface PlayerSave {
  shipId: string;
  systemId: string;
  position: Vec3;
  /** Forward vector so the ship faces the same way on resume. */
  heading: Vec3;
  updatedAt: string;
}

export interface UserInfo {
  id: string;
  email: string;
}

/** Auth and save behind one interface so Supabase can replace the local stub without touching game code. */
export interface Backend {
  readonly kind: "local" | "supabase";
  currentUser(): Promise<UserInfo | null>;
  signUp(email: string, password: string): Promise<UserInfo>;
  signIn(email: string, password: string): Promise<UserInfo>;
  signOut(): Promise<void>;
  loadSave(userId: string): Promise<PlayerSave | null>;
  storeSave(userId: string, save: PlayerSave): Promise<void>;
}
