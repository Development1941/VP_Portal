import { NextResponse } from "next/server";
import { canUseIpoModel } from "@/lib/finance/access";
import { SAMPLE_HISTORICALS, SAMPLE_ISSUE, type IpoHistoricals, type IpoIssueInputs } from "@/lib/finance/ipo-model";
import { getFinanceSession } from "@/lib/finance/session";
import { buildIpoWorkbook } from "@/lib/finance/ipo-workbook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getFinanceSession();
  if (!user || !canUseIpoModel(user)) {
    return NextResponse.json({ error: "IPO model is limited to Admin and Finance employees." }, { status: 403 });
  }

  let body: { historical?: IpoHistoricals; issue?: IpoIssueInputs } = {};
  try {
    body = (await request.json()) as { historical?: IpoHistoricals; issue?: IpoIssueInputs };
  } catch {
    body = {};
  }

  const historical = { ...SAMPLE_HISTORICALS, ...(body.historical || {}) };
  const issue = { ...SAMPLE_ISSUE, ...(body.issue || {}) };
  const buffer = buildIpoWorkbook(historical, issue);
  const safeName = historical.companyName.replace(/[^\w.-]+/g, "_").slice(0, 40) || "IPO_Model";

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeName}_IPO_Financial_Model.xlsx"`,
    },
  });
}
