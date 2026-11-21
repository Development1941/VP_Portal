import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    const pathname = request.nextUrl.pathname;
    const isFinanceApp = pathname === "/finance" || pathname.startsWith("/finance/");
    const isFinanceApi = pathname.startsWith("/api/finance/");
    const isFinance = isFinanceApp || isFinanceApi;
    const isPublic =
      pathname === "/" ||
      pathname === "/login" ||
      pathname === "/finance/login" ||
      pathname.startsWith("/ipo/");

    if (pathname === "/" || pathname.startsWith("/ipo/")) return NextResponse.next();

    if (isFinance) {
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
  return updateSupabaseSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
