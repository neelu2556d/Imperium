import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Builds a Supabase client bound to a request/response cookie pair for use
 * inside `proxy.ts`. Returns both the client and the mutable `response` — any
 * refreshed auth tokens are written onto `response.cookies`, so the caller
 * must return *this* response (or copy its cookies) for the refreshed session
 * to stick. See the Supabase SSR guides for why `getAll`/`setAll` are required.
 */
export function createProxyClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Mirror onto the request (for any downstream reads) and the
          // response (so the browser receives the refreshed tokens).
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  return { supabase, response };
}
