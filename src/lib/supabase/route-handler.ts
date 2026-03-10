import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKeyOrThrow, getSupabaseUrlOrThrow } from "./env";

type RouteSupabaseContext = {
  readonly supabase: SupabaseClient;
  applyCookies: <TResponse extends NextResponse>(response: TResponse) => TResponse;
};

export function createSupabaseRouteHandlerClient(request: NextRequest): RouteSupabaseContext {
  const supabaseUrl = getSupabaseUrlOrThrow();
  const supabaseAnonKey = getSupabaseAnonKeyOrThrow();
  const cookieBridgeResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          cookieBridgeResponse.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      }
    }
  });

  function applyCookies<TResponse extends NextResponse>(response: TResponse): TResponse {
    for (const cookie of cookieBridgeResponse.cookies.getAll()) {
      response.cookies.set(cookie);
    }

    return response;
  }

  return { supabase, applyCookies };
}
