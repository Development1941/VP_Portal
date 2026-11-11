"use client";

import { deleteChecklistAction, saveChecklistAction } from "@/app/actions";
import { ActionForm, Submit } from "@/components/common/forms";
import { EditRow } from "@/components/dashboard/row-edit";
import { prettyDate } from "@/lib/format";
import { APPROVAL_OPTIONS, CHECKLIST_STATUS_OPTIONS } from "@/lib/pmd-flow";
import type { ChecklistItem } from "@/lib/types";

function withCurrent(options: string[], value: string) {
  return !value || options.includes(value) ? options : [value, ...options];
}

export function ChecklistForm({ row, onDone }: { row: ChecklistItem; onDone: () => void }) {
  return (
    <>
      <ActionForm action={saveChecklistAction} className="edit-modal-form" onDone={onDone}>
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="sheetNo" value={row.sheetNo || ""} />
        <label className="field">
          <span>Project</span>
          <input name="project" required defaultValue={row.project} readOnly={Boolean(row.id)} />
        </label>
        <label className="field">
          <span>Sprint</span>
          <input name="sprint" defaultValue={row.sprint} />
        </label>
        <label className="field">
          <span>Task</span>
          <textarea name="task" rows={2} required defaultValue={row.task} readOnly={Boolean(row.id)} />
        </label>
        <label className="field">
          <span>Resource</span>
          <input name="resource" defaultValue={row.resource} />
        </label>
        <label className="field">
          <span>Date of completion</span>
          <input name="completedOn" type="date" defaultValue={row.completedOn} />
        </label>
        <label className="field">
          <span>Status</span>
          <select name="status" defaultValue={row.status}>
            {withCurrent(CHECKLIST_STATUS_OPTIONS, row.status).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Client approval</span>
          <select name="clientApproval" defaultValue={row.clientApproval}>
            <option value="">Not set</option>
            {withCurrent(APPROVAL_OPTIONS, row.clientApproval).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <p className="muted">Client approval is copied to the Approval column of the matching task in Resource management.</p>
        <Submit>{row.id ? "Save row" : "Add entry"}</Submit>
      </ActionForm>
      {row.id ? (
        <ActionForm action={deleteChecklistAction} onDone={onDone}>
          <input type="hidden" name="id" value={row.id} />
          <Submit variant="ghost">Remove</Submit>
        </ActionForm>
      ) : null}
    </>
  );
}

function approvalTone(value: string) {
  const text = value.toLowerCase();
  if (text.includes("approved")) return "ok";
  if (text.includes("reject")) return "bad";
  return value ? "warn" : "";
}

function ChecklistCells({ row }: { row: ChecklistItem }) {
  return (
    <>
      <td className="num">{row.sheetNo || "—"}</td>
      <td>{prettyDate(row.completedOn)}</td>
      <td>{row.project || "—"}</td>
      <td className="remarks">
        {row.task}
        {row.sprint || row.resource ? <div className="muted">{[row.sprint, row.resource].filter(Boolean).join(" · ")}</div> : null}
      </td>
      <td>{row.status ? <span className="badge ok">{row.status}</span> : "—"}</td>
      <td>{row.clientApproval ? <span className={`badge ${approvalTone(row.clientApproval)}`}>{row.clientApproval}</span> : "—"}</td>
      <td className="muted">{row.source === "auto" ? "Auto" : row.source === "upload" ? "Upload" : "Manual"}</td>
    </>
  );
}

export function ChecklistTable({ rows, editable }: { rows: ChecklistItem[]; editable: boolean }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>S.no</th>
            <th>Date of completion</th>
            <th>Project</th>
            <th>Task</th>
            <th>Status</th>
            <th>Client approval</th>
            <th>Source</th>
            {editable ? <th>Edit</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) =>
            editable ? (
              <EditRow key={row.id} label={`Edit ${row.task}`} title={row.task} form={(close) => <ChecklistForm row={row} onDone={close} />}>
                <ChecklistCells row={row} />
              </EditRow>
            ) : (
              <tr key={row.id}>
                <ChecklistCells row={row} />
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
