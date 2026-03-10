import "server-only";

import type { SessionUser } from "./types";
import { isAppRole } from "./types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

type SessionUserRow = {
  id?: unknown;
  auth_user_id?: unknown;
  username?: unknown;
  role?: unknown;
  is_active?: unknown;
};

function toNumber(value: unknown): number | null {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    return null;
  }
  return normalized;
}

function toString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

function parseSessionUserRow(row: SessionUserRow | null): SessionUser | null {
  if (!row) {
    return null;
  }

  const id = toNumber(row.id);
  const authUserId = toString(row.auth_user_id);
  const username = toString(row.username);
  const role = row.role;

  if (id === null || !authUserId || !username || !isAppRole(role)) {
    return null;
  }

  return {
    id,
    authUserId,
    username,
    role,
    isActive: toBoolean(row.is_active)
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = getSupabaseServerClient();
  const serviceClient = getSupabaseServiceClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data, error } = await serviceClient
    .from("app_users")
    .select("id, auth_user_id, username, role, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) {
    return null;
  }

  return parseSessionUserRow((data as SessionUserRow | null) ?? null);
}
