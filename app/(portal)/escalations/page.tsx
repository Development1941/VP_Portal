import Link from "next/link";
import { raiseEscalationAction, saveWorkstreamAction, setEscalationStatusAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { Badge, Denied, PageHeader, Stat } from "@/components/common/ui";
import { ESCALATION_STATUSES, ESCALATION_TYPES } from "@/lib/delivery";
import { prettyDate } from "@/lib/format";
import { nameOf, projectOf, requireTab } from "@/lib/page";

export default async function EscalationsPage() {
  const { data, allowed } = await requireTab("escalations");
  if (!allowed) return <Denied title="Escalations and blockers" />;
  const open = data.escalations.filter((item) => item.status !== "resolved").length;
  const blockers = data.escalations.filter((item) => item.type === "blocker").length;
  const resolved = data.escalations.filter((item) => item.status === "resolved").length;
  const ordered = [...data.escalations].sort((a, b) => Number(a.status === "resolved") - Number(b.status === "resolved") || b.createdAt.localeCompare(a.createdAt));
  const numbers = new Map([...data.escalations].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((item, index) => [item.id, `E-${101 + index}`]));
  const projectNames = [...new Set([...data.projects.map((project) => project.name), ...data.statusUpdates.map((row) => row.project), ...data.hourlyEntries.map((row) => row.project)].map((name) => name.trim()).filter(Boolean))].sort();

  return (
    <>
      <PageHeader eyebrow="Operations" title="Escalations" />
      <div className="stats">
        <Stat label="Total raised" value={String(data.escalations.length)} />
        <Stat label="Open" value={String(open)} />
        <Stat label="Blockers" value={String(blockers)} />
        <Stat label="Resolved" value={String(resolved)} />
      </div>
      <section className="card">
        <div className="card-head">
          <h2>Tracker</h2>
          <span className="muted">Blocked rows on the hourly tracker are listed here automatically</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Project</th><th>Type</th><th>Description</th><th>Source</th><th>Owner, target date, status, and resolution</th></tr>
            </thead>
            <tbody>
              {ordered.map((item) => (
                <tr key={item.id}>
                  <td>{numbers.get(item.id)}</td>
                  <td>{item.projectName || projectOf(data, item.projectId)?.name || "Project"}</td>
                  <td><Badge value={item.type} /></td>
                  <td className="remarks">
                    {item.description}
                    <div className="muted">Raised {prettyDate(item.createdAt.slice(0, 10))} by {item.createdBy === "system" ? "System" : nameOf(data, item.createdBy)}</div>
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
                        <textarea name="resolutionNote" rows={1} defaultValue={item.resolutionNote ?? ""} />
                      </label>
                      <Submit variant="ghost">Save</Submit>
                    </ActionForm>
                  </td>
                </tr>
              ))}
              {data.escalations.length === 0 ? <tr><td colSpan={6}>Nothing raised yet.</td></tr> : null}
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
      <section className="card">
        <h2>Consolidated progress across six workstreams</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Workstream</th><th>Owner, target date, and status</th></tr>
            </thead>
            <tbody>
              {data.workstreams.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>
                    <ActionForm action={saveWorkstreamAction} className="inline-form">
                      <input type="hidden" name="id" value={item.id} />
                      <input name="ownerName" defaultValue={item.ownerName} aria-label={`${item.name} owner`} />
                      <input type="date" name="targetDate" defaultValue={item.targetDate} aria-label={`${item.name} target date`} />
                      <select name="status" defaultValue={item.status} aria-label={`${item.name} status`}>
                        <option value="in_progress">In progress</option>
                        <option value="blocked">Blocked</option>
                        <option value="done">Done</option>
                      </select>
                      <Submit variant="ghost">Save</Submit>
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
