import { redirect } from "next/navigation";
import { Denied, PageHeader } from "@/components/common/ui";
import { IpoModelBuilder } from "@/components/finance/ipo-builder";
import { canUseIpoModel } from "@/lib/finance/access";
import { getFinanceSession } from "@/lib/finance/session";

export default async function FinanceIpoPage() {
  const user = await getFinanceSession();
  if (!user) redirect("/finance/login");
  if (!canUseIpoModel(user)) return <Denied title="IPO model" />;

  return (
    <>
      <PageHeader
        eyebrow="IPO advisory"
        title="IPO financial model"
        lede="Upload audited P&L / balance sheet / cash flow PDFs, set IPO proceeds and capacity drivers, download a linked 3-statement Excel model."
      />
      <IpoModelBuilder />
    </>
  );
}
