import { NextRequest, NextResponse } from "next/server";
import { requireApiAuthenticatedUser } from "@/lib/auth/api-guards";
import { resetManagedUserPassword } from "@/lib/auth/users";

type PasswordBody = {
  password?: unknown;
};

function parseUserId(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function toString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

export async function PATCH(request: NextRequest, { params }: { params: { userId: string } }) {
  const authResult = await requireApiAuthenticatedUser(["admin"]);
  if (!authResult.ok) {
    return authResult.response;
  }

  const userId = parseUserId(params.userId);
  if (userId === null) {
    return NextResponse.json({ error: "ID de usuario invalido." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as PasswordBody | null;
  const password = toString(body?.password);
  if (!password) {
    return NextResponse.json({ error: "Informe uma nova senha." }, { status: 400 });
  }

  const resetResult = await resetManagedUserPassword(userId, password);
  if (!resetResult.ok) {
    return NextResponse.json({ error: resetResult.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
