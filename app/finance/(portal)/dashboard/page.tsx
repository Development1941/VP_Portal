import Link from "next/link";
import { uploadFinanceProjectsAction } from "@/app/finance/actions";
import { Badge, PageHeader, Stat } from "@/components/common/ui";
import { SheetUpload } from "@/components/dashboard/sheet-upload";
import { canCreateCase, canUploadFinanceSheet, isFinanceClient } from "@/lib/finance/access";
import { getFinanceSession } from "@/lib/finance/session";
import { loadFinanceWorkspace } from "@/lib/finance/store";
import { redirect } from "next/navigation";

export default async function FinanceDashboardPage() {
  const user = await getFinanceSession();
  if (!user) redirect("/finance/login");
  if (isFinanceClient(user)) redirect("/finance/my-case");
  const data = loadFinanceWorkspace(user);
  const canUpload = canUploadFinanceSheet(user);
  const companies = [...new Set(data.projects.map((row) => row.company).filter(Boolean))];
  const withStatus = data.projects.filter((row) => row.status.trim()).length;
  const withRemarks = data.projects.filter((row) => row.remarks.trim()).length;
  const uniqueProjects = [...new Set(data.projects.map((row) => row.project).filter(Boolean))].length;

  return (
    <>
      <PageHeader eyebrow="Embee Finance" title="Dashboard" lede={data.sheetTitle}>
        {canCreateCase(user) ? (
          <Link className="btn" href="/finance/intake">
            New case
          </Link>
        ) : null}
      </PageHeader>

      <section className="stats">
        <Stat label="Cases" value={String(data.cases.length)} href="/finance/cases" detail="Debt cases created from project intake." />
        <Stat label="Projects" value={String(uniqueProjects)} detail="Unique project names on the finance status sheet." />
        <Stat label="Sheet rows" value={String(data.projects.length)} detail="Including bank-line continuations such as Mumbai Cooperative Banks." />
        <Stat label="With status" value={String(withStatus)} detail="Rows that already have a status such as Loan." />
        <Stat label="With remarks" value={String(withRemarks)} detail="Rows with task or remarks text filled in." />
      </section>

      <section className="card" id="finance-companies">
        <p className="eyebrow">By company</p>
        <h2>Company groups</h2>
        <div className="stats">
          {companies.map((company) => (
            <Stat
              key={company}
              label={company}
              value={String(data.projects.filter((row) => row.company === company).length)}
              detail={`${data.projects.filter((row) => row.company === company).length} rows under ${company}.`}
            />
          ))}
        </div>
      </section>

      <section className="card status-board" id="finance-projects">
        <div className="card-head">
          <div>
            <p className="eyebrow">Pipeline</p>
            <h2>Finance projects</h2>
            <p className="muted">
              Signed in as {user.fullName} · {user.roleName}
              {canUpload ? "" : " · Upload is limited to Admin and Manager profiles"}
            </p>
          </div>
          {canUpload ? (
            <div className="sheet-actions">
              <SheetUpload
                action={uploadFinanceProjectsAction}
                button="Upload CSV / Excel"
                title="Upload finance projects"
                hint="Use a CSV or Excel file with S.no, Project, Bank, Status, Task/Remarks, Concerned Person, Case Head, and Company. The dashboard list is replaced with the uploaded sheet."
                field="sheet"
              />
            </div>
          ) : null}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>S.no</th>
                <th>Project</th>
                <th>Bank</th>
                <th>Status</th>
                <th>Task / Remarks</th>
                <th>Concerned person</th>
                <th>Case head</th>
                <th>Company</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((row) => (
                <tr key={row.id}>
                  <td>{row.serial || "—"}</td>
                  <td className="project-cell">{row.project || "—"}</td>
                  <td>{row.bank || "—"}</td>
                  <td>{row.status ? <Badge value={row.status} /> : "—"}</td>
                  <td className="remarks">{row.remarks || "—"}</td>
                  <td>{row.concernedPerson || "—"}</td>
                  <td>{row.caseHead || "—"}</td>
                  <td>{row.company || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
