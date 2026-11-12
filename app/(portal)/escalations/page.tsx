import Link from "next/link";
import { raiseEscalationAction, setEscalationStatusAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { Badge, Denied, PageHeader, Stat } from "@/components/common/ui";
import { todayIso } from "@/lib/dates";
import { ESCALATION_STATUSES, ESCALATION_TYPES } from "@/lib/delivery";
import { prettyDate } from "@/lib/format";
import { nameOf, projectOf, requireTab } from "@/lib/page";
import type { Escalation, Workspace } from "@/lib/types";

function resolvedOn(item: Escalation) {
  return (item.resolvedAt || item.updatedAt || item.createdAt).slice(0, 10);
}

function personName(data: Workspace, id: string | undefined) {
  if (!id) return "—";
  if (id === "system") return "System";
  return data.users.find((person) => person.id === id)?.fullName || "—";
}

export default async function EscalationsPage() {
  const { data, allowed } = await requireTab("escalations");
  if (!allowed) return <Denied title="Escalation management" />;
  const today = todayIso();
  const pending = data.escalations.filter((item) => item.status !== "resolved").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const done = data.escalations.filter((item) => item.status === "resolved").sort((a, b) => resolvedOn(b).localeCompare(resolvedOn(a)));
  const blockers = data.escalations.filter((item) => item.type === "blocker").length;
  const overdue = pending.filter((item) => item.dueDate && item.dueDate < today).length;
  const numbers = new Map([...data.escalations].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((item, index) => [item.id, `E-${101 + index}`]));
  const projectNames = [...new Set([...data.projects.map((project) => project.name), ...data.statusUpdates.map((row) => row.project), ...data.hourlyEntries.map((row) => row.project)].map((name) => name.trim()).filter(Boolean))].sort();
  const projectName = (item: Escalation) => item.projectName || projectOf(data, item.projectId)?.name || "Project";

  return (
    <>
      <PageHeader eyebrow="Operations" title="Escalation management" />
      <div className="stats">
        <Stat label="Total raised" value={String(data.escalations.length)} />
        <Stat label="Open" value={String(pending.length)} note={overdue ? `${overdue} past target date` : undefined} />
        <Stat label="Blockers" value={String(blockers)} />
        <Stat label="Resolved" value={String(done.length)} href="#resolved" />
      </div>
      <section className="card" id="resolution">
        <div className="card-head">
          <h2>Escalation resolution</h2>
          <span className="muted">Open escalations. Add a resolution note and click Resolve to move it to Resolved escalations.</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Project</th><th>Type</th><th>Description</th><th>Source</th><th>Owner, target date, status, and resolution</th></tr>
            </thead>
            <tbody>
              {pending.map((item) => (
                <tr key={item.id}>
                  <td>{numbers.get(item.id)}</td>
                  <td>{projectName(item)}</td>
                  <td><Badge value={item.type} /></td>
                  <td className="remarks">
                    {item.description}
                    <div className="muted">
                      Raised {prettyDate(item.createdAt.slice(0, 10))} by {item.createdBy === "system" ? "System" : nameOf(data, item.createdBy)}
                      {item.dueDate && item.dueDate < today ? " · past target date" : ""}
                    </div>
                  </td>
                  <td>{item.sourceEntryId ? <Link href="/delivery">Task management</Link> : "Raised here"}</td>
                  <td>
                    <ActionForm action={setEscalationStatusAction} className="escalation-form">
                      <input type="hidden" name="id" value={item.id} />
                      <label className="field">
                        <span>Owner</span>
                        <input name="ownerName" defaultValue={item.ownerName} />
                      </label>
                      <label className="field">
                        <span>Target date</span>
                        <input type="date" name="dueDate" defaultValue={item.dueDate} />
                      </label>
                      <label className="field">
                        <span>Status</span>
                        <select name="status" defaultValue={item.status}>
                          {ESCALATION_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <label className="field">
                        <span>Resolution note</span>
                        <textarea name="resolutionNote" rows={1} defaultValue={item.resolutionNote ?? ""} placeholder="Required to resolve" />
                      </label>
                      <div className="sheet-actions">
                        <button type="submit" className="btn" name="intent" value="resolve">Resolve</button>
                        <Submit variant="ghost">Save</Submit>
                      </div>
                    </ActionForm>
                  </td>
                </tr>
              ))}
              {pending.length === 0 ? <tr><td colSpan={6}>No open escalations.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card" id="raise">
        <h2>Raise blocker or concern</h2>
        <ActionForm action={raiseEscalationAction} className="form-grid">
          <label className="field">
            <span>Project</span>
            <input name="projectName" list="escalation-projects" required placeholder="Project name" />
            <datalist id="escalation-projects">
              {projectNames.map((name) => <option key={name} value={name} />)}
            </datalist>
          </label>
          <label className="field">
            <span>Type</span>
            <select name="type" defaultValue="blocker">
              {ESCALATION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field"><span>Action owner</span><input name="ownerName" placeholder="Defaults to you" /></label>
          <label className="field"><span>Target completion date</span><input type="date" name="dueDate" /></label>
          <label className="field wide"><span>Describe the issue and support needed</span><textarea name="description" required /></label>
          <Submit>Raise item</Submit>
        </ActionForm>
      </section>
      <section className="card" id="resolved">
        <div className="card-head">
          <h2>Resolved escalations</h2>
          <span className="muted">{done.length} resolved, newest first</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Resolved on</th><th>Project</th><th>Type</th><th>Description</th><th>Resolution</th><th>Owner</th><th>Resolved by</th></tr>
            </thead>
            <tbody>
              {done.map((item) => (
                <tr key={item.id}>
                  <td>{numbers.get(item.id)}</td>
                  <td>{prettyDate(resolvedOn(item))}</td>
                  <td>{projectName(item)}</td>
                  <td><Badge value={item.type} /></td>
                  <td className="remarks">
                    {item.description}
                    <div className="muted">Raised {prettyDate(item.createdAt.slice(0, 10))}</div>
                  </td>
                  <td className="remarks">{item.resolutionNote || "—"}</td>
                  <td>{item.ownerName || "—"}</td>
                  <td>{personName(data, item.resolvedBy || item.updatedBy)}</td>
                </tr>
              ))}
              {done.length === 0 ? <tr><td colSpan={8}>Nothing has been resolved yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
