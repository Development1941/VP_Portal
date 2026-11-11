import { uploadHourlyTrackerAction } from "@/app/actions";
import { SheetUpload } from "@/components/dashboard/sheet-upload";
import { HourlyEditRow } from "@/components/dashboard/row-edit";
import { AddHourlyEntry, ExportCsv } from "@/components/sheets/add-entry";
import { hourlyStatus, sheetHours } from "@/components/sheets/cells";
import { hoursLabel, prettyDate } from "@/lib/format";
import { isResourceAllocation } from "@/lib/hourly-sheet";
import type { HourlyEntry } from "@/lib/types";

export function HourlyTracker({
  entries,
  editable,
  exportable = false,
  subtitle,
  title = "Hourly tracker",
  tools = editable,
  empty = "No hours have been logged yet.",
}: {
  entries: HourlyEntry[];
  editable: boolean;
  exportable?: boolean;
  subtitle?: string;
  title?: string;
  tools?: boolean;
  empty?: string;
}) {
  const groups = hourGroups(entries.filter((entry) => !isResourceAllocation(entry)));
  const total = groups.reduce((sum, group) => sum + group.hours, 0);
  return (
    <section className="card status-board" id="hourly-tracker">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          <span className="muted">{subtitle || (groups.length ? `${groups.length} projects · ${hoursLabel(total)} logged` : "Day-wise task tracker")}</span>
        </div>
        {tools || exportable ? (
          <div className="sheet-actions">
            {tools ? <AddHourlyEntry plan={false} /> : null}
            {tools ? (
              <SheetUpload
                action={uploadHourlyTrackerAction}
                button="Upload CSV"
                title="Upload hourly tracker"
                hint="Use the daily utilization CSV. It reads S.no, Project, Sprint, Resource, Task, Date, Hours Spent, Status, Blocker, and Company. New rows are appended and exact duplicates are skipped. Blocked rows need Blocker remarks."
                field="sheet"
              />
            ) : null}
            {exportable ? <ExportCsv kind="dsr" /> : null}
          </div>
        ) : null}
      </div>
      {groups.length ? (
        <div className="hour-projects">
          {groups.map((group) => (
            <details key={group.name} className="hour-project" open={editable}>
              <summary>
                <span className="hour-project-name">{group.name}</span>
                <span className="muted">
                  {hoursLabel(group.hours)} · {group.rows.length} {group.rows.length === 1 ? "entry" : "entries"}
                  {group.blocked ? ` · ${group.blocked} blocked` : ""}
                </span>
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
                      <th>Date</th>
                      <th className="num">Hours Spent</th>
                      <th>Status</th>
                      <th>Blocker</th>
                      <th>Company</th>
                      {editable ? <th>Edit</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) =>
                      editable ? (
                        <HourlyEditRow key={row.id} row={row} plan={false} />
                      ) : (
                        <tr key={row.id}>
                          <td className="num">{row.sheetNo || "—"}</td>
                          <td>{row.project || "—"}</td>
                          <td>{row.sprint || "—"}</td>
                          <td>{row.resource || "—"}</td>
                          <td className="remarks">{row.task || row.notes || "—"}</td>
                          <td>{prettyDate(row.workDate)}</td>
                          <td className="num">{sheetHours(row.hours)}</td>
                          <td>{hourlyStatus(row.status)}</td>
                          <td className="remarks">{row.blocker || "—"}</td>
                          <td>{row.company || "—"}</td>
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
        <p className="empty">{empty}</p>
      )}
    </section>
  );
}

export function hourGroups(rows: HourlyEntry[]) {
  const groups = new Map<string, HourlyEntry[]>();
  for (const row of rows) {
    const name = row.project.trim() || "No project";
    const list = groups.get(name) ?? [];
    list.push(row);
    groups.set(name, list);
  }
  return [...groups.entries()]
    .map(([name, items]) => ({
      name,
      hours: items.reduce((sum, row) => sum + row.hours, 0),
      blocked: items.filter((row) => /\bblock/i.test(row.status)).length,
      rows: items.sort((a, b) => a.sheetNo - b.sheetNo || a.workDate.localeCompare(b.workDate)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
