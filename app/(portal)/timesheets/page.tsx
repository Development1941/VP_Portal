import { decideTimesheetAction, deleteTimesheetAction, submitTimesheetsAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { DsrForm } from "@/components/time/dsr-form";
import { Badge, Denied, Empty, PageHeader } from "@/components/common/ui";
import { can, canApproveProject, canSeeTeamDsr } from "@/lib/access";
import { addDays, startOfWeek, todayIso } from "@/lib/dates";
import { hoursLabel, prettyDate } from "@/lib/format";
import { nameOf, projectOf, requirePage } from "@/lib/page";

function weekHref(week: string, projectId: string) {
  const params = new URLSearchParams({ week });
  if (projectId) params.set("project", projectId);
  return `?${params.toString()}`;
}

export default async function TimesheetsPage({ searchParams }: { searchParams: Promise<{ week?: string; project?: string }> }) {
  const { user, data, allowed } = await requirePage(["timesheets.submit", "timesheets.approve", "timesheets.view_all"]);
  if (!allowed) return <Denied title="DSR" />;
  const query = await searchParams;
  const entitled = data.projects;
  const selected = entitled.find((project) => project.id === query.project) ?? entitled[0];
  const weekStart = query.week || startOfWeek();
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const mine = data.timesheets.filter(
    (entry) => entry.userId === user.id && entry.projectId === selected?.id && entry.workDate >= days[0] && entry.workDate <= days[6],
  );
  const drafts = mine.filter((entry) => entry.status === "draft" || entry.status === "rejected");
  const reviewProjects = entitled.filter((project) => canSeeTeamDsr(user, project));
  const teamProject = reviewProjects.find((project) => project.id === selected?.id);
  const team = teamProject
    ? data.timesheets.filter((entry) => entry.projectId === teamProject.id && entry.userId !== user.id)
    : [];
  const queue = data.timesheets.filter((entry) => entry.status === "submitted" && data.projects.some((project) => project.id === entry.projectId && canApproveProject(user, project) && (!selected || project.id === selected.id)));
  const billable = mine.filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.hours, 0);
  const other = mine.filter((entry) => !entry.billable).reduce((sum, entry) => sum + entry.hours, 0);

  return (
    <>
      <PageHeader eyebrow="Time" title="Daily status report" lede="Pick the project you worked on, then save the day. The project manager is notified, and only that project’s owner can read the team’s DSR.">
        <a className="btn ghost" href={weekHref(addDays(weekStart, -7), selected?.id ?? "")}>
          Previous week
        </a>
        <a className="btn ghost" href={weekHref(addDays(weekStart, 7), selected?.id ?? "")}>
          Next week
        </a>
      </PageHeader>
      {entitled.length > 1 ? (
        <section className="card">
          <h2>Project</h2>
          <div className="actions">
            {entitled.map((project) => (
              <a key={project.id} className={`btn ${project.id === selected?.id ? "" : "ghost"}`} href={weekHref(weekStart, project.id)}>
                {project.name}
              </a>
            ))}
          </div>
        </section>
      ) : null}
      <section className="stats">
        <article className="stat">
          <span>{selected?.name ?? "This project"}, billable</span>
          <b>{hoursLabel(billable)}</b>
        </article>
        <article className="stat">
          <span>Non-billable</span>
          <b>{hoursLabel(other)}</b>
        </article>
      </section>
      {can(user, "timesheets.submit") ? (
        <section className="card">
          <h2>Fill DSR</h2>
          {entitled.length ? (
            <DsrForm
              projects={entitled.map((project) => ({ id: project.id, name: project.name }))}
              tasks={data.tasks.map((task) => ({ id: task.id, projectId: task.projectId, title: task.title }))}
              defaultProject={selected?.id ?? entitled[0].id}
              defaultDate={todayIso()}
            />
          ) : (
            <Empty>You are not on a project yet, so there is nowhere to file a DSR.</Empty>
          )}
        </section>
      ) : null}
      <section className="card">
        <div className="card-head">
          <h2>Your DSR{selected ? ` · ${selected.name}` : ""}</h2>
          <span className="muted">{prettyDate(days[0])} – {prettyDate(days[6])}</span>
        </div>
        <ActionForm action={submitTimesheetsAction}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Date</th>
                  <th>Project</th>
                  <th>Note</th>
                  <th>Type</th>
                  <th className="num">Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.status === "draft" || entry.status === "rejected" ? <input type="checkbox" name="id" value={entry.id} aria-label="Include in submission" /> : null}</td>
                    <td>{prettyDate(entry.workDate)}</td>
                    <td>{projectOf(data, entry.projectId)?.name}</td>
                    <td>
                      {entry.description}
                      {entry.rejectionNote ? <div className="muted">Returned: {entry.rejectionNote}</div> : null}
                    </td>
                    <td>{entry.billable ? "Billable" : "Non-billable"}</td>
                    <td className="num">{hoursLabel(entry.hours)}</td>
                    <td><Badge value={entry.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!mine.length ? <Empty>No DSR for this project in this week yet.</Empty> : null}
          {drafts.length ? <Submit>Submit selected drafts</Submit> : null}
        </ActionForm>
        {drafts.length ? (
          <div className="list">
            {drafts.map((entry) => (
              <ActionForm key={entry.id} action={deleteTimesheetAction} className="quiet-row">
                <span>
                  {prettyDate(entry.workDate)} · {projectOf(data, entry.projectId)?.name} · {hoursLabel(entry.hours)}
                </span>
                <input type="hidden" name="id" value={entry.id} />
                <Submit variant="danger small">Remove</Submit>
              </ActionForm>
            ))}
          </div>
        ) : null}
      </section>
      {teamProject ? (
        <section className="card">
          <h2>Team DSR · {teamProject.name}</h2>
          <p className="muted">These are the daily reports filed on this project. Another project’s owner does not see them.</p>
          {!team.length ? <Empty>No one else has filed a DSR on this project yet.</Empty> : null}
          <div className="list">
            {team.map((entry) => (
              <div key={entry.id} className="quiet-row">
                <div>
                  <strong>{nameOf(data, entry.userId)}</strong>
                  <div className="muted">
                    {prettyDate(entry.workDate)} · {hoursLabel(entry.hours)} · {entry.billable ? "Billable" : "Non-billable"}
                    {entry.description ? ` · ${entry.description}` : ""}
                  </div>
                </div>
                <Badge value={entry.status} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {can(user, "timesheets.approve") && selected && canApproveProject(user, selected) ? (
        <section className="card">
          <h2>Approval queue · {selected.name}</h2>
          {!queue.length ? <Empty>No submitted DSR is waiting on this project.</Empty> : null}
          <div className="list">
            {queue.map((entry) => (
              <div key={entry.id} className="quiet-row">
                <div>
                  <strong>
                    {nameOf(data, entry.userId)} · {hoursLabel(entry.hours)}
                  </strong>
                  <div className="muted">
                    {prettyDate(entry.workDate)} · {entry.billable ? "Billable" : "Non-billable"}
                    {entry.description ? ` · ${entry.description}` : ""}
                  </div>
                </div>
                <div className="actions">
                  <ActionForm action={decideTimesheetAction}>
                    <input type="hidden" name="id" value={entry.id} />
                    <input type="hidden" name="status" value="approved" />
                    <Submit variant="small">Approve</Submit>
                  </ActionForm>
                  <ActionForm action={decideTimesheetAction} className="actions">
                    <input type="hidden" name="id" value={entry.id} />
                    <input type="hidden" name="status" value="rejected" />
                    <input name="note" placeholder="Note if you return it" />
                    <Submit variant="ghost small">Return</Submit>
                  </ActionForm>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
