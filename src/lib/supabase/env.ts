function normalizePublicValue(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === "undefined" || normalized.toLowerCase() === "null") {
    return null;
  }

  return normalized;
}

export function getSupabaseUrlOrThrow(): string {
  const supabaseUrl = normalizePublicValue(process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL. Check .env.local and restart the Next.js server.");
  }

  return supabaseUrl;
}

export function getSupabaseAnonKeyOrThrow(): string {
  const supabaseAnonKey = normalizePublicValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Check .env.local and restart the Next.js server.");
  }

  return supabaseAnonKey;
}

export function getSupabaseServiceRoleKeyOrThrow(): string {
  const serviceRoleKey = normalizePublicValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Configure it only on server-side environments.");
  }

  return serviceRoleKey;
}
