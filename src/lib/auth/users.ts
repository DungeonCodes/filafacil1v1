import "server-only";

import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { buildLoginEmail, INITIAL_ADMIN_PASSWORD, INITIAL_ADMIN_USERNAME, isValidUsername, normalizeUsername } from "./constants";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { isAppRole, type AppRole, type AsyncResult, type ManagedUser } from "./types";

type ManagedUserRow = {
  id?: unknown;
  auth_user_id?: unknown;
  username?: unknown;
  role?: unknown;
  is_active?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type ManagedUserInternal = ManagedUser & {
  authUserId: string;
};

type CreateManagedUserInput = {
  username: string;
  password: string;
  role: AppRole;
  isActive?: boolean;
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

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallbackMessage;
}

function isAlreadyRegisteredError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return false;
  }

  const message = (error as { message?: unknown }).message;
  if (typeof message !== "string") {
    return false;
  }

  const normalized = message.toLowerCase();
  return normalized.includes("already") || normalized.includes("registered") || normalized.includes("exists");
}

function parseManagedUserRow(row: ManagedUserRow | null): ManagedUserInternal | null {
  if (!row) {
    return null;
  }

  const id = toNumber(row.id);
  const authUserId = toString(row.auth_user_id);
  const username = toString(row.username);
  const role = row.role;
  const createdAt = toString(row.created_at) ?? new Date(0).toISOString();
  const updatedAt = toString(row.updated_at) ?? createdAt;

  if (id === null || !authUserId || !username || !isAppRole(role)) {
    return null;
  }

  return {
    id,
    authUserId,
    username,
    role,
    isActive: toBoolean(row.is_active),
    createdAt,
    updatedAt
  };
}

function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "A senha deve ter pelo menos 8 caracteres.";
  }

  return null;
}

async function findAuthUserByEmail(email: string): Promise<AsyncResult<SupabaseAuthUser | null>> {
  const serviceClient = getSupabaseServiceClient();
  const { data, error } = await serviceClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (error) {
    return { ok: false, error: getErrorMessage(error, "Nao foi possivel listar usuarios de autenticacao.") };
  }

  const normalizedEmail = email.toLowerCase();
  const authUser = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail) ?? null;
  return { ok: true, data: authUser };
}

export async function getManagedUserByUsername(username: string): Promise<AsyncResult<ManagedUserInternal | null>> {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername || !isValidUsername(normalizedUsername)) {
    return { ok: true, data: null };
  }

  const serviceClient = getSupabaseServiceClient();
  const { data, error } = await serviceClient
    .from("app_users")
    .select("id, auth_user_id, username, role, is_active, created_at, updated_at")
    .eq("username", normalizedUsername)
    .maybeSingle();

  if (error) {
    return { ok: false, error: getErrorMessage(error, "Nao foi possivel buscar o usuario.") };
  }

  return {
    ok: true,
    data: parseManagedUserRow((data as ManagedUserRow | null) ?? null)
  };
}

async function getManagedUserById(userId: number): Promise<AsyncResult<ManagedUserInternal | null>> {
  const serviceClient = getSupabaseServiceClient();
  const { data, error } = await serviceClient
    .from("app_users")
    .select("id, auth_user_id, username, role, is_active, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: getErrorMessage(error, "Nao foi possivel buscar o usuario por ID.") };
  }

  return {
    ok: true,
    data: parseManagedUserRow((data as ManagedUserRow | null) ?? null)
  };
}

