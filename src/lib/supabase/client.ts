"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKeyOrThrow, getSupabaseUrlOrThrow } from "./env";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = getSupabaseUrlOrThrow();
  const supabaseAnonKey = getSupabaseAnonKeyOrThrow();

  browserClient = createClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
