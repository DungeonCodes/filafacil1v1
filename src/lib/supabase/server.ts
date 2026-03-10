import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKeyOrThrow, getSupabaseUrlOrThrow } from "./env";

export function getSupabaseServerClient() {
  const cookieStore = cookies();
  const supabaseUrl = getSupabaseUrlOrThrow();
  const supabaseAnonKey = getSupabaseAnonKeyOrThrow();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, cookie.options as CookieOptions);
          }
        } catch {
          // Cookie writes fail in Server Components; this is expected.
        }
      }
    }
  });
}
