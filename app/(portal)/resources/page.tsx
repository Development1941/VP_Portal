import Link from "next/link";
import { activateProjectAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { Badge, Denied, Meter, PageHeader } from "@/components/common/ui";
import { canEditDelivery } from "@/lib/access";
import { addDays, startOfWeek } from "@/lib/dates";
import { hoursLabel } from "@/lib/format";
import { nameOf, requirePage } from "@/lib/page";

export default async function ResourcesPage() {
  const { user, data, allowed } = await requirePage(["projects.view", "projects.view_all", "tasks.view", "tasks.manage"]);
  if (!allowed) return <Denied title="Resource allocation" />;
  const ready = data.projects.filter((project) => project.sowStage === "finalised");
  const week = startOfWeek();
  const pool = data.users.filter((person) => person.status === "active");

  return (
    <>
      <PageHeader eyebrow="Delivery control" title="Resource allocation" lede="Only finalised SOWs appear here. Activate a project to open its task page." />
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Project</th><th>Project owner</th><th>Budget hrs</th><th>Allocated</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {ready.map((project) => {
                const allocated = data.tasks.filter((task) => task.projectId === project.id).reduce((sum, task) => sum + task.estimatedHours, 0);
                const width = project.estimatedHours > 0 ? Math.min(100, Math.round((allocated / project.estimatedHours) * 100)) : 0;
                return (
                  <tr key={project.id}>
                    <td><b>{project.name}</b></td>
                    <td>{nameOf(data, project.ownerId)}</td>
                    <td>{hoursLabel(project.estimatedHours)}</td>
                    <td>
                      <Meter value={width} />
                      {hoursLabel(allocated)}
                    </td>
                    <td><Badge value={project.activated ? project.deliveryStatus : "pending"} /></td>
                    <td>
                      {project.activated ? (
                        <Link href={`/delivery?project=${project.id}`}>Open tasks</Link>
                      ) : canEditDelivery(user, project) || user.permissions.includes("tasks.manage") ? (
                        <ActionForm action={activateProjectAction} className="inline-form">
                          <input type="hidden" name="projectId" value={project.id} />
                          <Submit>Activate</Submit>
                        </ActionForm>
                      ) : (
                        <span className="muted">Waiting for activation</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {ready.length === 0 ? (
                <tr><td colSpan={6}>No finalised SOW yet. Finalise one from SOW admin.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2>Resource pool</h2>
        <p className="muted">Capacity is 40 hours for the week of {week}.</p>
        <div className="cards">
          {pool.map((person) => {
            const weekEnd = addDays(week, 6);
            const logged = data.timesheets.filter((entry) => entry.userId === person.id && entry.workDate >= week && entry.workDate <= weekEnd).reduce((sum, entry) => sum + entry.hours, 0);
            return (
              <article key={person.id} className="feature">
                <h3>{person.fullName}</h3>
                <p className="muted">{person.title || person.roleName}</p>
                <p>Capacity 40 h/week · logged {hoursLabel(logged)}</p>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
