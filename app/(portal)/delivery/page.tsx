import Link from "next/link";
import { addDeliveryTaskAction, raiseEscalationAction, saveDeliverySheetAction } from "@/app/actions";
import { PrintButton, ActionForm, Submit } from "@/components/common/forms";
import { Badge, Denied, PageHeader } from "@/components/common/ui";
import { canEditDelivery } from "@/lib/access";
import { ESCALATION_TYPES, handoverSections, hoursConsumed } from "@/lib/delivery";
import { prettyDate } from "@/lib/format";
import { clientOf, nameOf, requirePage } from "@/lib/page";

export default async function DeliveryPage({ searchParams }: { searchParams: Promise<{ project?: string; pack?: string }> }) {
  const query = await searchParams;
  const { user, data, allowed } = await requirePage(["tasks.view", "tasks.manage", "projects.view", "projects.view_all"]);
  if (!allowed) return <Denied title="Project tasks" />;
  const active = data.projects.filter((project) => project.activated);
  const selected = active.find((project) => project.id === query.project) ?? active[0];
  const tasks = selected ? data.tasks.filter((task) => task.projectId === selected.id) : [];
  const editable = selected ? canEditDelivery(user, selected) : false;
  const people = data.users.filter((person) => person.status !== "inactive");
  const showPack = query.pack === "1" && selected;
  const sections = selected
    ? handoverSections(
        selected,
        tasks,
        tasks.map((task) => `${nameOf(data, task.assigneeId)}: ${task.title}`),
        clientOf(data, selected.clientId)?.company || "Client",
        nameOf(data, selected.deliveryOwnerId || selected.ownerId),
        hoursConsumed(selected.id, data.timesheets, data.tasks),
      )
    : [];

  return (
    <>
      <PageHeader eyebrow="Delivery control" title="Project tasks" lede="All active projects in one place. Project owners create and edit tasks; resources view them." />
      {active.length === 0 ? (
        <section className="card"><p>No project is active yet. Finalise a SOW, then activate it from resource allocation.</p></section>
      ) : selected ? (
        <div className="task-layout">
          <div className="plist">
            {active.map((project) => (
              <Link key={project.id} href={`/delivery?project=${project.id}`} className={project.id === selected.id ? "on" : ""}>
                <b>{project.name}</b>
                <span>{clientOf(data, project.clientId)?.company}</span>
                <Badge value={project.deliveryStatus} />
              </Link>
            ))}
          </div>
          <div>
            <section className="card task-head">
              <div>
                <h2>{selected.name}</h2>
                <p className="muted">Owner {nameOf(data, selected.ownerId)}</p>
              </div>
              <div className="actions">
                <a href="#raise">Raise blocker or concern</a>
                <Link href={`/delivery?project=${selected.id}&pack=1`}>Generate document and sheet</Link>
              </div>
            </section>
            <section className="card">
              <ActionForm action={saveDeliverySheetAction}>
                <input type="hidden" name="projectId" value={selected.id} />
                <div className="table-wrap">
                  <table className="sheet-table">
                    <thead>
                      <tr><th>Task</th><th>Resource</th><th>Start</th><th>End</th><th>Est. hrs</th><th>Actual hrs</th></tr>
                    </thead>
                    <tbody>
                      {tasks.map((task) => (
                        <tr key={task.id}>
                          <td>
                            <input type="hidden" name="taskId" value={task.id} />
                            <input name={`title:${task.id}`} defaultValue={task.title} disabled={!editable} />
                          </td>
                          <td>
                            <select name={`assignee:${task.id}`} defaultValue={task.assigneeId} disabled={!editable}>
                              <option value="">Unassigned</option>
                              {people.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
                            </select>
                          </td>
                          <td><input type="date" name={`start:${task.id}`} defaultValue={task.startDate} disabled={!editable} /></td>
                          <td><input type="date" name={`end:${task.id}`} defaultValue={task.dueDate} disabled={!editable} /></td>
                          <td><input type="number" name={`est:${task.id}`} min="0" step="0.5" defaultValue={task.estimatedHours} disabled={!editable} /></td>
                          <td><input type="number" name={`act:${task.id}`} min="0" step="0.5" defaultValue={task.actualHours} disabled={!editable} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {editable ? <Submit>Save tasks</Submit> : <p className="muted">Read only. Only the project owner can create or edit tasks.</p>}
              </ActionForm>
              {editable ? (
                <ActionForm action={addDeliveryTaskAction} className="form-grid">
                  <input type="hidden" name="projectId" value={selected.id} />
                  <label className="field"><span>New task</span><input name="title" placeholder="New task" required /></label>
                  <label className="field">
                    <span>Resource</span>
                    <select name="assigneeId" defaultValue="">
                      <option value="">Unassigned</option>
                      {people.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
                    </select>
                  </label>
                  <label className="field"><span>Start</span><input type="date" name="startDate" /></label>
                  <label className="field"><span>End</span><input type="date" name="dueDate" /></label>
                  <label className="field"><span>Est. hrs</span><input type="number" name="estimatedHours" min="0" step="0.5" defaultValue="0" /></label>
                  <label className="field"><span>Actual hrs</span><input type="number" name="actualHours" min="0" step="0.5" defaultValue="0" /></label>
                  <Submit variant="ghost">Add task</Submit>
                </ActionForm>
              ) : null}
            </section>
            <section className="card" id="raise">
              <h2>Raise item for {selected.name}</h2>
              <ActionForm action={raiseEscalationAction} className="form-grid">
                <input type="hidden" name="projectId" value={selected.id} />
                <label className="field">
                  <span>Type</span>
                  <select name="type" defaultValue="blocker">
                    {ESCALATION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="field"><span>Action owner</span><input name="ownerName" placeholder={nameOf(data, selected.ownerId)} /></label>
                <label className="field"><span>Target completion date</span><input type="date" name="dueDate" /></label>
                <label className="field wide"><span>Describe the issue and support needed</span><textarea name="description" required /></label>
                <Submit>Raise item</Submit>
              </ActionForm>
            </section>
            {showPack ? (
              <section className="card">
                <div className="card-head">
                  <h2>Generated handover pack</h2>
                  <PrintButton />
                </div>
                <p className="muted">Preview of the document and the tracking sheet.</p>
                {sections.map(([title, body]) => (
                  <div key={title}>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                ))}
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Task</th><th>Resource</th><th>Start</th><th>End</th><th>Est</th><th>Actual</th></tr></thead>
                    <tbody>
                      {tasks.map((task) => (
                        <tr key={task.id}>
                          <td>{task.title}</td>
                          <td>{nameOf(data, task.assigneeId)}</td>
                          <td>{prettyDate(task.startDate)}</td>
                          <td>{prettyDate(task.dueDate)}</td>
                          <td>{task.estimatedHours}</td>
                          <td>{task.actualHours}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
