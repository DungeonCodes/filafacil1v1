import { NextRequest, NextResponse } from "next/server";
import { requireApiAuthenticatedUser } from "@/lib/auth/api-guards";
import { setManagedUserActive } from "@/lib/auth/users";

type StatusBody = {
  isActive?: unknown;
};

function parseUserId(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
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

  const body = (await request.json().catch(() => null)) as StatusBody | null;
  if (!body || typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "Campo isActive invalido." }, { status: 400 });
  }

  if (authResult.user.id === userId && !body.isActive) {
    return NextResponse.json({ error: "Voce nao pode desativar o proprio usuario." }, { status: 400 });
  }

  const updateResult = await setManagedUserActive(userId, body.isActive);
  if (!updateResult.ok) {
    return NextResponse.json({ error: updateResult.error }, { status: 400 });
  }

  return NextResponse.json({ data: updateResult.data });
}
