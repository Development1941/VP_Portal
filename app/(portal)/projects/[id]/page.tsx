import Link from "next/link";
import { removeMemberAction, saveFeatureAction, saveMemberAction, saveMilestoneAction, saveProjectAction, saveProjectNoteAction, saveTaskAction, taskStatusAction, uploadSprintsAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { Badge, Empty, Meter, PageHeader, Stat } from "@/components/common/ui";
import { can, canEditTask, canManageProject, canSeeMilestones, canSeeTeamDsr, canUploadMilestones, projectVisible } from "@/lib/access";
import { showCommercials } from "@/lib/commercial";
import { db } from "@/lib/data";
import { hoursLabel, money, prettyDate, prettyStamp } from "@/lib/format";
import { projectHealth } from "@/lib/health";
import { clientOf, nameOf, requirePage } from "@/lib/page";
import { canSeeLeadershipSections } from "@/lib/tab-access";
import { projectEconomics } from "@/lib/reports";
import { isOverdue, lateMilestones, lateTasks, loggedHours, openTasks } from "@/lib/tracking";
import type { Task } from "@/lib/types";

const TASK_STATES: Task["status"][] = ["backlog", "in_progress", "review", "done"];

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, data, allowed } = await requirePage(["projects.view", "projects.view_all"]);
  if (!allowed || !canSeeLeadershipSections(user)) return <PageHeader eyebrow="Project" title="You do not have access to this project." />;
  const project = data.projects.find((item) => item.id === id);
  if (!project) return <PageHeader eyebrow="Project" title="Project not found." />;
  const manage = canManageProject(user, project);
  const seeSprints = canSeeMilestones(user, project, data.members);
  const uploadSprints = canUploadMilestones(user, project, data.members);
  const economics = projectEconomics(project, data);
  const client = clientOf(data, project.clientId);
  const members = data.members.filter((member) => member.projectId === project.id);
  const milestones = data.milestones.filter((item) => item.projectId === project.id);
  const features = data.features.filter((item) => item.projectId === project.id);
  const tasks = data.tasks.filter((item) => item.projectId === project.id);
  const projectTime = data.timesheets.filter((entry) => entry.projectId === project.id);
  const visibleTime = projectTime
    .filter((entry) => entry.userId === user.id || canSeeTeamDsr(user, project))
    .sort((left, right) => right.workDate.localeCompare(left.workDate) || right.id.localeCompare(left.id));
  const health = projectHealth(milestones, projectTime);
  const waiting = openTasks(tasks);
  const overdueTasks = lateTasks(tasks);
  const overdueSprints = lateMilestones(milestones);
  const log = projectVisible(user, project, data.members) ? await db().projectLog(user, project.id) : [];

  return (
    <>
      <PageHeader eyebrow={project.code || "Project"} title={project.name} lede={project.description}>
        <Badge value={project.status} />
        <Link className="btn ghost" href="/projects">
          All projects
        </Link>
      </PageHeader>
      <section className="stats">
        <article className="stat">
          <span>Client</span>
          <b style={{ fontSize: "1.3rem" }}>{client?.company || "—"}</b>
          <em>Owner {nameOf(data, project.ownerId)}</em>
        </article>
        {showCommercials ? (
          <article className="stat">
            <span>Budget</span>
            <b>{money(project.budgetAmount, data.currency)}</b>
            <em>{economics.budgetUsed}% recognized</em>
          </article>
        ) : null}
        <article className="stat">
          <span>Billable / other</span>
          <b>{hoursLabel(economics.billableHours)}</b>
          <em>{hoursLabel(economics.otherHours)} non-billable</em>
        </article>
        <article className="stat">
          <span>Schedule</span>
          <b style={{ fontSize: "1.2rem" }}>{prettyDate(project.endDate)}</b>
          <em>{showCommercials ? `${project.billingModel} · ` : ""}from {prettyDate(project.startDate)}</em>
        </article>
      </section>
      {showCommercials ? <Meter value={economics.budgetUsed} /> : null}
      <section className="card">
        <h2>Tracking register</h2>
        <div className="stats">
          <Stat label="Open tasks" value={String(waiting.length)} note={overdueTasks.length ? `${overdueTasks.length} overdue` : "Nothing is late"} />
          <Stat label="Sprint completion" value={seeSprints ? `${health.completion}%` : "—"} note={seeSprints ? `${hoursLabel(health.loggedHours)} of ${hoursLabel(health.expectedHours)}` : "Sprints stay with the owner"} />
          <Stat label="Overdue sprints" value={seeSprints ? String(overdueSprints.length) : "—"} note={seeSprints && health.status !== "unplanned" ? health.status.replaceAll("_", " ") : "Plan the hours to score health"} />
          <Stat label="DSR on file" value={String(visibleTime.length)} note={`${visibleTime.filter((entry) => entry.status === "approved").length} approved`} />
        </div>
      </section>
      {manage && can(user, "projects.manage") ? (
        <section className="card">
          <h2>Project settings</h2>
          <ActionForm action={saveProjectAction} className="form-grid">
            <input type="hidden" name="id" value={project.id} />
            <label className="field"><span>Name</span><input name="name" defaultValue={project.name} required /></label>
            <label className="field"><span>Code</span><input name="code" defaultValue={project.code} /></label>
            <label className="field">
              <span>Client</span>
              <select name="clientId" defaultValue={project.clientId}>
                {data.clients.map((item) => <option key={item.id} value={item.id}>{item.company}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Owner</span>
              <select name="ownerId" defaultValue={project.ownerId}>
                {data.users.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue={project.status}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On hold</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            {showCommercials ? (
              <label className="field">
                <span>Billing model</span>
                <select name="billingModel" defaultValue={project.billingModel}>
                  <option value="hourly">Hourly</option>
                  <option value="fixed">Fixed</option>
                  <option value="retainer">Retainer</option>
                </select>
              </label>
            ) : <input type="hidden" name="billingModel" value={project.billingModel} />}
            <label className="field"><span>Start</span><input type="date" name="startDate" defaultValue={project.startDate} /></label>
            <label className="field"><span>End</span><input type="date" name="endDate" defaultValue={project.endDate} /></label>
            {showCommercials ? (
              <>
                <label className="field"><span>Budget</span><input type="number" name="budgetAmount" defaultValue={project.budgetAmount} /></label>
                <label className="field"><span>Currency</span><input name="currency" defaultValue={data.currency} readOnly /></label>
              </>
            ) : (
              <>
                <input type="hidden" name="budgetAmount" value={project.budgetAmount} />
                <input type="hidden" name="currency" value={data.currency} />
              </>
            )}
            <label className="field wide"><span>Description</span><textarea name="description" defaultValue={project.description} /></label>
            <Submit>Save project</Submit>
          </ActionForm>
        </section>
      ) : null}
      <div className="split">
        <section className="card">
          <h2>{showCommercials ? "Team and bill rates" : "Team"}</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Person</th><th>Role on project</th>{showCommercials ? <th className="num">Bill rate</th> : null}<th></th></tr></thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.userId}>
                    <td>{nameOf(data, member.userId)}</td>
                    <td>{member.memberRole}</td>
                    {showCommercials ? <td className="num">{member.billRate ? money(member.billRate, data.currency) : "—"}</td> : null}
                    <td>
                      {manage && member.userId !== project.ownerId ? (
                        <ActionForm action={removeMemberAction}>
                          <input type="hidden" name="projectId" value={project.id} />
                          <input type="hidden" name="userId" value={member.userId} />
                          <Submit variant="danger small">Remove</Submit>
                        </ActionForm>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {manage ? (
            <ActionForm action={saveMemberAction} className="form-grid">
              <input type="hidden" name="projectId" value={project.id} />
              <label className="field">
                <span>Person</span>
                <select name="userId" defaultValue="">
                  <option value="">Choose</option>
                  {data.users.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
                </select>
              </label>
              <label className="field"><span>Role on project</span><input name="memberRole" placeholder="Developer" /></label>
              {showCommercials ? <label className="field"><span>Bill rate / hour</span><input type="number" name="billRate" min="0" defaultValue="0" /></label> : <input type="hidden" name="billRate" value="0" />}
              <div className="actions"><Submit>Add or update</Submit></div>
            </ActionForm>
          ) : null}
        </section>
        {seeSprints ? (
        <section className="card">
          <h2>Sprints and milestones</h2>
          {(() => {
            const health = projectHealth(milestones, data.timesheets.filter((entry) => entry.projectId === project.id));
            return (
              <div className="stats">
                <Stat label="Completion" value={`${health.completion}%`} note="Finished sprints" />
                <Stat label="Health" value={health.status === "at_risk" ? "At risk" : health.status === "unplanned" ? "Unplanned" : health.status === "watch" ? "Watch" : "Healthy"} note="Logged hours against the sprint plan" />
                <Stat label="Expected" value={hoursLabel(health.expectedHours)} note="Allocated on sprints" />
                <Stat label="Logged" value={hoursLabel(health.loggedHours)} note="DSR hours on this project" />
              </div>
            );
          })()}
          <div className="list">
            {milestones.map((item) => (
              <div key={item.id} className="quiet-row">
                <div>
                  <strong>{item.name}</strong>
                  <div className="muted">
                    {item.plannedHours > 0 ? hoursLabel(item.plannedHours) : "No hours allocated"}
                    {item.dueDate ? ` · ${prettyDate(item.dueDate)}` : ""}
                    {showCommercials && item.amount ? ` · ${money(item.amount, data.currency)}` : ""}
                    {item.description ? ` · ${item.description}` : ""}
                  </div>
                </div>
                <Badge value={item.status} />
                {uploadSprints ? (
                  <ActionForm action={saveMilestoneAction} className="actions">
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="name" value={item.name} />
                    <input type="hidden" name="dueDate" value={item.dueDate} />
                    <input type="hidden" name="amount" value={item.amount} />
                    <input type="hidden" name="description" value={item.description} />
                    <label className="field">
                      <span>Status</span>
                      <select name="status" defaultValue={item.status}>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In progress</option>
                        <option value="completed">Completed</option>
                        <option value="missed">Missed</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Hours</span>
                      <input type="number" name="plannedHours" min="0.5" step="0.5" defaultValue={item.plannedHours || ""} required />
                    </label>
                    <Submit variant="small ghost">Save sprint</Submit>
                  </ActionForm>
                ) : null}
              </div>
            ))}
            {!milestones.length ? <Empty>No sprints or milestones yet.</Empty> : null}
          </div>
          {uploadSprints ? (
            <>
            <ActionForm action={saveMilestoneAction} className="form-grid">
              <input type="hidden" name="projectId" value={project.id} />
              <label className="field"><span>Name</span><input name="name" required /></label>
              <label className="field"><span>Due</span><input type="date" name="dueDate" /></label>
              <label className="field"><span>Allocated hours</span><input type="number" name="plannedHours" min="0.5" step="0.5" required /></label>
              <label className="field">
                <span>Status</span>
                <select name="status" defaultValue="pending">
                  <option value="pending">Pending</option>
                  <option value="in_progress">In progress</option>
                  <option value="completed">Completed</option>
                  <option value="missed">Missed</option>
                </select>
              </label>
              <label className="field"><span>Amount</span><input type="number" name="amount" defaultValue="0" /></label>
              <label className="field wide"><span>Description</span><input name="description" /></label>
              <Submit>Add milestone</Submit>
            </ActionForm>
            <ActionForm action={uploadSprintsAction} className="form-grid">
              <input type="hidden" name="projectId" value={project.id} />
              <label className="field wide">
                <span>Upload every sprint</span>
                <textarea name="sheet" rows={5} placeholder={"Sprint 1, 2026-11-01, 40, Planning\nSprint 2, 2026-11-15, 80, Build"} />
              </label>
              <label className="field wide">
                <span>Or a CSV file</span>
                <input type="file" name="file" accept=".csv,.txt,text/csv,text/plain" />
              </label>
              <p className="muted">One sprint per line: name, YYYY-MM-DD, allocated hours, note.</p>
              <Submit>Upload sprints</Submit>
            </ActionForm>
            </>
          ) : null}
        </section>
        ) : null}
      </div>
      <section className="card">
        <h2>{showCommercials ? "Feature billing cards" : "Features"}</h2>
        <div className="cards">
          {features.map((feature) => {
            const logged = data.timesheets.filter((entry) => entry.featureId === feature.id).reduce((sum, entry) => sum + entry.hours, 0);
            const progress = feature.budgetHours > 0 ? Math.round((logged / feature.budgetHours) * 100) : 0;
            return (
              <article key={feature.id} className="feature">
                <div className="card-head"><h3>{feature.name}</h3><Badge value={feature.status} /></div>
                <p className="muted">{feature.description}</p>
                <Meter value={progress} />
                <p>{hoursLabel(logged)} of {hoursLabel(feature.budgetHours)} budgeted</p>
                {showCommercials ? <strong>{feature.billingType === "fixed" ? money(feature.fixedAmount, data.currency) : `${money(feature.hourlyRate, data.currency)} / hour`}</strong> : null}
              </article>
            );
          })}
        </div>
        {manage ? (
          <ActionForm action={saveFeatureAction} className="form-grid">
            <input type="hidden" name="projectId" value={project.id} />
            <label className="field"><span>Feature</span><input name="name" required /></label>
            {showCommercials ? (
              <>
                <label className="field">
                  <span>Billing</span>
                  <select name="billingType" defaultValue="hourly">
                    <option value="hourly">Hourly</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </label>
                <label className="field"><span>Hourly rate</span><input type="number" name="hourlyRate" defaultValue="0" /></label>
                <label className="field"><span>Fixed amount</span><input type="number" name="fixedAmount" defaultValue="0" /></label>
              </>
            ) : (
              <>
                <input type="hidden" name="billingType" value="hourly" />
                <input type="hidden" name="hourlyRate" value="0" />
                <input type="hidden" name="fixedAmount" value="0" />
              </>
            )}
            <label className="field"><span>Budget hours</span><input type="number" name="budgetHours" defaultValue="0" /></label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue="planned">
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="done">Done</option>
              </select>
            </label>
            <label className="field wide"><span>Description</span><input name="description" /></label>
            <Submit>Add feature card</Submit>
          </ActionForm>
        ) : null}
      </section>
      <section className="card">
        <h2>Tasks</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Task</th><th>Assignee</th><th>Due</th><th>Estimate</th><th>Logged</th><th>Priority</th><th>Status</th></tr></thead>
            <tbody>
              {tasks.map((task) => {
                const late = isOverdue(task.dueDate, task.status === "done");
                return (
                <tr key={task.id}>
                  <td><strong>{task.title}</strong><div className="muted">{task.description}</div></td>
                  <td>{nameOf(data, task.assigneeId)}</td>
                  <td>{prettyDate(task.dueDate)}{late ? " · overdue" : ""}</td>
                  <td>{hoursLabel(task.estimatedHours)}</td>
                  <td>{hoursLabel(loggedHours(projectTime, task.id))}</td>
                  <td><Badge value={task.priority} /></td>
                  <td>
                    {canEditTask(user, task, project) ? (
                      <ActionForm action={taskStatusAction} className="actions">
                        <input type="hidden" name="id" value={task.id} />
                        <select name="status" defaultValue={task.status} aria-label={`Status for ${task.title}`}>
                          {TASK_STATES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                        </select>
                        <Submit variant="small">Update</Submit>
                      </ActionForm>
                    ) : <Badge value={task.status} />}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
        {!tasks.length ? <Empty>No tasks allocated yet.</Empty> : null}
        {manage && can(user, "tasks.manage") ? (
          <ActionForm action={saveTaskAction} className="form-grid">
            <input type="hidden" name="projectId" value={project.id} />
            <label className="field wide"><span>Title</span><input name="title" required /></label>
            <label className="field">
              <span>Assignee</span>
              <select name="assigneeId" defaultValue="">
                <option value="">Unassigned</option>
                {members.map((member) => <option key={member.userId} value={member.userId}>{nameOf(data, member.userId)}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Milestone</span>
              <select name="milestoneId" defaultValue="">
                <option value="">None</option>
                {milestones.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Feature</span>
              <select name="featureId" defaultValue="">
                <option value="">None</option>
                {features.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Due</span><input type="date" name="dueDate" /></label>
            <label className="field">
              <span>Priority</span>
              <select name="priority" defaultValue="medium">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select name="status" defaultValue="backlog">
                {TASK_STATES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <label className="field"><span>Estimate (hours)</span><input type="number" name="estimatedHours" defaultValue="0" /></label>
            <label className="field wide"><span>Description</span><input name="description" /></label>
            <Submit>Allocate task</Submit>
          </ActionForm>
        ) : null}
      </section>
      <section className="card">
        <h2>Daily record</h2>
        <p className="muted">Approved and draft daily status reports for this project.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Person</th><th>Hours</th><th>Record</th><th>Status</th></tr></thead>
            <tbody>
              {visibleTime.slice(0, 20).map((entry) => (
                <tr key={entry.id}>
                  <td>{prettyDate(entry.workDate)}</td>
                  <td>{nameOf(data, entry.userId)}</td>
                  <td>{hoursLabel(entry.hours)}{entry.billable ? "" : " · non-billable"}</td>
                  <td>{entry.description}</td>
                  <td><Badge value={entry.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visibleTime.length ? <Empty>No daily record on this project yet.</Empty> : null}
      </section>
      <section className="card">
        <h2>Change record</h2>
        <p className="muted">Notes and recorded changes for this project.</p>
        <ActionForm action={saveProjectNoteAction} className="form-grid">
          <input type="hidden" name="projectId" value={project.id} />
          <label className="field wide">
            <span>Add a record</span>
            <textarea name="note" rows={3} required placeholder="Change, decision, and effective date" />
          </label>
          <Submit>Save record</Submit>
        </ActionForm>
        <div className="list">
          {log.map((entry) => (
            <div key={entry.id} className="quiet-row">
              <div>
                <strong>{entry.action === "project.note" ? "Note" : entry.action.replaceAll(".", " ")}</strong>
                <div>{entry.summary}</div>
                <div className="muted">{nameOf(data, entry.actorId)} · {prettyStamp(entry.createdAt)}</div>
              </div>
            </div>
          ))}
          {!log.length ? <Empty>No changes recorded yet.</Empty> : null}
        </div>
      </section>
    </>
  );
}
