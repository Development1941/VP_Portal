import { redirect } from "next/navigation";
import { saveFinanceCaseAction, saveMandateNdaAction } from "@/app/finance/actions";
import { PageHeader } from "@/components/common/ui";
import { FinanceCaseEditor } from "@/components/finance/case-editor";
import { isFinanceClient } from "@/lib/finance/access";
import { getFinanceSession } from "@/lib/finance/session";
import { clientCaseFor } from "@/lib/finance/store";

export default async function FinanceMyCasePage() {
  const user = await getFinanceSession();
  if (!user) redirect("/finance/login");
  if (!isFinanceClient(user)) redirect("/finance/cases");

  const bundle = clientCaseFor(user);
  if (!bundle) {
    return (
      <>
        <PageHeader eyebrow="Client view" title="My case" lede="No case is linked to this client login yet." />
        <section className="card">
          <p className="muted">Ask the Embee team to create intake for your company and attach this email as the client contact.</p>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Client view"
        title={bundle.company.name}
        lede="Only your own case is visible. Fill what you can, add questions for Embee, and save."
      />
      <FinanceCaseEditor
        action={saveFinanceCaseAction}
        mandateAction={saveMandateNdaAction}
        financeCase={bundle.financeCase}
        company={bundle.company}
        teamEditable={true}
        adminControls={false}
        showMandate={false}
      />
    </>
  );
}
