import type { AsyncResult, AccessProfile, ManagedUserView } from "./types";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function getErrorMessage(payload: unknown, fallbackMessage: string): string {
  if (isObject(payload) && typeof payload.error === "string" && payload.error.trim().length > 0) {
    return payload.error;
  }
  return fallbackMessage;
}

function toManagedUser(value: unknown): ManagedUserView | null {
  if (!isObject(value)) {
    return null;
  }

  const id = Number(value.id);
  const username = typeof value.username === "string" ? value.username : null;
  const role = typeof value.role === "string" ? value.role : null;
  const isActive = value.isActive === true;
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : null;
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : null;

  if (!Number.isFinite(id) || !username || !createdAt || !updatedAt) {
    return null;
  }

  if (role !== "attendant" && role !== "doctor" && role !== "admin") {
    return null;
  }

  return {
    id,
    username,
    role,
    isActive,
    createdAt,
    updatedAt
  };
}

export async function loadManagedUsers(): Promise<AsyncResult<ManagedUserView[]>> {
  try {
    const response = await fetch("/api/admin/users", {
      method: "GET",
      cache: "no-store"
    });
    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      return { ok: false, error: getErrorMessage(payload, "Nao foi possivel carregar usuarios.") };
    }

    const rawList = isObject(payload) && Array.isArray(payload.data) ? payload.data : [];
    const users = rawList.map((item) => toManagedUser(item)).filter((item): item is ManagedUserView => item !== null);

    return { ok: true, data: users };
  } catch {
    return { ok: false, error: "Falha de comunicacao ao carregar usuarios." };
  }
}

export async function createManagedUser(payload: {
  username: string;
  password: string;
  role: AccessProfile;
  isActive: boolean;
}): Promise<AsyncResult<ManagedUserView>> {
  try {
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const responsePayload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      return { ok: false, error: getErrorMessage(responsePayload, "Nao foi possivel criar usuario.") };
    }

    const user = toManagedUser(isObject(responsePayload) ? responsePayload.data : null);
    if (!user) {
      return { ok: false, error: "Resposta invalida ao criar usuario." };
    }

    return { ok: true, data: user };
  } catch {
    return { ok: false, error: "Falha de comunicacao ao criar usuario." };
  }
}

export async function updateManagedUserStatus(userId: number, isActive: boolean): Promise<AsyncResult<ManagedUserView>> {
  try {
    const response = await fetch(`/api/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ isActive })
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      return { ok: false, error: getErrorMessage(payload, "Nao foi possivel atualizar status do usuario.") };
    }

    const user = toManagedUser(isObject(payload) ? payload.data : null);
    if (!user) {
      return { ok: false, error: "Resposta invalida ao atualizar status do usuario." };
    }

    return { ok: true, data: user };
  } catch {
    return { ok: false, error: "Falha de comunicacao ao atualizar status do usuario." };
  }
}

export async function resetManagedUserPassword(userId: number, password: string): Promise<AsyncResult<null>> {
  try {
    const response = await fetch(`/api/admin/users/${userId}/password`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password })
    });

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      return { ok: false, error: getErrorMessage(payload, "Nao foi possivel redefinir a senha.") };
    }

    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "Falha de comunicacao ao redefinir a senha." };
  }
}
