import { uploadStatusSheetAction } from "@/app/actions";
import { SheetUpload } from "@/components/dashboard/sheet-upload";
import { AddStatusEntry } from "@/components/sheets/add-entry";
import { StatusEditRow } from "@/components/sheets/status-rows";
import { prettyDate } from "@/lib/format";
import { extraStatusColumns, groupStatus, latestStatus, statusAsOf, statusTone } from "@/lib/status-board";
import type { StatusUpdate } from "@/lib/types";

export function ProjectStatusBoard({ updates, editable, asOf }: { updates: StatusUpdate[]; editable: boolean; asOf?: string }) {
  const board = asOf ? statusAsOf(updates, asOf) : latestStatus(updates);
  const groups = groupStatus(board.rows);
  const extras = extraStatusColumns(board.rows);
  return (
    <section className="card status-board" id="project-status">
      <div className="card-head">
        <div>
          <h2>Project status</h2>
          <span className="muted">
            {asOf ? "Archive · " : ""}Projects and their items{board.date ? ` · ${prettyDate(board.date)}` : ""}
          </span>
        </div>
        {editable ? (
          <div className="sheet-actions">
            <AddStatusEntry />
            <SheetUpload
              action={uploadStatusSheetAction}
              button="Upload sheet"
              title="Upload project status"
              hint="Use an Excel or CSV file with S.no, Project, Item, Status, and Task/Remarks. New rows are appended and matching rows are updated. Nothing is removed."
              field="sheet"
            />
          </div>
        ) : null}
      </div>
      {groups.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>S.no</th>
                <th>Project</th>
                <th>Item</th>
                <th>Status</th>
                <th>Task / Remarks</th>
                {extras.map((column) => (
                  <th key={column}>{column}</th>
                ))}
                {editable ? <th>Edit</th> : null}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) =>
                group.items.map((row, index) =>
                  editable ? (
                    <StatusEditRow key={row.id || `${group.key}-${index}`} row={row} lead={index === 0} span={group.items.length} tone={statusTone(row.status)} extras={extras} />
                  ) : (
                    <tr key={`${group.key}-${row.subItem}-${index}`}>
                      {index === 0 ? (
                        <>
                          <td className="num project-cell" rowSpan={group.items.length}>
                            {group.sheetNo || "—"}
                          </td>
                          <td className="project-cell" rowSpan={group.items.length}>
                            {group.project}
                          </td>
                        </>
                      ) : null}
                      <td>{row.subItem || "—"}</td>
                      <td>
                        <span className={`badge ${statusTone(row.status)}`}>{row.status || "—"}</span>
                      </td>
                      <td className="remarks">{row.remarks || "—"}</td>
                      {extras.map((column) => (
                        <td key={column}>{row.fields?.[column] || "—"}</td>
                      ))}
                    </tr>
                  ),
                ),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">{asOf ? `No project status was recorded on or before ${prettyDate(asOf)}.` : "No project status has been recorded."}</p>
      )}
    </section>
  );
}
