import Link from "next/link";
import { uploadAllocationAction } from "@/app/actions";
import { SheetUpload } from "@/components/dashboard/sheet-upload";
import { HourlyEditRow } from "@/components/dashboard/row-edit";
import { hoursLabel, prettyDate } from "@/lib/format";
import { isResourceAllocation } from "@/lib/hourly-sheet";
import type { HourlyEntry } from "@/lib/types";

export function ResourceAllocation({ rows, editable, linked }: { rows: HourlyEntry[]; editable: boolean; linked?: boolean }) {
  const allocated = rows.filter(isResourceAllocation);
  const people = allocationGroups(allocated);
  const estimated = allocated.reduce((sum, row) => sum + (row.estimatedHours ?? 0), 0);
  const target = allocated.reduce((sum, row) => sum + (row.targetHours ?? 0), 0);
  return (
    <section className="card status-board" id="resource-allocation">
      <div className="card-head">
        <div>
          {linked ? <h2>Resource allocation</h2> : null}
          <span className="muted">
            {people.length ? `${people.length} people · ${hoursLabel(estimated)} estimated · ${hoursLabel(target)} target` : "Estimated hours and targets from the utilization plan"}
          </span>
        </div>
        <div className="card-tools">
          {editable ? (
            <SheetUpload
              action={uploadAllocationAction}
              button="Upload CSV"
              title="Upload resource allocation"
              hint="Use the utilization plan CSV. It reads S.no, Project, Sprint, Resource, Task, EST Start Date, EST End Date, Estimated Hours, Target hours embee, Actual Start Date, Actual End Date, Actual Hours, Status, and Approval."
              field="sheet"
            />
          ) : null}
          {linked ? <Link href="/resources">Full list</Link> : null}
        </div>
      </div>
      {people.length ? (
        <div className="hour-projects">
          {people.map((group) => (
            <details key={group.name} className="hour-project" open>
              <summary>
                <span className="hour-project-name">{group.name}</span>
                <span className="muted">{hoursLabel(group.estimated)} estimated · {hoursLabel(group.target)} target · {group.rows.length} {group.rows.length === 1 ? "task" : "tasks"}</span>
              </summary>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>S.no</th>
                      <th>Project</th>
                      <th>Sprint</th>
                      <th>Resource</th>
                      <th>Task</th>
                      <th>EST Start Date</th>
                      <th>EST End Date</th>
                      <th className="num">Estimated Hours</th>
                      <th className="num">Target hours embee</th>
                      <th>Actual Start Date</th>
                      <th>Actual End Date</th>
                      <th className="num">Actual Hours</th>
                      <th>Status</th>
                      <th>Approval</th>
                      {editable ? <th>Edit</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) =>
                      editable ? (
                        <HourlyEditRow key={row.id} row={row} plan />
                      ) : (
                        <tr key={row.id}>
                          <td className="num">{row.sheetNo || "—"}</td>
                          <td>{row.project || "—"}</td>
                          <td>{row.sprint || "—"}</td>
                          <td>{row.resource || "—"}</td>
                          <td className="remarks">{row.task || row.notes || "—"}</td>
                          <td>{prettyDate(row.estStart)}</td>
                          <td>{prettyDate(row.estEnd)}</td>
                          <td className="num">{sheetHours(row.estimatedHours)}</td>
                          <td className="num">{sheetHours(row.targetHours)}</td>
                          <td>{prettyDate(row.actualStart)}</td>
                          <td>{prettyDate(row.actualEnd)}</td>
                          <td className="num">{sheetHours(row.actualHours)}</td>
                          <td>{row.status || "—"}</td>
                          <td>{row.approval || "—"}</td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="empty">No resource allocation has been recorded.</p>
      )}
    </section>
  );
}

function sheetHours(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-IN", { maximumFractionDigits: 1 });
}

function allocationGroups(rows: HourlyEntry[]) {
  const groups = new Map<string, HourlyEntry[]>();
  for (const row of rows) {
    const name = row.resource.trim() || "Unassigned";
    const list = groups.get(name) ?? [];
    list.push(row);
    groups.set(name, list);
  }
  return [...groups.entries()]
    .map(([name, items]) => ({
      name,
      estimated: items.reduce((sum, row) => sum + (row.estimatedHours ?? 0), 0),
      target: items.reduce((sum, row) => sum + (row.targetHours ?? 0), 0),
      rows: items.sort((a, b) => a.sheetNo - b.sheetNo || a.project.localeCompare(b.project)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
