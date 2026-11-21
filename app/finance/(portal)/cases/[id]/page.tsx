import Link from "next/link";
import { redirect } from "next/navigation";
import { allotFinanceCaseAction, saveFinanceCaseAction, saveMandateNdaAction } from "@/app/finance/actions";
import { PageHeader } from "@/components/common/ui";
import { FinanceAllotmentForm } from "@/components/finance/allotment-form";
import { FinanceCaseEditor } from "@/components/finance/case-editor";
import { canAllotCases, canEditCaseData, canEditMandate, canViewCase, isFinanceAdmin, isFinanceClient } from "@/lib/finance/access";
import { getFinanceSession } from "@/lib/finance/session";
import { getFinanceCase } from "@/lib/finance/store";
import { PortalError } from "@/lib/form";

export default async function FinanceCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getFinanceSession();
  if (!user) redirect("/finance/login");
  const { id } = await params;

  let bundle;
  try {
    bundle = getFinanceCase(user, id);
  } catch (error) {
    if (error instanceof PortalError) redirect(isFinanceClient(user) ? "/finance/my-case" : "/finance/cases");
    throw error;
  }

  if (!canViewCase(user, bundle.financeCase)) redirect("/finance/cases");
  const teamEditable = canEditCaseData(user, bundle.financeCase) && !isFinanceClient(user);
  const showMandate = canEditMandate(user, bundle.financeCase);
  const showAllotment = canAllotCases(user);
  const financeEmployees = bundle.users.filter((person) => person.roleSlug === "employee" && person.team === "Finance");
  const legalEmployees = bundle.users.filter((person) => person.roleSlug === "employee" && person.team === "Legal");

  return (
    <>
      <PageHeader
        eyebrow="Case profile"
        title={bundle.company.name}
        lede={`${bundle.financeCase.caseCategory} · ${bundle.financeCase.caseType} · ${bundle.financeCase.status.replaceAll("_", " ")}`}
      >
        {!isFinanceClient(user) ? (
          <Link className="btn ghost" href="/finance/cases">
            Back to cases
          </Link>
        ) : null}
      </PageHeader>
      <FinanceCaseEditor
        action={saveFinanceCaseAction}
        mandateAction={saveMandateNdaAction}
        financeCase={bundle.financeCase}
        company={bundle.company}
        teamEditable={teamEditable || isFinanceClient(user)}
        adminControls={isFinanceAdmin(user)}
        showMandate={showMandate}
      />
      {showAllotment ? (
        <FinanceAllotmentForm
          action={allotFinanceCaseAction}
          financeCase={bundle.financeCase}
          financeEmployees={financeEmployees}
          legalEmployees={legalEmployees}
        />
      ) : null}
    </>
  );
}
