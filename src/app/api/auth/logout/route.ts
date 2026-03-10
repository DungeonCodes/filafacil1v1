import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function POST(request: NextRequest) {
  const { supabase, applyCookies } = createSupabaseRouteHandlerClient(request);
  await supabase.auth.signOut();

  return applyCookies(NextResponse.redirect(new URL("/login", request.url), 303));
}
