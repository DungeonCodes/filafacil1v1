export const APP_ROLES = ["attendant", "doctor", "admin"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export interface SessionUser {
  id: number;
  authUserId: string;
  username: string;
  role: AppRole;
  isActive: boolean;
}

export interface ManagedUser {
  id: number;
  username: string;
  role: AppRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

export type AsyncResult<T> = { ok: true; data: T } | { ok: false; error: string };
