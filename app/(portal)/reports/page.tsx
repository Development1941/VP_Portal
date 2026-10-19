import { Denied, Meter, PageHeader } from "@/components/common/ui";
import { can } from "@/lib/access";
import { hoursLabel, money } from "@/lib/format";
import { projectHealth } from "@/lib/health";
import { requirePage } from "@/lib/page";
import { dues, projectEconomics } from "@/lib/reports";
import { lateTasks, openTasks } from "@/lib/tracking";

export default async function ReportsPage() {
  const { user, data, allowed } = await requirePage(["reports.project", "reports.financial"]);
  if (!allowed) return <Denied title="Reports" />;
  const financial = can(user, "reports.financial");
  const rows = data.projects.map((project) => ({ project, economics: projectEconomics(project, data) }));
  const open = financial ? dues(data) : [];

  return (
    <>
      <PageHeader
        eyebrow="Commercial"
        title={financial ? "Profitability" : "Project progress"}
        lede={financial ? "Recognized value is invoiced work plus approved billable time that has not been invoiced yet. Cost is logged hours times each person’s internal hourly cost. Completion and health come from the sprint plan." : "Hours, open work, and sprint completion for the projects you can see. Internal cost and profit stay with financial roles."}
      />
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Complete</th>
                <th className="num">Open</th>
                <th className="num">Late</th>
                <th className="num">Logged</th>
                <th className="num">Non-billable</th>
                <th className="num">Recognized</th>
                {financial ? <th className="num">Cost</th> : null}
                {financial ? <th className="num">Profit</th> : null}
                {financial ? <th className="num">Due</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ project, economics }) => {
                const milestones = data.milestones.filter((item) => item.projectId === project.id);
                const tasks = data.tasks.filter((item) => item.projectId === project.id);
                const health = projectHealth(milestones, data.timesheets.filter((entry) => entry.projectId === project.id));
                return (
                <tr key={project.id}>
                  <td>
                    <strong>{project.name}</strong>
                    <Meter value={health.completion} tone="" />
                    <span className="muted">{health.status.replaceAll("_", " ")} · budget {economics.budgetUsed}%</span>
                  </td>
                  <td>{milestones.length ? `${health.completion}%` : "No sprints"}</td>
                  <td className="num">{openTasks(tasks).length}</td>
                  <td className="num">{lateTasks(tasks).length}</td>
                  <td className="num">{hoursLabel(health.loggedHours)} / {hoursLabel(health.expectedHours)}</td>
                  <td className="num">{hoursLabel(economics.otherHours)}</td>
                  <td className="num">{money(economics.recognized, data.currency)}</td>
                  {financial ? <td className="num">{money(economics.cost, data.currency)}</td> : null}
                  {financial ? <td className="num">{money(economics.profit, data.currency)}</td> : null}
                  {financial ? <td className="num">{money(economics.due, data.currency)}</td> : null}
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {financial ? (
        <section className="stats">
          <article className="stat"><span>Recognized</span><b>{money(rows.reduce((sum, row) => sum + row.economics.recognized, 0), data.currency)}</b></article>
          <article className="stat"><span>Internal cost</span><b>{money(rows.reduce((sum, row) => sum + row.economics.cost, 0), data.currency)}</b></article>
          <article className="stat"><span>Profit</span><b>{money(rows.reduce((sum, row) => sum + row.economics.profit, 0), data.currency)}</b></article>
          <article className="stat"><span>Open dues</span><b>{money(open.reduce((sum, row) => sum + row.amount, 0), data.currency)}</b></article>
        </section>
      ) : null}
    </>
  );
}
