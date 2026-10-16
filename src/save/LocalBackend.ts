import type { Backend, PlayerSave, UserInfo } from "./types.ts";

/**
 * Development stub: accounts and saves live in this browser's localStorage.
 * The password check is a plain comparison. This is never meant to be secure,
 * only to exercise the same flow Supabase will provide.
 */
const USERS_KEY = "andromeadow.local.users";
const SESSION_KEY = "andromeadow.local.session";
const SAVE_PREFIX = "andromeadow.local.save.";

interface StoredUser extends UserInfo {
  password: string;
}

function readUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]") as StoredUser[];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export class LocalBackend implements Backend {
  readonly kind = "local" as const;

  async currentUser(): Promise<UserInfo | null> {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    const user = readUsers().find((u) => u.id === id);
    return user ? { id: user.id, email: user.email } : null;
  }

  async signUp(email: string, password: string): Promise<UserInfo> {
    const users = readUsers();
    const key = email.trim().toLowerCase();
    if (!key || !password) throw new Error("Email and password are required");
    if (users.some((u) => u.email === key)) throw new Error("An account with that email already exists");
    const user: StoredUser = { id: `local-${Date.now().toString(36)}`, email: key, password };
    users.push(user);
    writeUsers(users);
    localStorage.setItem(SESSION_KEY, user.id);
    return { id: user.id, email: user.email };
  }

  async signIn(email: string, password: string): Promise<UserInfo> {
    const key = email.trim().toLowerCase();
    const user = readUsers().find((u) => u.email === key);
    if (!user || user.password !== password) throw new Error("Invalid email or password");
    localStorage.setItem(SESSION_KEY, user.id);
    return { id: user.id, email: user.email };
  }

  async signOut(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
  }

  async loadSave(userId: string): Promise<PlayerSave | null> {
    const raw = localStorage.getItem(SAVE_PREFIX + userId);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PlayerSave;
    } catch {
      return null;
    }
  }

  async storeSave(userId: string, save: PlayerSave): Promise<void> {
    localStorage.setItem(SAVE_PREFIX + userId, JSON.stringify(save));
  }
}
