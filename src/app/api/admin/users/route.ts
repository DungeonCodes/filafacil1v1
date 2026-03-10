import { NextRequest, NextResponse } from "next/server";
import { requireApiAuthenticatedUser } from "@/lib/auth/api-guards";
import { createManagedUser, listManagedUsers } from "@/lib/auth/users";
import { isAppRole } from "@/lib/auth/types";

type CreateUserBody = {
  username?: unknown;
  password?: unknown;
  role?: unknown;
  isActive?: unknown;
};

function parseBody(value: unknown): CreateUserBody | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as CreateUserBody;
}

function toString(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

export async function GET() {
  const authResult = await requireApiAuthenticatedUser(["admin"]);
  if (!authResult.ok) {
    return authResult.response;
  }

  const listResult = await listManagedUsers();
  if (!listResult.ok) {
    return NextResponse.json({ error: listResult.error }, { status: 500 });
  }

  return NextResponse.json({ data: listResult.data });
}

export async function POST(request: NextRequest) {
  const authResult = await requireApiAuthenticatedUser(["admin"]);
  if (!authResult.ok) {
    return authResult.response;
  }

  const rawBody = await request.json().catch(() => null);
  const body = parseBody(rawBody);

  const username = toString(body?.username);
  const password = toString(body?.password);
  const role = body?.role;
  const isActive = body?.isActive;

  if (!username || !password || !isAppRole(role)) {
    return NextResponse.json({ error: "Dados invalidos para criar usuario." }, { status: 400 });
  }

  const createResult = await createManagedUser({
    username,
    password,
    role,
    isActive: typeof isActive === "boolean" ? isActive : true
  });

  if (!createResult.ok) {
    return NextResponse.json({ error: createResult.error }, { status: 400 });
  }

  return NextResponse.json({ data: createResult.data }, { status: 201 });
}
