import { NextRequest, NextResponse } from "next/server";
import { buildLoginEmail, getDefaultRouteForRole, isValidUsername, normalizeUsername } from "@/lib/auth/constants";
import { ensureInitialAdminUser, getManagedUserByUsername } from "@/lib/auth/users";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

type LoginBody = {
  username?: unknown;
  password?: unknown;
};

function parseBody(value: unknown): LoginBody | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as LoginBody;
}

function toString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

export async function POST(request: NextRequest) {
  const rawBody = await request.json().catch(() => null);
  const body = parseBody(rawBody);

  const username = normalizeUsername(toString(body?.username));
  const password = toString(body?.password);

  if (!username || !password) {
    return NextResponse.json({ error: "Informe usuario e senha." }, { status: 400 });
  }
  if (!isValidUsername(username)) {
    return NextResponse.json({ error: "Usuario invalido." }, { status: 400 });
  }

  const ensureAdminResult = await ensureInitialAdminUser();
  if (!ensureAdminResult.ok) {
    return NextResponse.json({ error: ensureAdminResult.error }, { status: 500 });
  }

  const managedUserResult = await getManagedUserByUsername(username);
  if (!managedUserResult.ok) {
    return NextResponse.json({ error: managedUserResult.error }, { status: 500 });
  }

  const managedUser = managedUserResult.data;
  if (!managedUser || !managedUser.isActive) {
    return NextResponse.json({ error: "Usuario ou senha invalidos." }, { status: 401 });
  }

  const { supabase, applyCookies } = createSupabaseRouteHandlerClient(request);
  const { error } = await supabase.auth.signInWithPassword({
    email: buildLoginEmail(username),
    password
  });

  if (error) {
    return applyCookies(NextResponse.json({ error: "Usuario ou senha invalidos." }, { status: 401 }));
  }

  return applyCookies(
    NextResponse.json({
      ok: true,
      username: managedUser.username,
      role: managedUser.role,
      redirectTo: getDefaultRouteForRole(managedUser.role)
    })
  );
}
