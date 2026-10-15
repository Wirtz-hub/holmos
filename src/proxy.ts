import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { customDomainFor, isPassThroughPath } from "@/lib/hosts";

// Pages anyone may open without signing in. Each one shows published content
// only (landing pages, forms, booking pages) or checks its own secret (cron).
const PUBLIC_PATHS = ["/f", "/book", "/embed", "/sites", "/api/public", "/api/cron"];

const startsWithAny = (pathname: string, paths: string[]) =>
  paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // A client's own domain pointed at HolmOS shows its funnel, never the app.
  const domain = customDomainFor(request.headers.get("host"), process.env.APP_URL);
  if (domain) {
    if (isPassThroughPath(pathname)) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${domain}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  if (startsWithAny(pathname, PUBLIC_PATHS)) return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Not configured yet: let pages render their own "setup needed" message.
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refreshes the session cookie if needed. Must run before any redirect logic.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && !startsWithAny(pathname, ["/login"])) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