export async function ensureInitialAdminUser(): Promise<AsyncResult<null>> {
  const lookupResult = await getManagedUserByUsername(INITIAL_ADMIN_USERNAME);
  if (!lookupResult.ok) {
    return lookupResult;
  }

  const existingAdmin = lookupResult.data;
  const normalizedUsername = normalizeUsername(INITIAL_ADMIN_USERNAME);
  const loginEmail = buildLoginEmail(normalizedUsername);
  const serviceClient = getSupabaseServiceClient();

  let authUserId = existingAdmin?.authUserId ?? null;

  if (!authUserId) {
    const { data: createData, error: createError } = await serviceClient.auth.admin.createUser({
      email: loginEmail,
      password: INITIAL_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        username: normalizedUsername,
        role: "admin"
      }
    });

    if (createError) {
      if (!isAlreadyRegisteredError(createError)) {
        return { ok: false, error: getErrorMessage(createError, "Nao foi possivel criar o usuario administrador inicial.") };
      }

      const authLookupResult = await findAuthUserByEmail(loginEmail);
      if (!authLookupResult.ok) {
        return authLookupResult;
      }

      if (!authLookupResult.data?.id) {
        return { ok: false, error: "Usuario administrador inicial nao encontrado no Supabase Auth." };
      }
      authUserId = authLookupResult.data.id;
    } else {
      authUserId = createData.user?.id ?? null;
    }
  }

  if (!authUserId) {
    return { ok: false, error: "Nao foi possivel resolver o auth_user_id do administrador inicial." };
  }

  if (existingAdmin) {
    const { error: updateError } = await serviceClient
      .from("app_users")
      .update({
        auth_user_id: authUserId,
        role: "admin",
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", existingAdmin.id);

    if (updateError) {
      return { ok: false, error: getErrorMessage(updateError, "Nao foi possivel atualizar o administrador inicial.") };
    }

    return { ok: true, data: null };
  }

  const { error: insertError } = await serviceClient.from("app_users").insert({
    auth_user_id: authUserId,
    username: normalizedUsername,
    role: "admin",
    is_active: true
  });

  if (insertError) {
    return { ok: false, error: getErrorMessage(insertError, "Nao foi possivel registrar o administrador inicial.") };
  }

  return { ok: true, data: null };
}

export async function listManagedUsers(): Promise<AsyncResult<ManagedUser[]>> {
  const serviceClient = getSupabaseServiceClient();
  const { data, error } = await serviceClient
    .from("app_users")
    .select("id, auth_user_id, username, role, is_active, created_at, updated_at")
    .order("username", { ascending: true });

  if (error) {
    return { ok: false, error: getErrorMessage(error, "Nao foi possivel carregar a lista de usuarios.") };
  }

  const rows = Array.isArray(data) ? (data as ManagedUserRow[]) : [];
  const users = rows
    .map((row) => parseManagedUserRow(row))
    .filter((row): row is ManagedUserInternal => row !== null)
    .map(({ authUserId: _ignoredAuthUserId, ...user }) => user);

  return { ok: true, data: users };
}

export async function createManagedUser(input: CreateManagedUserInput): Promise<AsyncResult<ManagedUser>> {
  const normalizedUsername = normalizeUsername(input.username);
  if (!normalizedUsername || !isValidUsername(normalizedUsername)) {
    return { ok: false, error: "Usuario invalido. Use 3 a 32 caracteres: letras, numeros, ponto, hifen ou underscore." };
  }

  const passwordError = validatePassword(input.password);
  if (passwordError) {
    return { ok: false, error: passwordError };
  }

  if (!isAppRole(input.role)) {
    return { ok: false, error: "Perfil invalido." };
  }

  const existingResult = await getManagedUserByUsername(normalizedUsername);
  if (!existingResult.ok) {
    return existingResult;
  }
  if (existingResult.data) {
    return { ok: false, error: "Ja existe um login com este usuario." };
  }

  const serviceClient = getSupabaseServiceClient();
  const loginEmail = buildLoginEmail(normalizedUsername);

  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email: loginEmail,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      username: normalizedUsername,
      role: input.role
    }
  });

  if (authError) {
    return { ok: false, error: getErrorMessage(authError, "Nao foi possivel criar o usuario no Supabase Auth.") };
  }

  const authUserId = authData.user?.id;
  if (!authUserId) {
    return { ok: false, error: "Supabase Auth nao retornou o identificador do usuario criado." };
  }

  const { data: insertData, error: insertError } = await serviceClient
    .from("app_users")
    .insert({
      auth_user_id: authUserId,
      username: normalizedUsername,
      role: input.role,
      is_active: input.isActive ?? true
    })
    .select("id, auth_user_id, username, role, is_active, created_at, updated_at")
    .single();

  if (insertError) {
    await serviceClient.auth.admin.deleteUser(authUserId);
    return { ok: false, error: getErrorMessage(insertError, "Nao foi possivel salvar o perfil de acesso.") };
  }

  const created = parseManagedUserRow((insertData as ManagedUserRow | null) ?? null);
  if (!created) {
    return { ok: false, error: "Registro criado com dados invalidos." };
  }

  const { authUserId: _ignoredAuthUserId, ...publicUser } = created;
  return { ok: true, data: publicUser };
}

export async function setManagedUserActive(userId: number, isActive: boolean): Promise<AsyncResult<ManagedUser>> {
  const existingResult = await getManagedUserById(userId);
  if (!existingResult.ok) {
    return existingResult;
  }

  if (!existingResult.data) {
    return { ok: false, error: "Usuario nao encontrado." };
  }

  const serviceClient = getSupabaseServiceClient();
  const { data, error } = await serviceClient
    .from("app_users")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString()
    })
    .eq("id", userId)
    .select("id, auth_user_id, username, role, is_active, created_at, updated_at")
    .single();

  if (error) {
    return { ok: false, error: getErrorMessage(error, "Nao foi possivel atualizar o status do usuario.") };
  }

  const updated = parseManagedUserRow((data as ManagedUserRow | null) ?? null);
  if (!updated) {
    return { ok: false, error: "Registro atualizado com dados invalidos." };
  }

  const { authUserId: _ignoredAuthUserId, ...publicUser } = updated;
  return { ok: true, data: publicUser };
}

export async function resetManagedUserPassword(userId: number, newPassword: string): Promise<AsyncResult<null>> {
  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return { ok: false, error: passwordError };
  }

  const existingResult = await getManagedUserById(userId);
  if (!existingResult.ok) {
    return existingResult;
  }
  if (!existingResult.data) {
    return { ok: false, error: "Usuario nao encontrado." };
  }

  const serviceClient = getSupabaseServiceClient();
  const { error } = await serviceClient.auth.admin.updateUserById(existingResult.data.authUserId, {
    password: newPassword
  });

  if (error) {
    return { ok: false, error: getErrorMessage(error, "Nao foi possivel redefinir a senha do usuario.") };
  }

  return { ok: true, data: null };
}
