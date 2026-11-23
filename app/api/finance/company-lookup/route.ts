import { NextResponse } from "next/server";
import { canCreateCase, canEditAnyCase, isFinanceAdmin } from "@/lib/finance/access";
import { lookupCompanyOnline, type CompanyFetchSource } from "@/lib/finance/company-fetch";
import { getFinanceSession } from "@/lib/finance/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getFinanceSession();
  if (!user) {
    return NextResponse.json({ error: "Sign in to Embee Finance first." }, { status: 401 });
  }
  if (!isFinanceAdmin(user) && !canCreateCase(user) && !canEditAnyCase(user)) {
    return NextResponse.json({ error: "Only Finance Admin / employees can fetch company data." }, { status: 403 });
  }

  let body: { source?: string; query?: string; cin?: string };
  try {
    body = (await request.json()) as { source?: string; query?: string; cin?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const source = body.source === "tracxn" ? "tracxn" : body.source === "mca" ? "mca" : null;
  if (!source) {
    return NextResponse.json({ error: "Choose Tracxn or MCA as the source." }, { status: 400 });
  }

  try {
    const company = await lookupCompanyOnline({
      source: source as CompanyFetchSource,
      query: String(body.query || ""),
      cin: String(body.cin || ""),
    });
    return NextResponse.json({ company });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Company lookup failed." },
      { status: 404 },
    );
  }
}
