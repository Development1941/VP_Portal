import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

function isFinancePath(pathname: string) {
  return pathname === "/finance" || pathname.startsWith("/finance/") || pathname.startsWith("/api/finance/");
}

function handleFinanceAuth(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isFinanceApi = pathname.startsWith("/api/finance/");
  const signedIn = Boolean(request.cookies.get("finance_session")?.value);

  if (!signedIn && pathname !== "/finance/login") {
    if (isFinanceApi) {
      return NextResponse.json({ error: "Sign in to Embee Finance first." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/finance/login";
    return NextResponse.redirect(url);
  }

  if (signedIn && (pathname === "/finance/login" || pathname === "/finance")) {
    const url = request.nextUrl.clone();
    url.pathname = "/finance/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Org picker and public IPO assets never require auth.
  if (pathname === "/" || pathname.startsWith("/ipo/")) {
    return NextResponse.next();
  }

  // Finance portal uses its own cookie session, even when Supabase is configured for Finsoft.
  if (isFinancePath(pathname)) {
    return handleFinanceAuth(request);
  }

  if (!isSupabaseConfigured()) {
    const isPublic = pathname === "/login";
    const signedIn = Boolean(request.cookies.get("vp_session")?.value);
    if (!signedIn && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    if (signedIn && pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  try {
    return await updateSupabaseSession(request);
  } catch {
    // Bad/missing Supabase credentials must not crash every page on Vercel.
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
