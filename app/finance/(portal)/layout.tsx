import { redirect } from "next/navigation";
import { FinanceShell } from "@/components/finance/shell";
import { getFinanceSession } from "@/lib/finance/session";

export const dynamic = "force-dynamic";

export default async function FinancePortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getFinanceSession();
  if (!user) redirect("/finance/login");
  return <FinanceShell user={user}>{children}</FinanceShell>;
}
