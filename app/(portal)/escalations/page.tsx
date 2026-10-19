import { saveWorkstreamAction, setEscalationStatusAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { Badge, Denied, PageHeader, Stat } from "@/components/common/ui";
import { can } from "@/lib/access";
import { ESCALATION_STATUSES } from "@/lib/delivery";
import { prettyDate } from "@/lib/format";
import { projectOf, requirePage } from "@/lib/page";

export default async function EscalationsPage() {
  const { user, data, allowed } = await requirePage(["projects.view", "projects.view_all", "tasks.view", "tasks.manage"]);
  if (!allowed) return <Denied title="Escalations and blockers" />;
  const open = data.escalations.filter((item) => item.status !== "resolved").length;
  const blockers = data.escalations.filter((item) => item.type === "blocker").length;
  const resolved = data.escalations.filter((item) => item.status === "resolved").length;
  const manage = can(user, "projects.manage") || can(user, "projects.view_all") || can(user, "tasks.manage");

  return (
    <>
      <PageHeader eyebrow="Delivery control" title="Escalations and blockers" lede="One consolidated tracker for management review. Raise new items from the Project tasks page." />
      <div className="stats">
        <Stat label="Total raised" value={String(data.escalations.length)} />
        <Stat label="Open" value={String(open)} />
        <Stat label="Blockers" value={String(blockers)} />
        <Stat label="Resolved" value={String(resolved)} />
      </div>
      <section className="card">
        <h2>Tracker</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Project</th><th>Type</th><th>Description</th><th>Owner</th><th>Target date</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data.escalations.map((item, index) => (
                <tr key={item.id}>
                  <td>E-{String(101 + index)}</td>
                  <td>{projectOf(data, item.projectId)?.name || "Project"}</td>
                  <td><Badge value={item.type} /></td>
                  <td>{item.description}</td>
                  <td>{item.ownerName}</td>
                  <td>{prettyDate(item.dueDate)}</td>
                  <td>
                    {manage ? (
                      <ActionForm action={setEscalationStatusAction} className="inline-form">
                        <input type="hidden" name="id" value={item.id} />
                        <select name="status" defaultValue={item.status}>
                          {ESCALATION_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                        <Submit variant="ghost">Save</Submit>
                      </ActionForm>
                    ) : (
                      <Badge value={item.status} />
                    )}
                  </td>
                </tr>
              ))}
              {data.escalations.length === 0 ? <tr><td colSpan={7}>Nothing raised yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2>Consolidated progress across six workstreams</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Workstream</th><th>Owner</th><th>Target date</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {data.workstreams.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  {manage ? (
                    <td colSpan={4}>
                      <ActionForm action={saveWorkstreamAction} className="inline-form">
                        <input type="hidden" name="id" value={item.id} />
                        <input name="ownerName" defaultValue={item.ownerName} />
                        <input type="date" name="targetDate" defaultValue={item.targetDate} />
                        <select name="status" defaultValue={item.status}>
                          <option value="in_progress">In progress</option>
                          <option value="blocked">Blocked</option>
                          <option value="done">Done</option>
                        </select>
                        <Submit variant="ghost">Save</Submit>
                      </ActionForm>
                    </td>
                  ) : (
                    <>
                      <td>{item.ownerName}</td>
                      <td>{prettyDate(item.targetDate)}</td>
                      <td><Badge value={item.status} /></td>
                      <td></td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
