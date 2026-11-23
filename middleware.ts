import { NextResponse, type NextRequest } from "next/server";

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

function handleDemoAuth(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
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

export async function middleware(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;

    // Org picker and public IPO assets never require auth.
    if (pathname === "/" || pathname.startsWith("/ipo/") || pathname === "/api/version") {
      return NextResponse.next();
    }

    // Finance portal uses its own cookie session, even when Supabase is configured for Finsoft.
    if (isFinancePath(pathname)) {
      return handleFinanceAuth(request);
    }

    // Lazy-load env + supabase so a bad import never takes down every route.
    const { isSupabaseConfigured } = await import("@/lib/env");
    if (!isSupabaseConfigured()) {
      return handleDemoAuth(request);
    }

    try {
      const { updateSupabaseSession } = await import("@/lib/supabase/middleware");
      return await updateSupabaseSession(request);
    } catch {
      return handleDemoAuth(request);
    }
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
