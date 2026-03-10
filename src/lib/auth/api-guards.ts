import "server-only";

import { NextResponse } from "next/server";
import type { AppRole, SessionUser } from "./types";
import { getSessionUser } from "./session";

type ApiGuardResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse<{ error: string }> };

export async function requireApiAuthenticatedUser(allowedRoles?: readonly AppRole[]): Promise<ApiGuardResult> {
  const user = await getSessionUser();
  if (!user || !user.isActive) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Nao autenticado." }, { status: 401 })
    };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Acesso negado para este perfil." }, { status: 403 })
    };
  }

  return { ok: true, user };
}
