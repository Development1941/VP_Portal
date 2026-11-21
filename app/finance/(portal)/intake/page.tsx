import { redirect } from "next/navigation";
import { submitFinanceIntakeAction } from "@/app/finance/actions";
import { Denied, PageHeader } from "@/components/common/ui";
import { FinanceIntakeForm } from "@/components/finance/intake-form";
import { canCreateCase, isFinanceAdmin } from "@/lib/finance/access";
import { getFinanceSession } from "@/lib/finance/session";
import { loadFinanceWorkspace } from "@/lib/finance/store";

export default async function FinanceIntakePage() {
  const user = await getFinanceSession();
  if (!user) redirect("/finance/login");
  if (!canCreateCase(user)) return <Denied title="Project intake" />;
  const data = loadFinanceWorkspace(user);
  const admins = data.users.filter((person) => isFinanceAdmin(person));
  const financeEmployees = data.users.filter((person) => person.roleSlug === "employee" && person.team === "Finance");
  const legalEmployees = data.users.filter((person) => person.roleSlug === "employee" && person.team === "Legal");
  const clientNames = data.companies.map((company) => company.name).sort((a, b) => a.localeCompare(b));

  return (
    <>
      <PageHeader
        eyebrow="Client onboarding"
        title="New case"
        lede="Admin creates the client case with full sections. Matching existing client names appear as you type."
      />
      <FinanceIntakeForm
        action={submitFinanceIntakeAction}
        admins={admins}
        financeEmployees={financeEmployees}
        legalEmployees={legalEmployees}
        clientNames={clientNames}
        defaultAdminId={user.id}
      />
    </>
  );
}
