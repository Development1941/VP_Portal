import Link from "next/link";
import { redirect } from "next/navigation";
import { setFunderAccessAction } from "@/app/finance/actions";
import { Denied, PageHeader, Stat } from "@/components/common/ui";
import { ActionForm, Submit } from "@/components/common/forms";
import { canViewEmployeeDatabase } from "@/lib/finance/access";
import { getFinanceSession } from "@/lib/finance/session";
import { employeeDirectory } from "@/lib/finance/store";
import { PortalError } from "@/lib/form";

export default async function FinanceEmployeesPage() {
  const user = await getFinanceSession();
  if (!user) redirect("/finance/login");
  if (!canViewEmployeeDatabase(user)) return <Denied title="Employee database" />;

  let data;
  try {
    data = employeeDirectory(user);
  } catch (error) {
    if (error instanceof PortalError) return <Denied title="Employee database" />;
    throw error;
  }

  const finance = data.employees.filter((person) => person.team === "Finance");
  const legal = data.employees.filter((person) => person.team === "Legal");
  const companyName = (id: string) => data.companies.find((item) => item.id === id)?.name || "—";
  const openTasks = (employeeId: string) => data.tasks.filter((task) => task.employeeId === employeeId && task.status === "open");
  const allottedCases = (employeeId: string) =>
    data.cases.filter((item) => item.allottedEmployeeIds.includes(employeeId) || item.legalAssigneeId === employeeId);

  return (
    <>
      <PageHeader eyebrow="Administration" title="Employee database" lede="Employees by team, with allotted clients and open tasks. Admin only." />
      <section className="stats">
        <Stat label="Finance" value={String(finance.length)} />
        <Stat label="Legal" value={String(legal.length)} />
        <Stat label="Open tasks" value={String(data.tasks.filter((task) => task.status === "open").length)} />
      </section>

      {(["Finance", "Legal"] as const).map((team) => (
        <section key={team} className="card status-board">
          <div className="card-head">
            <div>
              <p className="eyebrow">{team} team</p>
              <h2>{team} employees</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Title</th>
                  <th>Allotted clients</th>
                  <th>Open tasks</th>
                  <th>Funder DB</th>
                </tr>
              </thead>
              <tbody>
                {(team === "Finance" ? finance : legal).map((person) => {
                  const cases = allottedCases(person.id);
                  const tasks = openTasks(person.id);
                  return (
                    <tr key={person.id}>
                      <td className="project-cell">{person.fullName}</td>
                      <td>{person.title}</td>
                      <td>
                        {cases.length
                          ? cases.map((item) => (
                              <div key={item.id}>
                                <Link href={`/finance/cases/${item.id}`}>{companyName(item.companyId)}</Link>
                              </div>
                            ))
                          : "—"}
                      </td>
                      <td>
                        {tasks.length
                          ? tasks.map((task) => (
                              <div key={task.id}>
                                {task.title} <span className="muted">({task.kind})</span>
                              </div>
                            ))
                          : "—"}
                      </td>
                      <td>
                        <ActionForm action={setFunderAccessAction} className="quiet-row">
                          <input type="hidden" name="employeeId" value={person.id} />
                          <input type="hidden" name="enabled" value={person.funderDbAccess ? "0" : "1"} />
                          <Submit variant="ghost">{person.funderDbAccess ? "Withdraw" : "Grant"}</Submit>
                        </ActionForm>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
