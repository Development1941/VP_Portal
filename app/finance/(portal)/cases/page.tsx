import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Denied, PageHeader, Stat } from "@/components/common/ui";
import { canCreateCase, canViewCaseList } from "@/lib/finance/access";
import { CASE_STATUSES } from "@/lib/finance/case-types";
import { getFinanceSession } from "@/lib/finance/session";
import { loadFinanceWorkspace } from "@/lib/finance/store";

export default async function FinanceCasesPage() {
  const user = await getFinanceSession();
  if (!user) redirect("/finance/login");
  if (!canViewCaseList(user)) return <Denied title="Cases" />;
  const data = loadFinanceWorkspace(user);
  const companyName = (id: string) => data.companies.find((item) => item.id === id)?.name || "—";
  const personName = (id: string) => data.users.find((item) => item.id === id)?.fullName || "Unassigned";
  const statusLabel = (value: string) => CASE_STATUSES.find((item) => item.value === value)?.label || value;

  return (
    <>
      <PageHeader
        eyebrow="Client onboarding"
        title="Cases"
        lede={canCreateCase(user) ? "All clients and cases. Employees only see allotted clients." : "Your allotted clients and cases only."}
      >
        {canCreateCase(user) ? (
          <Link className="btn" href="/finance/intake">
            New case
          </Link>
        ) : null}
      </PageHeader>
      <section className="stats">
        <Stat label="Open cases" value={String(data.cases.length)} />
        <Stat label="In intake" value={String(data.cases.filter((item) => item.status === "intake").length)} />
        <Stat label="In review" value={String(data.cases.filter((item) => item.status === "review").length)} />
        <Stat label="Ready" value={String(data.cases.filter((item) => item.status === "ready").length)} />
      </section>
      <section className="card status-board">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Category</th>
                <th>Case type</th>
                <th>Amount sought</th>
                <th>Status</th>
                <th>Allotted</th>
                <th>Legal</th>
                <th>Mandate</th>
                <th>NDA</th>
              </tr>
            </thead>
            <tbody>
              {data.cases.map((item) => (
                <tr key={item.id}>
                  <td className="project-cell">
                    <Link href={`/finance/cases/${item.id}`}>{companyName(item.companyId)}</Link>
                  </td>
                  <td>{item.caseCategory || "—"}</td>
                  <td>{item.caseType}</td>
                  <td>{item.amountSought || "—"}</td>
                  <td>
                    <Badge value={item.status} />
                    <span className="muted"> {statusLabel(item.status)}</span>
                  </td>
                  <td>{(item.allottedEmployeeIds || []).map(personName).filter(Boolean).join(", ") || "—"}</td>
                  <td>{item.legalAssigneeId ? personName(item.legalAssigneeId) : "—"}</td>
                  <td>{item.mandateStatus.replaceAll("_", " ")}</td>
                  <td>{item.ndaStatus.replaceAll("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
